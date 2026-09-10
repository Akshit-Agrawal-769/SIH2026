#include "ocean/io/coriolis_loader.hpp"
#include "ocean/geo/teos10.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include "ocean/common/audit_logger.hpp"
#include "ocean/common/missing.hpp"
#include <iostream>
#include <cstring>
#include <cassert>
#include <filesystem>
#include <algorithm>

namespace ocean {

namespace {

inline bool is_qc_accepted(char qc) noexcept {
    return (qc == '1' || qc == '2');
}

std::string clean_string(const char* buf, size_t max_len) {
    size_t len = 0;
    while (len < max_len && buf[len] != '\0' && buf[len] != ' ') {
        ++len;
    }
    return std::string(buf, len);
}

} // anonymous namespace

CoriolisLoader::CoriolisLoader(const ENUTransformer& transformer)
    : transformer_(transformer) {}

size_t CoriolisLoader::stream_file(
    const std::string& filepath,
    CanonicalVar target_var,
    std::unordered_set<ProfileKey, ProfileKeyHash>& ingested_keys,
    std::vector<ObservationPoint>& out_points,
    uint32_t stride_level
) {
    if (stride_level == 0) stride_level = 1;
    ++stats_.files_attempted;

    try {
        NetCDFFile file(filepath);

        // Check dimension presence
        if (!file.has_dim("N_PROF") || !file.has_dim("N_LEVELS")) {
            ++stats_.files_failed_open;
            AuditLogger::instance().log_exclusion(
                filepath, target_var, 0, 0,
                ExclusionReason::CORRUPT_RECORD,
                "Missing N_PROF or N_LEVELS dimension in " + filepath
            );
            return 0;
        }

        const size_t n_prof = file.get_dim_len("N_PROF");
        const size_t n_levels = file.get_dim_len("N_LEVELS");

        if (n_prof == 0 || n_levels == 0) {
            ++stats_.files_zero_accepted_points;
            return 0;
        }

        // Essential metadata variable check
        if (!file.has_var("PLATFORM_NUMBER") || !file.has_var("CYCLE_NUMBER") ||
            !file.has_var("JULD") || !file.has_var("JULD_QC") ||
            !file.has_var("LATITUDE") || !file.has_var("LONGITUDE") ||
            !file.has_var("POSITION_QC")) {
            ++stats_.files_failed_open;
            AuditLogger::instance().log_exclusion(
                filepath, target_var, 0, 0,
                ExclusionReason::CORRUPT_RECORD,
                "Missing essential profile metadata variables in " + filepath
            );
            return 0;
        }

        // Read metadata arrays
        const int varid_pnum = file.get_var_id("PLATFORM_NUMBER");
        const int varid_cycle = file.get_var_id("CYCLE_NUMBER");
        const int varid_dir = file.has_var("DIRECTION") ? file.get_var_id("DIRECTION") : -1;
        const int varid_juld = file.get_var_id("JULD");
        const int varid_juld_qc = file.get_var_id("JULD_QC");
        const int varid_lat = file.get_var_id("LATITUDE");
        const int varid_lon = file.get_var_id("LONGITUDE");
        const int varid_pos_qc = file.get_var_id("POSITION_QC");

        std::vector<char> platform_chars(n_prof * 8);
        std::vector<int32_t> cycle_numbers(n_prof);
        std::vector<char> directions(n_prof, 'A');
        std::vector<double> juld_times(n_prof);
        std::vector<char> juld_qcs(n_prof);
        std::vector<double> latitudes(n_prof);
        std::vector<double> longitudes(n_prof);
        std::vector<char> pos_qcs(n_prof);

        nc_get_var_text(file.ncid(), varid_pnum, platform_chars.data());
        nc_get_var_int(file.ncid(), varid_cycle, cycle_numbers.data());
        if (varid_dir >= 0) {
            nc_get_var_text(file.ncid(), varid_dir, directions.data());
        }
        nc_get_var_double(file.ncid(), varid_juld, juld_times.data());
        nc_get_var_text(file.ncid(), varid_juld_qc, juld_qcs.data());
        nc_get_var_double(file.ncid(), varid_lat, latitudes.data());
        nc_get_var_double(file.ncid(), varid_lon, longitudes.data());
        nc_get_var_text(file.ncid(), varid_pos_qc, pos_qcs.data());

        // Fast spatial bounding check: if no profile in file is in region, skip reading 2D data
        bool any_in_region = false;
        for (size_t p = 0; p < n_prof; ++p) {
            if (SpatialFilter::is_in_region(latitudes[p], longitudes[p])) {
                any_in_region = true;
                break;
            }
        }
        if (!any_in_region) {
            for (size_t p = 0; p < n_prof; ++p) {
                AuditLogger::instance().log_exclusion(
                    filepath, target_var, p, 0,
                    ExclusionReason::OUT_OF_REGION_BOUNDS,
                    "Coordinates out of bounds: lat=" + std::to_string(latitudes[p]) +
                    ", lon=" + std::to_string(longitudes[p])
                );
            }
            ++stats_.files_zero_accepted_points;
            return 0;
        }

        // Variable identification: check *_ADJUSTED with fallback to raw
        const char* val_raw_name    = (target_var == CanonicalVar::PSAL) ? "PSAL" : "TEMP";
        const char* val_raw_qc_name = (target_var == CanonicalVar::PSAL) ? "PSAL_QC" : "TEMP_QC";
        const char* val_adj_name    = (target_var == CanonicalVar::PSAL) ? "PSAL_ADJUSTED" : "TEMP_ADJUSTED";
        const char* val_adj_qc_name = (target_var == CanonicalVar::PSAL) ? "PSAL_ADJUSTED_QC" : "TEMP_ADJUSTED_QC";

        const bool has_pres_adj = file.has_var("PRES_ADJUSTED") && file.has_var("PRES_ADJUSTED_QC");
        const bool has_pres_raw = file.has_var("PRES") && file.has_var("PRES_QC");
        if (!has_pres_adj && !has_pres_raw) {
            ++stats_.files_failed_open;
            AuditLogger::instance().log_exclusion(
                filepath, target_var, 0, 0,
                ExclusionReason::CORRUPT_RECORD,
                "Neither PRES nor PRES_ADJUSTED variable present in " + filepath
            );
            return 0;
        }

        const bool has_val_adj = file.has_var(val_adj_name) && file.has_var(val_adj_qc_name);
        const bool has_val_raw = file.has_var(val_raw_name) && file.has_var(val_raw_qc_name);
        if (!has_val_adj && !has_val_raw) {
            ++stats_.files_zero_accepted_points;
            return 0;
        }

        const int varid_pres_adj    = has_pres_adj ? file.get_var_id("PRES_ADJUSTED") : -1;
        const int varid_pres_adj_qc = has_pres_adj ? file.get_var_id("PRES_ADJUSTED_QC") : -1;
        const int varid_pres_raw    = has_pres_raw ? file.get_var_id("PRES") : -1;
        const int varid_pres_raw_qc = has_pres_raw ? file.get_var_id("PRES_QC") : -1;

        const int varid_val_adj    = has_val_adj ? file.get_var_id(val_adj_name) : -1;
        const int varid_val_adj_qc = has_val_adj ? file.get_var_id(val_adj_qc_name) : -1;
        const int varid_val_raw    = has_val_raw ? file.get_var_id(val_raw_name) : -1;
        const int varid_val_raw_qc = has_val_raw ? file.get_var_id(val_raw_qc_name) : -1;

        // Check if file represents a duplicate of an earlier file (e.g. SR*.nc synthetic vs R*.nc core)
        const std::string primary_wmo = clean_string(&platform_chars[0], 8);
        const int32_t primary_cycle = cycle_numbers[0];
        const char primary_dir = directions[0];
        ProfileKey primary_key{primary_wmo, primary_cycle, primary_dir};
        if (ingested_keys.find(primary_key) != ingested_keys.end()) {
            AuditLogger::instance().log_duplicate(
                filepath, "[EARLIER_CORIOLIS_INGESTION]", primary_wmo, primary_cycle, primary_dir, juld_times[0]
            );
            ++stats_.files_zero_accepted_points;
            return 0;
        }

        size_t points_ingested = 0;

        std::vector<float> pres_buf(n_levels);
        std::vector<char> pres_qc_buf(n_levels);
        std::vector<float> val_buf(n_levels);
        std::vector<char> val_qc_buf(n_levels);

        for (size_t p = 0; p < n_prof; ++p) {
            const std::string wmo = clean_string(&platform_chars[p * 8], 8);
            const int32_t cycle = cycle_numbers[p];
            const char dir = directions[p];
            const double lat = latitudes[p];
            const double lon = longitudes[p];
            const double juld = juld_times[p];

            // 1. Position & Time Quality Control Check
            if (!is_qc_accepted(pos_qcs[p]) || !is_qc_accepted(juld_qcs[p])) {
                AuditLogger::instance().log_exclusion(
                    filepath, target_var, p, 0,
                    ExclusionReason::QC_FLAG_REJECTED,
                    "Position/JULD QC failed (pos=" + std::string(1, pos_qcs[p]) + 
                    ", juld=" + std::string(1, juld_qcs[p]) + ")"
                );
                continue;
            }

            // 2. Spatial Region Bounding Box Check
            if (!SpatialFilter::is_in_region(lat, lon)) {
                AuditLogger::instance().log_exclusion(
                    filepath, target_var, p, 0,
                    ExclusionReason::OUT_OF_REGION_BOUNDS,
                    "Coordinates out of bounds: lat=" + std::to_string(lat) + ", lon=" + std::to_string(lon)
                );
                continue;
            }

            ProfileKey key{wmo, cycle, dir};
            ingested_keys.insert(key);

            // Read Pressure: try adjusted first, fall back to raw if absent or all-fill
            size_t start[2] = {p, 0};
            size_t count[2] = {1, n_levels};
            bool pres_loaded = false;

            if (has_pres_adj) {
                nc_get_vara_float(file.ncid(), varid_pres_adj, start, count, pres_buf.data());
                nc_get_vara_text(file.ncid(), varid_pres_adj_qc, start, count, pres_qc_buf.data());
                for (size_t i = 0; i < n_levels; ++i) {
                    if (!Missing::is_missing(pres_buf[i]) && is_qc_accepted(pres_qc_buf[i])) {
                        pres_loaded = true;
                        break;
                    }
                }
            }
            if (!pres_loaded && has_pres_raw) {
                nc_get_vara_float(file.ncid(), varid_pres_raw, start, count, pres_buf.data());
                nc_get_vara_text(file.ncid(), varid_pres_raw_qc, start, count, pres_qc_buf.data());
                for (size_t i = 0; i < n_levels; ++i) {
                    if (!Missing::is_missing(pres_buf[i]) && is_qc_accepted(pres_qc_buf[i])) {
                        pres_loaded = true;
                        break;
                    }
                }
            }
            if (!pres_loaded) {
                AuditLogger::instance().log_exclusion(
                    filepath, target_var, p, 0,
                    ExclusionReason::FILL_VALUE_MISSING,
                    "No valid pressure levels in profile"
                );
                continue;
            }

            // Read Target Variable: try adjusted first, fall back to raw if absent or all-fill
            bool val_loaded = false;
            if (has_val_adj) {
                nc_get_vara_float(file.ncid(), varid_val_adj, start, count, val_buf.data());
                nc_get_vara_text(file.ncid(), varid_val_adj_qc, start, count, val_qc_buf.data());
                for (size_t i = 0; i < n_levels; ++i) {
                    if (!Missing::is_missing(val_buf[i]) && is_qc_accepted(val_qc_buf[i])) {
                        val_loaded = true;
                        break;
                    }
                }
            }
            if (!val_loaded && has_val_raw) {
                nc_get_vara_float(file.ncid(), varid_val_raw, start, count, val_buf.data());
                nc_get_vara_text(file.ncid(), varid_val_raw_qc, start, count, val_qc_buf.data());
                for (size_t i = 0; i < n_levels; ++i) {
                    if (!Missing::is_missing(val_buf[i]) && is_qc_accepted(val_qc_buf[i])) {
                        val_loaded = true;
                        break;
                    }
                }
            }
            if (!val_loaded) {
                AuditLogger::instance().log_exclusion(
                    filepath, target_var, p, 0,
                    ExclusionReason::FILL_VALUE_MISSING,
                    "No valid measurement levels in profile"
                );
                continue;
            }

            const double epoch_sec = juld * 86400.0 - Constants::JULD_TO_UNIX_OFFSET_SECONDS;

            for (size_t lev = 0; lev < n_levels; lev += stride_level) {
                const float pres = pres_buf[lev];
                const char pres_qc = pres_qc_buf[lev];
                const float val = val_buf[lev];
                const char val_qc = val_qc_buf[lev];

                if (Missing::is_missing(pres) || !is_qc_accepted(pres_qc)) {
                    continue;
                }

                if (Missing::is_missing(val) || !is_qc_accepted(val_qc)) {
                    AuditLogger::instance().log_exclusion(
                        filepath, target_var, p, lev,
                        ExclusionReason::QC_FLAG_REJECTED,
                        "Measurement QC rejected: flag='" + std::string(1, val_qc) + "'"
                    );
                    continue;
                }

                // Real physical calculation: UNESCO 1983 latitude-dependent depth
                const double z_m = TEOS10::z_from_p(static_cast<double>(pres), lat);
                if (std::abs(z_m) > 12000.0) {
                    AuditLogger::instance().log_exclusion(
                        filepath, target_var, p, lev,
                        ExclusionReason::CORRUPT_RECORD,
                        "Physically impossible depth computed: " + std::to_string(z_m) + " m"
                    );
                    continue;
                }

                const ENUCoord enu = transformer_.geodetic_to_enu(lat, lon, z_m);
                assert(std::abs(enu.up_m) <= 12000.0);

                ObservationPoint pt;
                pt.position = enu;
                pt.timestamp_epoch_sec = epoch_sec;
                pt.value = val;
                pt.depth_m = static_cast<float>(-z_m);
                pt.variable = target_var;
                pt.source = DatasetSource::CORIOLIS_FLOAT_PROFILE;
                pt.qc = static_cast<QCFlag>(val_qc);
                pt.platform_id = wmo;
                pt.cycle_number = cycle;
                pt.profile_index = p;
                pt.level_index = lev;

                out_points.push_back(pt);
                ++points_ingested;
            }
        }

        if (points_ingested > 0) {
            ++stats_.files_successfully_ingested;
            stats_.points_ingested += points_ingested;
        } else {
            ++stats_.files_zero_accepted_points;
        }

        return points_ingested;

    } catch (const std::exception& ex) {
        ++stats_.files_failed_open;
        AuditLogger::instance().log_exclusion(
            filepath, target_var, 0, 0,
            ExclusionReason::CORRUPT_RECORD,
            std::string("NetCDF exception: ") + ex.what()
        );
        return 0;
    }
}

size_t CoriolisLoader::stream_directory(
    const std::string& coriolis_root,
    CanonicalVar target_var,
    std::unordered_set<ProfileKey, ProfileKeyHash>& ingested_keys,
    std::vector<ObservationPoint>& out_points,
    size_t max_files,
    uint32_t stride_level
) {
    namespace fs = std::filesystem;
    std::vector<std::string> matching_files;

    if (!fs::exists(coriolis_root)) {
        std::cerr << "[CoriolisLoader] Directory does not exist: " << coriolis_root << "\n";
        return 0;
    }

    // Match datasets/coriolis/*/profiles/*.nc
    for (const auto& plat_entry : fs::directory_iterator(coriolis_root)) {
        if (!plat_entry.is_directory()) continue;
        auto profiles_dir = plat_entry.path() / "profiles";
        if (fs::exists(profiles_dir) && fs::is_directory(profiles_dir)) {
            for (const auto& f_entry : fs::directory_iterator(profiles_dir)) {
                if (f_entry.is_regular_file() && f_entry.path().extension() == ".nc") {
                    matching_files.push_back(f_entry.path().string());
                }
            }
        }
    }

    std::cout << "      [CoriolisLoader] Matched " << matching_files.size()
              << " files under " << coriolis_root << "/*/profiles/*.nc\n";

    size_t files_to_process = (max_files > 0 && max_files < matching_files.size())
                              ? max_files : matching_files.size();

    size_t total_points = 0;
    for (size_t i = 0; i < files_to_process; ++i) {
        total_points += stream_file(
            matching_files[i],
            target_var,
            ingested_keys,
            out_points,
            stride_level
        );
    }

    std::cout << "      [CoriolisLoader] Ingestion Summary:\n";
    std::cout << "        files_attempted:              " << stats_.files_attempted << "\n";
    std::cout << "        files_failed_open:            " << stats_.files_failed_open << "\n";
    std::cout << "        files_zero_accepted_points:   " << stats_.files_zero_accepted_points << "\n";
    std::cout << "        files_successfully_ingested:  " << stats_.files_successfully_ingested << "\n";
    std::cout << "        total_points_ingested:        " << stats_.points_ingested << "\n";

    return total_points;
}

} // namespace ocean
