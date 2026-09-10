#include "ocean/data/point_cloud.hpp"
#include <algorithm>
#include <limits>

namespace ocean {

void PointCloudBuffer::add_point(const ObservationPoint& pt) {
    points_.push_back(pt);
}

void PointCloudBuffer::reserve(size_t n) {
    points_.reserve(n);
}

void PointCloudBuffer::clear() {
    points_.clear();
}

void PointCloudBuffer::get_bounds(
    double& min_east, double& max_east,
    double& min_north, double& max_north,
    double& min_up, double& max_up
) const noexcept {
    if (points_.empty()) {
        min_east = max_east = 0.0;
        min_north = max_north = 0.0;
        min_up = max_up = 0.0;
        return;
    }

    min_east = std::numeric_limits<double>::infinity();
    max_east = -std::numeric_limits<double>::infinity();
    min_north = std::numeric_limits<double>::infinity();
    max_north = -std::numeric_limits<double>::infinity();
    min_up = std::numeric_limits<double>::infinity();
    max_up = -std::numeric_limits<double>::infinity();

    for (const auto& pt : points_) {
        min_east = std::min(min_east, pt.position.east_m);
        max_east = std::max(max_east, pt.position.east_m);
        min_north = std::min(min_north, pt.position.north_m);
        max_north = std::max(max_north, pt.position.north_m);
        min_up = std::min(min_up, pt.position.up_m);
        max_up = std::max(max_up, pt.position.up_m);
    }
}

} // namespace ocean
