#include "ocean/io/cmems_loader.hpp"
#include "ocean/common/missing.hpp"
#include "ocean/common/audit_logger.hpp"
#include <stdexcept>

namespace ocean {

namespace {

const char* map_canonical_to_cmems(CanonicalVar var) {
    switch (var) {
        case CanonicalVar::TEMP: return "to";
        case CanonicalVar::PSAL: return "so";
        case CanonicalVar::SSH:  return "zo";
        case CanonicalVar::UVEL: return "ugo";
        case CanonicalVar::VVEL: return "vgo";
        case CanonicalVar::MLD:  return "mlotst";
        default: return nullptr;
    }
}

} // anonymous namespace

CMEMSLoader::CMEMSLoader(const std::string& filepath)
    : file_(std::make_unique<NetCDFFile>(filepath)) {
    parse_grid();
}

void CMEMSLoader::parse_grid() {
    std::vector<float> lats = file_->read_var_1d_float("latitude");
    std::vector<float> lons = file_->read_var_1d_float("longitude");
    std::vector<double> time_raw = file_->read_var_1d_double("time");

    if (!time_raw.empty()) {
        meta_.timestamp_epoch_sec = time_raw[0];
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

std::vector<float> CMEMSLoader::read_surface_slice(
    CanonicalVar var,
    uint32_t stride_lat,
    uint32_t stride_lon
) {
    const char* src_name = map_canonical_to_cmems(var);
    if (!src_name) {
        throw std::invalid_argument("Requested variable is not supported in CMEMS: " + 
                                    std::to_string(static_cast<int>(var)));
    }

    int varid = file_->get_var_id(src_name);

    if (stride_lat == 0) stride_lat = 1;
    if (stride_lon == 0) stride_lon = 1;

    // CMEMS 4D structure: (time, depth, latitude, longitude)
    // or mlotst 3D: (time, latitude, longitude)
    bool is_3d = (var == CanonicalVar::MLD);

    const size_t out_lat_count = (meta_.lat_count + stride_lat - 1) / stride_lat;
    const size_t out_lon_count = (meta_.lon_count + stride_lon - 1) / stride_lon;
    const size_t total_out = out_lat_count * out_lon_count;

    std::vector<float> buffer(total_out);

    if (is_3d) {
        size_t start[3] = {0, meta_.lat_start_idx, meta_.lon_start_idx};
        size_t count[3] = {1, out_lat_count, out_lon_count};
        ptrdiff_t stride[3] = {1, static_cast<ptrdiff_t>(stride_lat), static_cast<ptrdiff_t>(stride_lon)};
        file_->read_hyperslab_float(varid, start, count, stride, buffer.data());
    } else {
        size_t start[4] = {0, 0, meta_.lat_start_idx, meta_.lon_start_idx};
        size_t count[4] = {1, 1, out_lat_count, out_lon_count};
        ptrdiff_t stride[4] = {1, 1, static_cast<ptrdiff_t>(stride_lat), static_cast<ptrdiff_t>(stride_lon)};
        file_->read_hyperslab_float(varid, start, count, stride, buffer.data());
    }

    // Sanitize missing/NaN values
    for (float& v : buffer) {
        v = Missing::sanitize(v);
    }

    if (stride_lat > 1 || stride_lon > 1) {
        AuditLogger::instance().log_decimation(
            "CMEMS_" + std::string(src_name),
            meta_.lat_count * meta_.lon_count,
            total_out,
            std::max(stride_lat, stride_lon)
        );
    }

    return buffer;
}

} // namespace ocean
