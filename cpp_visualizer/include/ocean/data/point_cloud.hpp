#pragma once

#include "ocean/common/types.hpp"
#include <vector>
#include <cstddef>

namespace ocean {

/**
 * @brief Continuous buffer of real in-situ observation points in the local ENU frame.
 */
class PointCloudBuffer {
public:
    PointCloudBuffer() = default;

    void add_point(const ObservationPoint& pt);
    void reserve(size_t n);
    void clear();

    size_t size() const noexcept { return points_.size(); }
    bool empty() const noexcept { return points_.empty(); }

    const std::vector<ObservationPoint>& points() const noexcept { return points_; }
    const ObservationPoint& operator[](size_t idx) const noexcept { return points_[idx]; }

    void get_bounds(
        double& min_east, double& max_east,
        double& min_north, double& max_north,
        double& min_up, double& max_up
    ) const noexcept;

private:
    std::vector<ObservationPoint> points_;
};

} // namespace ocean
