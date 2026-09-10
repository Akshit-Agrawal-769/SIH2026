#pragma once

#include "ocean/common/constants.hpp"
#include <vector>
#include <cstddef>
#include <utility>

namespace ocean {

struct BoundingBox {
    double min_lat{Constants::REGION_MIN_LAT};
    double max_lat{Constants::REGION_MAX_LAT};
    double min_lon{Constants::REGION_MIN_LON};
    double max_lon{Constants::REGION_MAX_LON};

    bool contains(double lat, double lon) const noexcept {
        return (lat >= min_lat && lat <= max_lat && lon >= min_lon && lon <= max_lon);
    }
};

class SpatialFilter {
public:
    static bool is_in_region(double lat, double lon) noexcept {
        static constexpr BoundingBox kDefaultBox{};
        return kDefaultBox.contains(lat, lon);
    }

    /**
     * @brief Finds continuous 1D index range [start_idx, count] for coordinate array.
     */
    static std::pair<size_t, size_t> find_clamped_index_range(
        const std::vector<float>& coords,
        double min_val,
        double max_val
    );

    static std::pair<size_t, size_t> find_clamped_index_range(
        const std::vector<double>& coords,
        double min_val,
        double max_val
    );
};

} // namespace ocean
