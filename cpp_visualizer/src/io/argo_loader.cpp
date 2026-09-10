#include "ocean/io/argo_loader.hpp"
#include "ocean/geo/teos10.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include "ocean/common/audit_logger.hpp"
#include "ocean/common/missing.hpp"
#include <iostream>
#include <cstring>
#include <cassert>

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

ArgoLoader::ArgoLoader(const ENUTransformer& transformer)
    : transformer_(transformer) {}

size_t ArgoLoader::stream_file(
    const std::string& filepath,
    CanonicalVar target_var,
    const std::unordered_set<ProfileKey, ProfileKeyHash>& existing_keys,
    std::vector<ObservationPoint>& out_points,
    uint32_t stride_level
) {
    if (stride_level == 0) stride_level = 1;

    NetCDFFile file(filepath);

    const size_t n_prof = file.get_dim_len("N_PROF");
    const size_t n_levels = file.get_dim_len("N_LEVELS");

    if (n_prof == 0 || n_levels == 0) return 0;

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

    // Variable selection
    const char* val_var_name = (target_var == CanonicalVar::PSAL) ? "PSAL" : "TEMP";
    const char* val_qc_name  = (target_var == CanonicalVar::PSAL) ? "PSAL_QC" : "TEMP_QC";

    const int varid_pres = file.get_var_id("PRES");
    const int varid_pres_qc = file.get_var_id("PRES_QC");
    const int varid_val = file.get_var_id(val_var_name);
    const int varid_val_qc = file.get_var_id(val_qc_name);

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

        // 3. Duplicate Resolution Check: Coriolis preference
        ProfileKey key{wmo, cycle, dir};
        if (existing_keys.find(key) != existing_keys.end()) {
            AuditLogger::instance().log_duplicate(
                filepath, "[CORIOLIS_CATALOG]", wmo, cycle, dir, juld
            );
            continue;
        }

        // Read profile levels
        size_t start[2] = {p, 0};
        size_t count[2] = {1, n_levels};

        nc_get_vara_float(file.ncid(), varid_pres, start, count, pres_buf.data());
        nc_get_vara_text(file.ncid(), varid_pres_qc, start, count, pres_qc_buf.data());
        nc_get_vara_float(file.ncid(), varid_val, start, count, val_buf.data());
        nc_get_vara_text(file.ncid(), varid_val_qc, start, count, val_qc_buf.data());

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

            // Real physical calculation: UNESCO quartic latitude-dependent depth
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
            pt.source = DatasetSource::ARGO_FLOAT_PROFILE;
            pt.qc = static_cast<QCFlag>(val_qc);
            pt.platform_id = wmo;
            pt.cycle_number = cycle;
            pt.profile_index = p;
            pt.level_index = lev;

            out_points.push_back(pt);
            ++points_ingested;
        }
    }

    return points_ingested;
}

} // namespace ocean
