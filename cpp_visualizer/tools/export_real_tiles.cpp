#include "ocean/common/types.hpp"
#include "ocean/common/constants.hpp"
#include "ocean/io/cmems_loader.hpp"
#include "ocean/io/surface_bgc_loader.hpp"
#include <iostream>
#include <fstream>
#include <vector>
#include <cmath>
#include <cstring>
#include <filesystem>
#include <algorithm>
#include <ctime>
#include <cstdlib>
#include <limits>

namespace fs = std::filesystem;

#pragma pack(push, 1)
struct INCOHeader {
    char magic[4];          // 'I', 'N', 'C', 'O'
    uint16_t version{1};    // 1
    uint16_t var_code{1};   // 1=temp, 2=salin, 3=currents, 4=chl
    uint16_t width{0};      // lon count
    uint16_t height{0};     // lat count
    uint16_t depth_count{1};// 1
    uint16_t data_type{1};  // 1 = Float32
    float min_val{0.0f};    // min authentic non-NaN
    float max_val{1.0f};    // max authentic non-NaN
    char reserved[8]{0};    // zeros
};
#pragma pack(pop)

static_assert(sizeof(INCOHeader) == 32, "INCOHeader must be exactly 32 bytes");

bool write_inco_tile(
    const std::string& out_path,
    uint16_t var_code,
    uint16_t width,
    uint16_t height,
    const std::vector<float>& data
) {
    if (data.size() != static_cast<size_t>(width) * height) {
        std::cerr << "Data size mismatch for " << out_path << "\n";
        return false;
    }

    float min_val = 1e9f;
    float max_val = -1e9f;
    size_t valid_count = 0;

    for (float v : data) {
        if (!std::isnan(v)) {
            if (v < min_val) min_val = v;
            if (v > max_val) max_val = v;
            ++valid_count;
        }
    }

    if (valid_count == 0) {
        min_val = 0.0f;
        max_val = 1.0f;
    }

    INCOHeader header;
    header.magic[0] = 'I';
    header.magic[1] = 'N';
    header.magic[2] = 'C';
    header.magic[3] = 'O';
    header.version = 1;
    header.var_code = var_code;
    header.width = width;
    header.height = height;
    header.depth_count = 1;
    header.data_type = 1;
    header.min_val = min_val;
    header.max_val = max_val;
    std::memset(header.reserved, 0, sizeof(header.reserved));

    fs::create_directories(fs::path(out_path).parent_path());

    std::ofstream ofs(out_path, std::ios::binary);
    if (!ofs) {
        std::cerr << "Failed to open output file: " << out_path << "\n";
        return false;
    }

    ofs.write(reinterpret_cast<const char*>(&header), sizeof(header));
    ofs.write(reinterpret_cast<const char*>(data.data()), data.size() * sizeof(float));
    ofs.close();

    std::cout << "  [WROTE REAL TILE] " << out_path
              << " (" << width << "x" << height
              << ", valid cells: " << valid_count
              << ", range: [" << min_val << ", " << max_val << "])\n";
    return true;
}

// UTC calendar date (YYYY-MM-DD) of a Unix epoch timestamp.
static std::string epoch_to_date(double epoch_sec) {
    const std::time_t t = static_cast<std::time_t>(epoch_sec);
    std::tm tm_utc{};
#if defined(_WIN32)
    gmtime_s(&tm_utc, &t);
#else
    gmtime_r(&t, &tm_utc);
#endif
    char buf[16];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", &tm_utc);
    return buf;
}

