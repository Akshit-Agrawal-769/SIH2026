#include "ocean/io/roms_loader.hpp"
#include "ocean/common/missing.hpp"
#include "ocean/common/audit_logger.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include <stdexcept>
#include <algorithm>

namespace ocean {

namespace {

const char* map_canonical_to_roms(CanonicalVar var) {
    switch (var) {
        case CanonicalVar::TEMP:        return "SST";
        case CanonicalVar::PSAL:        return "SSS";
        case CanonicalVar::MLD:         return "MLD";
        case CanonicalVar::CHL:         return "CHL";
        case CanonicalVar::NO3:         return "NO3";
        case CanonicalVar::DIC:         return "DIC";
        case CanonicalVar::PCO2_ORIG:   return "pCO2_Original";
        case CanonicalVar::PCO2_INT:    return "pCO2_Int";
        case CanonicalVar::PCO2_CLIM:   return "pCO2_Clim";
        case CanonicalVar::PCO2_UNCERT: return "Deviant_uncertainty";
        default: return nullptr;
    }
}

// 1980-01-24 00:00:00 UTC offset from Unix epoch 1970-01-01:
// 3675 days * 86400 = 317520000.0 seconds
constexpr double kRomsEpochOffsetSeconds = 317520000.0;

} // anonymous namespace

ROMSLoader::ROMSLoader(const std::string& filepath)
    : file_(std::make_unique<NetCDFFile>(filepath)) {
    parse_grid();
}

void ROMSLoader::parse_grid() {
    std::vector<float> lats = file_->read_var_1d_float("LAT");
    std::vector<float> lons = file_->read_var_1d_float("LON");
    std::vector<double> times_days = file_->read_var_1d_double("TIME");

    meta_.time_steps = times_days.size();
    meta_.time_epochs_sec.resize(meta_.time_steps);
    for (size_t i = 0; i < meta_.time_steps; ++i) {
        meta_.time_epochs_sec[i] = times_days[i] * 86400.0 + kRomsEpochOffsetSeconds;
    }

    auto lat_range = SpatialFilter::find_clamped_index_range(
        lats, Constants::REGION_MIN_LAT, Constants::REGION_MAX_LAT
    );
    auto lon_range = SpatialFilter::find_clamped_index_range(
        lons, Constants::REGION_MIN_LON, Constants::REGION_MAX_LON
    );

    meta_.lat_start_idx = lat_range.first;
    meta_.lat_count = lat_range.second;
    meta_.lon_start_idx = lon_range.first;
    meta_.lon_count = lon_range.second;

    meta_.clipped_latitudes.resize(meta_.lat_count);
    for (size_t i = 0; i < meta_.lat_count; ++i) {
        meta_.clipped_latitudes[i] = lats[meta_.lat_start_idx + i];
    }

    meta_.clipped_longitudes.resize(meta_.lon_count);
    for (size_t i = 0; i < meta_.lon_count; ++i) {
        meta_.clipped_longitudes[i] = lons[meta_.lon_start_idx + i];
    }
}

std::vector<float> ROMSLoader::read_surface_slice(
    CanonicalVar var,
    size_t time_idx,
    uint32_t stride_lat,
    uint32_t stride_lon
) {
    const char* src_name = map_canonical_to_roms(var);
    if (!src_name) {
        throw std::invalid_argument("Requested variable is not supported in ROMS: " + 
                                    std::to_string(static_cast<int>(var)));
    }

    if (time_idx >= meta_.time_steps) {
        throw std::out_of_range("ROMS time_idx out of range: " + std::to_string(time_idx));
    }

    int varid = file_->get_var_id(src_name);

    if (stride_lat == 0) stride_lat = 1;
    if (stride_lon == 0) stride_lon = 1;

    const size_t out_lat_count = (meta_.lat_count + stride_lat - 1) / stride_lat;
    const size_t out_lon_count = (meta_.lon_count + stride_lon - 1) / stride_lon;
    const size_t total_out = out_lat_count * out_lon_count;

    std::vector<float> buffer(total_out);

    size_t start[3] = {time_idx, meta_.lat_start_idx, meta_.lon_start_idx};
    size_t count[3] = {1, out_lat_count, out_lon_count};
    ptrdiff_t stride[3] = {1, static_cast<ptrdiff_t>(stride_lat), static_cast<ptrdiff_t>(stride_lon)};

    if (var == CanonicalVar::PCO2_UNCERT) {
        // Stored as float32 in file
        file_->read_hyperslab_float(varid, start, count, stride, buffer.data());
    } else {
        // Stored as float64 (double) in file
        std::vector<double> double_buf(total_out);
        file_->read_hyperslab_double(varid, start, count, stride, double_buf.data());
        for (size_t i = 0; i < total_out; ++i) {
            buffer[i] = static_cast<float>(double_buf[i]);
        }
    }

    // Sanitize missing/NaN values
    for (float& v : buffer) {
        v = Missing::sanitize(v);
    }

    if (stride_lat > 1 || stride_lon > 1) {
        AuditLogger::instance().log_decimation(
            "ROMS_" + std::string(src_name),
            meta_.lat_count * meta_.lon_count,
            total_out,
            std::max(stride_lat, stride_lon)
        );
    }

    return buffer;
}

std::vector<float> ROMSLoader::read_point_timeseries(
    CanonicalVar var,
    size_t lat_idx,
    size_t lon_idx
) {
    const char* src_name = map_canonical_to_roms(var);
    if (!src_name) {
        throw std::invalid_argument("Variable not supported in ROMS: " + std::to_string(static_cast<int>(var)));
    }

    if (lat_idx >= meta_.clipped_latitudes.size() || lon_idx >= meta_.clipped_longitudes.size()) {
        throw std::out_of_range("ROMS lat/lon index out of range for clipped grid");
    }

    const size_t global_lat = meta_.lat_start_idx + lat_idx;
    const size_t global_lon = meta_.lon_start_idx + lon_idx;

    int varid = file_->get_var_id(src_name);
    std::vector<float> ts(meta_.time_steps);

    size_t start[3] = {0, global_lat, global_lon};
    size_t count[3] = {meta_.time_steps, 1, 1};
    ptrdiff_t stride[3] = {1, 1, 1};

    if (var == CanonicalVar::PCO2_UNCERT) {
        file_->read_hyperslab_float(varid, start, count, stride, ts.data());
    } else {
        std::vector<double> d_buf(meta_.time_steps);
        file_->read_hyperslab_double(varid, start, count, stride, d_buf.data());
        for (size_t i = 0; i < meta_.time_steps; ++i) {
            ts[i] = static_cast<float>(d_buf[i]);
        }
    }

    for (float& v : ts) {
        v = Missing::sanitize(v);
    }

    return ts;
}

} // namespace ocean
