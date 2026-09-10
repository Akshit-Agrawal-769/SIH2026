#pragma once

#include "ocean/common/types.hpp"
#include "ocean/io/cmems_loader.hpp"
#include "ocean/io/roms_loader.hpp"
#include "ocean/data/point_cloud.hpp"
#include <optional>
#include <vector>
#include <memory>

namespace ocean {

struct TimeSeriesPoint {
    double timestamp_epoch_sec{0.0};
    float value{0.0f};
    bool is_valid{false};
};

struct DepthProfilePoint {
    double depth_m{0.0};
    float value{0.0f};
    QCFlag qc{QCFlag::GOOD};
    bool is_valid{false};
};

/**
 * @brief Common Query Interface for the Graph Mapper & 3D Visualizer.
 * 
 * Strict Data Integrity Policy:
 * Queries return only authentic values extracted directly from the files or caches.
 * When data is absent or rejected by QC, queries return std::nullopt or invalid flags.
 * NEVER fabricates or linearly interpolates missing numbers.
 */
class QueryInterface {
public:
    QueryInterface(
        std::shared_ptr<CMEMSLoader> cmems,
        std::shared_ptr<ROMSLoader> roms,
        std::shared_ptr<PointCloudBuffer> in_situ_points
    );

    /**
     * @brief Queries surface value at a specific geographical location and time step.
     */
    std::optional<float> get_surface_value_at(
        double lat_deg,
        double lon_deg,
        CanonicalVar var,
        size_t time_step_idx = 0
    ) const;

    /**
     * @brief Queries pCO2 with explicitly paired deviant uncertainty.
     * 
     * PAIRING POLICY:
     * - If flavor == PCO2_INT or PCO2_CLIM: deviant_uncertainty_1sigma contains the
     *   exact value read from Deviant_uncertainty at this (lat, lon, time).
     * - If flavor == PCO2_ORIG: deviant_uncertainty_1sigma is std::nullopt because
     *   pCO2_Original is direct numerical model output with NO deviant assimilation.
     */
    std::optional<PCO2Measurement> get_pco2_at(
        double lat_deg,
        double lon_deg,
        CanonicalVar flavor,
        size_t time_step_idx = 0
    ) const;

    /**
     * @brief Extracts time-series of a surface variable at a station over all 480 monthly steps.
     */
    std::vector<TimeSeriesPoint> get_surface_timeseries(
        double lat_deg,
        double lon_deg,
        CanonicalVar var
    ) const;

    /**
     * @brief Extracts vertical profile vs depth at an in-situ float station.
     */
    std::vector<DepthProfilePoint> get_float_profile(
        const std::string& platform_id,
        int32_t cycle_number,
        CanonicalVar var
    ) const;

private:
    std::shared_ptr<CMEMSLoader> cmems_;
    std::shared_ptr<ROMSLoader> roms_;
    std::shared_ptr<PointCloudBuffer> in_situ_;
};

} // namespace ocean
