#include "ocean/geo/spatial_filter.hpp"
#include <algorithm>

namespace ocean {

std::pair<size_t, size_t> SpatialFilter::find_clamped_index_range(
    const std::vector<float>& coords,
    double min_val,
    double max_val
) {
    if (coords.empty()) {
        return {0, 0};
    }

    size_t first = coords.size();
    size_t last = 0;
    bool found = false;

    for (size_t i = 0; i < coords.size(); ++i) {
        if (coords[i] >= static_cast<float>(min_val) && coords[i] <= static_cast<float>(max_val)) {
            if (!found) {
                first = i;
                found = true;
            }
            last = i;
        }
    }

    if (!found) {
        return {0, 0};
    }

    return {first, (last - first + 1)};
}

std::pair<size_t, size_t> SpatialFilter::find_clamped_index_range(
    const std::vector<double>& coords,
    double min_val,
    double max_val
) {
    if (coords.empty()) {
        return {0, 0};
    }

    size_t first = coords.size();
    size_t last = 0;
    bool found = false;

    for (size_t i = 0; i < coords.size(); ++i) {
        if (coords[i] >= min_val && coords[i] <= max_val) {
            if (!found) {
                first = i;
                found = true;
            }
            last = i;
        }
    }

    if (!found) {
        return {0, 0};
    }

    return {first, (last - first + 1)};
}

} // namespace ocean
