#include "ocean/query/spatial_index.hpp"
#include <cmath>
#include <limits>

namespace ocean {

SpatialIndex::SpatialIndex(double cell_size_m)
    : cell_size_m_(cell_size_m > 0.0 ? cell_size_m : 50000.0) {}

void SpatialIndex::build(const PointCloudBuffer& buffer) {
    buffer_ = &buffer;
    grid_.clear();

    for (size_t i = 0; i < buffer.size(); ++i) {
        const auto& pt = buffer[i];
        int64_t bx = static_cast<int64_t>(std::floor(pt.position.east_m / cell_size_m_));
        int64_t by = static_cast<int64_t>(std::floor(pt.position.north_m / cell_size_m_));
        grid_[BinKey{bx, by}].push_back(i);
    }
}

const ObservationPoint* SpatialIndex::find_nearest(
    const ENUCoord& target,
    CanonicalVar var,
    double max_radius_m
) const noexcept {
    if (!buffer_ || buffer_->empty() || max_radius_m <= 0.0) {
        return nullptr;
    }

    const int64_t min_bx = static_cast<int64_t>(std::floor((target.east_m - max_radius_m) / cell_size_m_));
    const int64_t max_bx = static_cast<int64_t>(std::floor((target.east_m + max_radius_m) / cell_size_m_));
    const int64_t min_by = static_cast<int64_t>(std::floor((target.north_m - max_radius_m) / cell_size_m_));
    const int64_t max_by = static_cast<int64_t>(std::floor((target.north_m + max_radius_m) / cell_size_m_));

    const ObservationPoint* best = nullptr;
    double min_dist_sq = max_radius_m * max_radius_m;

    for (int64_t by = min_by; by <= max_by; ++by) {
        for (int64_t bx = min_bx; bx <= max_bx; ++bx) {
            auto it = grid_.find(BinKey{bx, by});
            if (it == grid_.end()) continue;

            for (size_t idx : it->second) {
                const auto& pt = (*buffer_)[idx];
                if (pt.variable != var) continue;

                const double dx = pt.position.east_m - target.east_m;
                const double dy = pt.position.north_m - target.north_m;
                const double dz = pt.position.up_m - target.up_m;
                const double dist_sq = dx * dx + dy * dy + dz * dz;

                if (dist_sq <= min_dist_sq) {
                    min_dist_sq = dist_sq;
                    best = &pt;
                }
            }
        }
    }

    return best;
}

std::vector<const ObservationPoint*> SpatialIndex::find_in_cylinder(
    const ENUCoord& center,
    double radius_m,
    double depth_half_window_m,
    CanonicalVar var
) const {
    std::vector<const ObservationPoint*> results;
    if (!buffer_ || buffer_->empty() || radius_m <= 0.0) {
        return results;
    }

    const int64_t min_bx = static_cast<int64_t>(std::floor((center.east_m - radius_m) / cell_size_m_));
    const int64_t max_bx = static_cast<int64_t>(std::floor((center.east_m + radius_m) / cell_size_m_));
    const int64_t min_by = static_cast<int64_t>(std::floor((center.north_m - radius_m) / cell_size_m_));
    const int64_t max_by = static_cast<int64_t>(std::floor((center.north_m + radius_m) / cell_size_m_));

    const double radius_sq = radius_m * radius_m;

    for (int64_t by = min_by; by <= max_by; ++by) {
        for (int64_t bx = min_bx; bx <= max_bx; ++bx) {
            auto it = grid_.find(BinKey{bx, by});
            if (it == grid_.end()) continue;

            for (size_t idx : it->second) {
                const auto& pt = (*buffer_)[idx];
                if (pt.variable != var) continue;

                const double dx = pt.position.east_m - center.east_m;
                const double dy = pt.position.north_m - center.north_m;
                const double h_dist_sq = dx * dx + dy * dy;

                if (h_dist_sq <= radius_sq) {
                    const double dz = std::abs(pt.position.up_m - center.up_m);
                    if (dz <= depth_half_window_m) {
                        results.push_back(&pt);
                    }
                }
            }
        }
    }

    return results;
}

} // namespace ocean
