#include "ocean/query/query_interface.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include "ocean/common/missing.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace ocean {

namespace {

size_t find_nearest_index(const std::vector<float>& vec, float target) {
    if (vec.empty()) return 0;
    auto it = std::lower_bound(vec.begin(), vec.end(), target);
    if (it == vec.end()) return vec.size() - 1;
    if (it == vec.begin()) return 0;
    auto prev = it - 1;
    if (std::abs(target - *prev) <= std::abs(target - *it)) {
        return static_cast<size_t>(std::distance(vec.begin(), prev));
    }
    return static_cast<size_t>(std::distance(vec.begin(), it));
}

bool is_roms_variable(CanonicalVar var) noexcept {
    switch (var) {
        case CanonicalVar::CHL:
        case CanonicalVar::NO3:
        case CanonicalVar::DIC:
        case CanonicalVar::PCO2_ORIG:
        case CanonicalVar::PCO2_INT:
        case CanonicalVar::PCO2_CLIM:
        case CanonicalVar::PCO2_UNCERT:
            return true;
        default:
            return false;
    }
}

} // anonymous namespace

QueryInterface::QueryInterface(
    std::shared_ptr<CMEMSLoader> cmems,
    std::shared_ptr<ROMSLoader> roms,
    std::shared_ptr<PointCloudBuffer> in_situ_points
)
    : cmems_(std::move(cmems)),
      roms_(std::move(roms)),
      in_situ_(std::move(in_situ_points)) {}

std::optional<float> QueryInterface::get_surface_value_at(
    double lat_deg,
    double lon_deg,
    CanonicalVar var,
    size_t time_step_idx
) const {
    if (!SpatialFilter::is_in_region(lat_deg, lon_deg)) {
        return std::nullopt;
    }

    // Determine target source:
    // If var is unique to ROMS or time_step_idx > 0, query ROMS.
    if ((is_roms_variable(var) || time_step_idx > 0) && roms_) {
        const auto& meta = roms_->metadata();
        if (time_step_idx >= meta.time_steps) {
            return std::nullopt;
        }

        size_t lat_idx = find_nearest_index(meta.clipped_latitudes, static_cast<float>(lat_deg));
        size_t lon_idx = find_nearest_index(meta.clipped_longitudes, static_cast<float>(lon_deg));

        auto slice = roms_->read_surface_slice(var, time_step_idx);
        size_t idx = lat_idx * meta.lon_count + lon_idx;
        if (idx < slice.size() && !Missing::is_missing(slice[idx])) {
            return slice[idx];
        }
        return std::nullopt;
    }

    // Query CMEMS (single keyframe at z=0)
    if (cmems_) {
        const auto& meta = cmems_->metadata();
        size_t lat_idx = find_nearest_index(meta.clipped_latitudes, static_cast<float>(lat_deg));
        size_t lon_idx = find_nearest_index(meta.clipped_longitudes, static_cast<float>(lon_deg));

        auto slice = cmems_->read_surface_slice(var);
        size_t idx = lat_idx * meta.lon_count + lon_idx;
        if (idx < slice.size() && !Missing::is_missing(slice[idx])) {
            return slice[idx];
        }
    }

    return std::nullopt;
}

std::optional<PCO2Measurement> QueryInterface::get_pco2_at(
    double lat_deg,
    double lon_deg,
    CanonicalVar flavor,
    size_t time_step_idx
) const {
    if (!roms_ || !SpatialFilter::is_in_region(lat_deg, lon_deg)) {
        return std::nullopt;
    }

    if (flavor != CanonicalVar::PCO2_ORIG &&
        flavor != CanonicalVar::PCO2_INT &&
        flavor != CanonicalVar::PCO2_CLIM) {
        return std::nullopt;
    }

    const auto& meta = roms_->metadata();
    if (time_step_idx >= meta.time_steps) {
        return std::nullopt;
    }

    size_t lat_idx = find_nearest_index(meta.clipped_latitudes, static_cast<float>(lat_deg));
    size_t lon_idx = find_nearest_index(meta.clipped_longitudes, static_cast<float>(lon_deg));
    size_t cell_idx = lat_idx * meta.lon_count + lon_idx;

    auto val_slice = roms_->read_surface_slice(flavor, time_step_idx);
    if (cell_idx >= val_slice.size() || Missing::is_missing(val_slice[cell_idx])) {
        return std::nullopt;
    }

    PCO2Measurement meas;
    meas.flavor = flavor;
    meas.value = val_slice[cell_idx];
    meas.timestamp_epoch_sec = meta.time_epochs_sec[time_step_idx];

    // Explicit Deviant_uncertainty pairing policy:
    // Only pairs with PCO2_INT and PCO2_CLIM; PCO2_ORIG has NO assimilation uncertainty.
    if (flavor == CanonicalVar::PCO2_INT || flavor == CanonicalVar::PCO2_CLIM) {
        auto uncert_slice = roms_->read_surface_slice(CanonicalVar::PCO2_UNCERT, time_step_idx);
        if (cell_idx < uncert_slice.size() && !Missing::is_missing(uncert_slice[cell_idx])) {
            meas.deviant_uncertainty_1sigma = uncert_slice[cell_idx];
        } else {
            meas.deviant_uncertainty_1sigma = std::nullopt;
        }
    } else {
        meas.deviant_uncertainty_1sigma = std::nullopt;
    }

    return meas;
}

std::vector<TimeSeriesPoint> QueryInterface::get_surface_timeseries(
    double lat_deg,
    double lon_deg,
    CanonicalVar var
) const {
    std::vector<TimeSeriesPoint> result;
    if (!roms_ || !SpatialFilter::is_in_region(lat_deg, lon_deg)) {
        return result;
    }

    const auto& meta = roms_->metadata();
    size_t lat_idx = find_nearest_index(meta.clipped_latitudes, static_cast<float>(lat_deg));
    size_t lon_idx = find_nearest_index(meta.clipped_longitudes, static_cast<float>(lon_deg));

    auto series = roms_->read_point_timeseries(var, lat_idx, lon_idx);
    result.resize(series.size());

    for (size_t t = 0; t < series.size(); ++t) {
        result[t].timestamp_epoch_sec = meta.time_epochs_sec[t];
        result[t].value = series[t];
        result[t].is_valid = !Missing::is_missing(series[t]);
    }

    return result;
}

std::vector<DepthProfilePoint> QueryInterface::get_float_profile(
    const std::string& platform_id,
    int32_t cycle_number,
    CanonicalVar var
) const {
    std::vector<DepthProfilePoint> result;
    if (!in_situ_) return result;

    for (const auto& pt : in_situ_->points()) {
        if (pt.variable == var &&
            pt.platform_id == platform_id &&
            pt.cycle_number == cycle_number) {
            DepthProfilePoint dp;
            // Authentic TEOS-10 physical depth in meters below sea surface
            dp.depth_m = pt.depth_m;
            dp.value = pt.value;
            dp.qc = pt.qc;
            dp.is_valid = true;
            result.push_back(dp);
        }
    }

    std::sort(result.begin(), result.end(), [](const DepthProfilePoint& a, const DepthProfilePoint& b) {
        return a.depth_m < b.depth_m;
    });

    return result;
}

} // namespace ocean
