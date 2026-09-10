#pragma once

#include "ocean/common/types.hpp"
#include "ocean/io/netcdf_wrapper.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include <memory>
#include <vector>

namespace ocean {

struct CMEMSGridMetadata {
    size_t lat_start_idx{0};
    size_t lat_count{0};
    size_t lon_start_idx{0};
    size_t lon_count{0};

    std::vector<float> clipped_latitudes;
    std::vector<float> clipped_longitudes;
    double timestamp_epoch_sec{0.0};
};

/**
 * @brief Streaming loader for CMEMS gridded surface fields via hyperslab reads.
 */
class CMEMSLoader {
public:
    explicit CMEMSLoader(const std::string& filepath);

    const CMEMSGridMetadata& metadata() const noexcept { return meta_; }

    /**
     * @brief Stream a 2D surface slice clipped to the Indian Ocean region.
     * @param var Canonical variable to stream
     * @param stride_lat Integer stride decimation in latitude
     * @param stride_lon Integer stride decimation in longitude
     * @return std::vector<float> Stride-decimated buffer containing real values or NaNs.
     */
    std::vector<float> read_surface_slice(
        CanonicalVar var,
        uint32_t stride_lat = 1,
        uint32_t stride_lon = 1
    );

private:
    std::unique_ptr<NetCDFFile> file_;
    CMEMSGridMetadata meta_;

    void parse_grid();
};

} // namespace ocean
