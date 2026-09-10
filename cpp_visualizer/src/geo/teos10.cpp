#include "ocean/geo/teos10.hpp"
#include "ocean/common/constants.hpp"
#include <cmath>
#include <numbers>

namespace ocean {

double TEOS10::gravity_from_lat(double latitude_deg) noexcept {
    constexpr double deg2rad = std::numbers::pi / 180.0;
    const double sin_lat = std::sin(latitude_deg * deg2rad);
    const double sin2 = sin_lat * sin_lat;

    // UNESCO Technical Papers in Marine Science No. 44 (1983) / Saunders (1981)
    // Gravitational acceleration as a function of latitude on the international ellipsoid [m/s²]
    return 9.780318 * (1.0 + (5.2788e-3 + (2.36e-5 * sin2)) * sin2);
}

double TEOS10::z_from_p(double pressure_dbar, double latitude_deg) noexcept {
    if (pressure_dbar <= 0.0) {
        return 0.0;
    }

    // UNESCO 1983 / Saunders & Fofonoff (1983) 4-term quartic formula
    // Evaluates dynamic depth z [m] (negative in the ocean) from pressure p [dbar] and latitude phi.
    const double p = pressure_dbar;
    const double g = gravity_from_lat(latitude_deg);

    // Horner's scheme evaluation of the UNESCO quartic: c1*p - c2*p^2 + c3*p^3 - c4*p^4
    // num = ((((-c4 * p + c3) * p - c2) * p + c1) * p)
    const double num = ((((-Constants::GSW_C4 * p + Constants::GSW_C3) * p - 
                           Constants::GSW_C2) * p + Constants::GSW_C1) * p);

    const double denom = g + 0.5 * Constants::GSW_GAMMA * p;

    return -num / denom;
}

} // namespace ocean
