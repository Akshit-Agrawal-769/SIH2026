#pragma once

#include "ocean/common/types.hpp"
#include <vector>
#include <cstddef>
#include <cstdint>

namespace ocean {

/**
 * @brief Level-of-Detail Decimator enforcing the Strict Data Integrity Policy.
 * 
 * STRICT RULES:
 * - Decimates exclusively via integer stride sub-sampling or nearest-point selection.
 * - NEVER averages, interpolates, or creates values not present verbatim in source data.
 * - Every decimated sample is guaranteed to be an authentic physical measurement.
 */
class LODDecimator {
public:
    /**
     * @brief Stride decimation of a 1D observation point buffer.
     * @param input Raw points from source files
     * @param stride Integer sampling step (stride >= 1)
     * @return std::vector<ObservationPoint> Sub-sampled points.
     */
    static std::vector<ObservationPoint> decimate_points_stride(
        const std::vector<ObservationPoint>& input,
        uint32_t stride
    );

    /**
     * @brief Stride decimation of a 2D structured grid.
     * @param input Raw 2D array of size (width * height)
     * @param width Source grid width
     * @param height Source grid height
     * @param stride_x Stride along X axis (>= 1)
     * @param stride_y Stride along Y axis (>= 1)
     * @param[out] out_width New decimated width
     * @param[out] out_height New decimated height
     * @return std::vector<float> Decimated grid cells with exact raw values.
     */
    static std::vector<float> decimate_grid_stride(
        const std::vector<float>& input,
        size_t width,
        size_t height,
        uint32_t stride_x,
        uint32_t stride_y,
        size_t& out_width,
        size_t& out_height
    );
};

} // namespace ocean