// Usage: export_real_tiles <repo_root> <out_dir> [bio_roms_year]
// Every tile is labelled with the timestamp stored in its source NetCDF file.
// No slice is ever copied to additional dates, and no depth levels are invented.
int main(int argc, char* argv[]) {
    std::cout << "====================================================================\n";
    std::cout << "  INCOIS C++ OCEAN_CORE REAL TILE EXPORTER (source timestamps only)\n";
    std::cout << "====================================================================\n\n";

    const std::string base_dir = argc > 1 ? argv[1] : ".";
    const std::string tiles_out_dir = argc > 2 ? argv[2] : "tiles";
    const int roms_year = argc > 3 ? std::atoi(argv[3]) : -1;

    const std::string cmems_path = base_dir + "/datasets/cmems.nc";
    const std::string roms_path = base_dir + "/datasets/model/INCOIS-BIO-ROMS.nc";

    // 1. CMEMS ARMOR3D surface fields (single timestep in the local subset)
    if (!fs::exists(cmems_path)) {
        std::cerr << "[ERROR] CMEMS file not found: " << cmems_path << "\n";
        return 1;
    }
    {
        ocean::CMEMSLoader cmems(cmems_path);
        const auto& meta = cmems.metadata();
        const uint16_t w = static_cast<uint16_t>(meta.lon_count);
        const uint16_t h = static_cast<uint16_t>(meta.lat_count);
        const std::string date = epoch_to_date(meta.timestamp_epoch_sec);
        std::cout << "[1/2] CMEMS " << cmems_path << " grid " << w << "x" << h << ", timestep " << date << "\n";

        auto to_slice = cmems.read_surface_slice(ocean::CanonicalVar::TEMP);
        auto so_slice = cmems.read_surface_slice(ocean::CanonicalVar::PSAL);
        auto ugo_slice = cmems.read_surface_slice(ocean::CanonicalVar::UVEL);
        auto vgo_slice = cmems.read_surface_slice(ocean::CanonicalVar::VVEL);
        std::vector<float> speed_slice(ugo_slice.size(), std::numeric_limits<float>::quiet_NaN());
        for (size_t i = 0; i < speed_slice.size(); ++i) {
            if (!std::isnan(ugo_slice[i]) && !std::isnan(vgo_slice[i])) {
                speed_slice[i] = std::sqrt(ugo_slice[i] * ugo_slice[i] + vgo_slice[i] * vgo_slice[i]);
            }
        }
        const std::string dir = tiles_out_dir + "/cmems";
        write_inco_tile(dir + "/temperature/" + date + "/0.0.bin", 1, w, h, to_slice);
        write_inco_tile(dir + "/salinity/" + date + "/0.0.bin", 2, w, h, so_slice);
        write_inco_tile(dir + "/currents/" + date + "/0.0.bin", 3, w, h, speed_slice);
    }

    // 2. INCOIS Bio-ROMS surface chlorophyll: every timestep of the requested year
    //    (default: the final year in the file), each labelled with its own date.
    if (!fs::exists(roms_path)) {
        std::cerr << "[ERROR] Bio-ROMS file not found: " << roms_path << "\n";
        return 1;
    }
    {
        ocean::SurfaceBGCLoader roms(roms_path);
        const auto& meta = roms.metadata();
        const uint16_t w = static_cast<uint16_t>(meta.lon_count);
        const uint16_t h = static_cast<uint16_t>(meta.lat_count);
        if (meta.time_steps == 0) {
            std::cerr << "[ERROR] Bio-ROMS file has no timesteps\n";
            return 1;
        }
        const std::string last_date = epoch_to_date(meta.time_epochs_sec.back());
        const int year = roms_year > 0 ? roms_year : std::atoi(last_date.substr(0, 4).c_str());
        std::cout << "\n[2/2] Bio-ROMS " << roms_path << " grid " << w << "x" << h << ", year " << year << "\n";
        size_t written = 0;
        for (size_t t = 0; t < meta.time_steps; ++t) {
            const std::string date = epoch_to_date(meta.time_epochs_sec[t]);
            if (std::atoi(date.substr(0, 4).c_str()) != year) continue;
            auto chl_slice = roms.read_surface_slice(ocean::CanonicalVar::CHL, t);
            for (float& v : chl_slice) {
                if (!std::isnan(v)) v *= 1000000.0f;  // kg m-3 -> mg m-3
            }
            write_inco_tile(tiles_out_dir + "/bio_roms/chlorophyll/" + date + "/0.0.bin", 4, w, h, chl_slice);
            ++written;
        }
        if (written == 0) {
            std::cerr << "[ERROR] No Bio-ROMS timesteps in year " << year << "\n";
            return 1;
        }
    }

    std::cout << "\nExport complete (native source grids; surface level only). Output: " << tiles_out_dir << "\n";
    std::cout << "Note: the web platform serves tiles built by scripts/build_authentic_dataset.py.\n";
    return 0;
}
