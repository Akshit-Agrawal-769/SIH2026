#pragma once

#include <cmath>
#include <limits>
#include <type_traits>

namespace ocean {

/**
 * @brief Missing and invalid value handling enforcing strict data integrity.
 * 
 * In accordance with the Strict Data Integrity Policy:
 * Missing values or QC-rejected entries NEVER evaluate to 0.0 or synthetic defaults.
 * They are strictly represented as quiet NaN.
 */
struct Missing {
    static constexpr float kNaNFloat = std::numeric_limits<float>::quiet_NaN();
    static constexpr double kNaNDouble = std::numeric_limits<double>::quiet_NaN();
    
    static constexpr float kArgoFillFloat = 99999.0f;
    static constexpr double kArgoFillDouble = 99999.0;
    static constexpr double kArgoJuldFill = 999999.0;

    template <typename T>
    static inline bool is_missing(T val) noexcept {
        if constexpr (std::is_floating_point_v<T>) {
            if (std::isnan(val) || std::isinf(val)) return true;
            if (val <= static_cast<T>(-900.0) || val >= static_cast<T>(99900.0) || val >= static_cast<T>(1e19)) return true;
        }
        return false;
    }

    template <typename T>
    static inline T sanitize(T val) noexcept {
        if (is_missing(val)) {
            if constexpr (std::is_same_v<T, float>) {
                return kNaNFloat;
            } else {
                return kNaNDouble;
            }
        }
        return val;
    }
};

} // namespace ocean
