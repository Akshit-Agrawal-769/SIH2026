#include "ocean/data/volume_buffer.hpp"
#include <limits>

namespace ocean {

SurfaceSheetBuffer::SurfaceSheetBuffer(
    size_t width,
    size_t height,
    CanonicalVar var,
    double timestamp_epoch_sec
)
    : width_(width),
      height_(height),
      var_(var),
      timestamp_sec_(timestamp_epoch_sec),
      data_(width * height, std::numeric_limits<float>::quiet_NaN()) {}

float SurfaceSheetBuffer::get_cell(size_t x, size_t y) const noexcept {
    if (x >= width_ || y >= height_) {
        return std::numeric_limits<float>::quiet_NaN();
    }
    return data_[y * width_ + x];
}

void SurfaceSheetBuffer::set_cell(size_t x, size_t y, float val) noexcept {
    if (x < width_ && y < height_) {
        data_[y * width_ + x] = val;
    }
}

} // namespace ocean
