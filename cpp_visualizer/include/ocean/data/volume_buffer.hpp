#pragma once

#include "ocean/common/types.hpp"
#include <vector>
#include <cstddef>
#include <string>

namespace ocean {

/**
 * @brief Structured 2D surface buffer representing a horizontal sheet at z=0 over time.
 * 
 * In accordance with Data Integrity Policy:
 * Values are strictly from source model files. Cells with no data or land masks
 * contain IEEE NaN, rendering with alpha=0 (never zero-filled or synthesized).
 */
class SurfaceSheetBuffer {
public:
    SurfaceSheetBuffer(
        size_t width,
        size_t height,
        CanonicalVar var,
        double timestamp_epoch_sec
    );

    size_t width() const noexcept { return width_; }
    size_t height() const noexcept { return height_; }
    size_t total_cells() const noexcept { return data_.size(); }
    CanonicalVar variable() const noexcept { return var_; }
    double timestamp() const noexcept { return timestamp_sec_; }

    float* data() noexcept { return data_.data(); }
    const float* data() const noexcept { return data_.data(); }

    float get_cell(size_t x, size_t y) const noexcept;
    void set_cell(size_t x, size_t y, float val) noexcept;

private:
    size_t width_{0};
    size_t height_{0};
    CanonicalVar var_;
    double timestamp_sec_{0.0};
    std::vector<float> data_;
};

} // namespace ocean
