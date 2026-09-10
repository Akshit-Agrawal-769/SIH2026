#pragma once

#include "ocean/common/types.hpp"
#include "ocean/io/netcdf_wrapper.hpp"
#include <memory>
#include <vector>

namespace ocean {

struct ROMSGridMetadata {
    size_t lat_start_idx{0};
    size_t lat_count{0};
    size_t lon_start_idx{0};
    size_t lon_count{0};
    size_t time_steps{0};

    std::vector<float> clipped_latitudes;
    std::vector<float> clipped_longitudes;
    std::vector<double> time_epochs_sec;
};

/**
 * @brief Streaming loader for INCOIS-BIO-ROMS 2D surface fields over 480 time steps.
 */
class ROMSLoader {
public:
    explicit ROMSLoader(const std::string& filepath);

    const ROMSGridMetadata& metadata() const noexcept { return meta_; }

    /**
     * @brief Stream a 2D surface sheet for a given time step index.
     */
    std::vector<float> read_surface_slice(
        CanonicalVar var,
        size_t time_idx,
        uint32_t stride_lat = 1,
        uint32_t stride_lon = 1
    );

    /**
     * @brief Stream full time-series at a specific grid coordinate (lat_idx, lon_idx).
     */
    std::vector<float> read_point_timeseries(
        CanonicalVar var,
        size_t lat_idx,
        size_t lon_idx
    );

private:
    std::unique_ptr<NetCDFFile> file_;
    ROMSGridMetadata meta_;

    void parse_grid();
};

} // namespace ocean
