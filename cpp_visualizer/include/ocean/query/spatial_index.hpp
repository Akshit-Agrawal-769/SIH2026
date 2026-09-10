#pragma once

#include "ocean/common/types.hpp"
#include "ocean/data/point_cloud.hpp"
#include <vector>
#include <unordered_map>
#include <cstddef>

namespace ocean {

/**
 * @brief Spatial binning index over in-situ observation point clouds.
 * 
 * Supports fast nearest-neighbor lookups without synthesizing or interpolating data.
 */
class SpatialIndex {
public:
    SpatialIndex(double cell_size_m = 50000.0); // 50 km default bin size

    void build(const PointCloudBuffer& buffer);

    /**
     * @brief Finds exact nearest observation point within max_radius_m.
     * Returns nullptr if no real measurement exists within the radius (no gap-filling).
     */
    const ObservationPoint* find_nearest(
        const ENUCoord& target,
        CanonicalVar var,
        double max_radius_m
    ) const noexcept;

    /**
     * @brief Finds all real observation points within a cylinder (radius + depth window).
     */
    std::vector<const ObservationPoint*> find_in_cylinder(
        const ENUCoord& center,
        double radius_m,
        double depth_half_window_m,
        CanonicalVar var
    ) const;

private:
    double cell_size_m_;
    const PointCloudBuffer* buffer_{nullptr};

    struct BinKey {
        int64_t x{0};
        int64_t y{0};
        bool operator==(const BinKey& o) const noexcept {
            return (x == o.x && y == o.y);
        }
    };

    struct BinKeyHash {
        size_t operator()(const BinKey& k) const noexcept {
            return std::hash<int64_t>{}(k.x) ^ (std::hash<int64_t>{}(k.y) << 1);
        }
    };

    std::unordered_map<BinKey, std::vector<size_t>, BinKeyHash> grid_;
};

} // namespace ocean
