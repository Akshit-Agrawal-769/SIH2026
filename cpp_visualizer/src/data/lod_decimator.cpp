#include "ocean/data/lod_decimator.hpp"
#include <algorithm>

namespace ocean {

std::vector<ObservationPoint> LODDecimator::decimate_points_stride(
    const std::vector<ObservationPoint>& input,
    uint32_t stride
) {
    if (stride <= 1) {
        return input;
    }

    std::vector<ObservationPoint> output;
    output.reserve((input.size() + stride - 1) / stride);

    for (size_t i = 0; i < input.size(); i += stride) {
        output.push_back(input[i]);
    }

    return output;
}

std::vector<float> LODDecimator::decimate_grid_stride(
    const std::vector<float>& input,
    size_t width,
    size_t height,
    uint32_t stride_x,
    uint32_t stride_y,
    size_t& out_width,
    size_t& out_height
) {
    if (stride_x == 0) stride_x = 1;
    if (stride_y == 0) stride_y = 1;

    out_width = (width + stride_x - 1) / stride_x;
    out_height = (height + stride_y - 1) / stride_y;

    std::vector<float> output;
    output.reserve(out_width * out_height);

    for (size_t y = 0; y < height; y += stride_y) {
        for (size_t x = 0; x < width; x += stride_x) {
            output.push_back(input[y * width + x]);
        }
    }

    return output;
}

} // namespace ocean
