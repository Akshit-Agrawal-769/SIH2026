#include "ocean/geo/enu_transform.hpp"
#include <cmath>
#include <numbers>

namespace ocean {

namespace {
constexpr double deg2rad = std::numbers::pi / 180.0;
constexpr double rad2deg = 180.0 / std::numbers::pi;

inline double M_meridional(double lat_deg) noexcept {
    const double phi = lat_deg * deg2rad;
    const double s = std::sin(phi);
    const double num = Constants::WGS84_A * (1.0 - Constants::WGS84_E2);
    const double denom = std::pow(1.0 - Constants::WGS84_E2 * s * s, 1.5);
    return num / denom;
}

inline double N_prime_vertical(double lat_deg) noexcept {
    const double phi = lat_deg * deg2rad;
    const double s = std::sin(phi);
    return Constants::WGS84_A / std::sqrt(1.0 - Constants::WGS84_E2 * s * s);
}
} // anonymous namespace

ENUTransformer::ENUTransformer(
    double origin_lat_deg,
    double origin_lon_deg,
    double origin_alt_m
) : origin_lat_deg_(origin_lat_deg),
    origin_lon_deg_(origin_lon_deg),
    origin_alt_m_(origin_alt_m)
{
    const double phi0 = origin_lat_deg * deg2rad;
    const double lam0 = origin_lon_deg * deg2rad;

    sin_lat_ = std::sin(phi0);
    cos_lat_ = std::cos(phi0);
    sin_lon_ = std::sin(lam0);
    cos_lon_ = std::cos(lam0);

    geodetic_to_ecef(origin_lat_deg_, origin_lon_deg_, origin_alt_m_, x0_, y0_, z0_);
}

void ENUTransformer::geodetic_to_ecef(
    double lat_deg, double lon_deg, double alt_m,
    double& x, double& y, double& z
) noexcept {
    const double phi = lat_deg * deg2rad;
    const double lam = lon_deg * deg2rad;

    const double sin_p = std::sin(phi);
    const double cos_p = std::cos(phi);
    const double sin_l = std::sin(lam);
    const double cos_l = std::cos(lam);

    const double N = Constants::WGS84_A / std::sqrt(1.0 - Constants::WGS84_E2 * sin_p * sin_p);

    x = (N + alt_m) * cos_p * cos_l;
    y = (N + alt_m) * cos_p * sin_l;
    z = (N * (1.0 - Constants::WGS84_E2) + alt_m) * sin_p;
}

void ENUTransformer::ecef_to_geodetic(
    double x, double y, double z,
    double& lat_deg, double& lon_deg, double& alt_m
) noexcept {
    const double p = std::sqrt(x * x + y * y);
    if (p < 1e-6) {
        lat_deg = (z >= 0.0) ? 90.0 : -90.0;
        lon_deg = 0.0;
        alt_m = std::abs(z) - Constants::WGS84_B;
        return;
    }

    const double theta = std::atan2(z * Constants::WGS84_A, p * Constants::WGS84_B);
    const double sin_t = std::sin(theta);
    const double cos_t = std::cos(theta);

    constexpr double e_prime_2 = (Constants::WGS84_A * Constants::WGS84_A - Constants::WGS84_B * Constants::WGS84_B) /
                                 (Constants::WGS84_B * Constants::WGS84_B);

    const double phi = std::atan2(
        z + e_prime_2 * Constants::WGS84_B * sin_t * sin_t * sin_t,
        p - Constants::WGS84_E2 * Constants::WGS84_A * cos_t * cos_t * cos_t
    );

    const double lam = std::atan2(y, x);
    const double sin_p = std::sin(phi);
    const double cos_p = std::cos(phi);
    const double N = Constants::WGS84_A / std::sqrt(1.0 - Constants::WGS84_E2 * sin_p * sin_p);

    alt_m = p / cos_p - N;
    lat_deg = phi * rad2deg;
    lon_deg = lam * rad2deg;
}

ENUCoord ENUTransformer::geodetic_to_enu(double lat_deg, double lon_deg, double z_m) const noexcept {
    // Oceanographic Topocentric Projection:
    // Computes ellipsoidal horizontal coordinates (East, North) relative to the centroid (origin_lat, origin_lon)
    // while strictly preserving the true physical ocean vertical depth z_m (sea surface at z=0, depths negative).
    // This prevents Earth curvature drop (which reaches ~400 km across a 7000 km basin) from corrupting the ocean vertical axis.
    const double d_lat_rad = (lat_deg - origin_lat_deg_) * deg2rad;
    const double d_lon_rad = (lon_deg - origin_lon_deg_) * deg2rad;
    const double lat_mid = 0.5 * (lat_deg + origin_lat_deg_);

    const double M = M_meridional(lat_mid);
    const double N = N_prime_vertical(lat_deg);

    ENUCoord enu;
    enu.east_m  = N * std::cos(lat_deg * deg2rad) * d_lon_rad;
    enu.north_m = M * d_lat_rad;
    enu.up_m    = z_m; // Strictly preserve physical depth z_m [m]

    return enu;
}

GeodeticCoord ENUTransformer::enu_to_geodetic(const ENUCoord& enu) const noexcept {
    // Inverse transformation solving for latitude and longitude from East/North distance
    double lat = origin_lat_deg_;
    for (int iter = 0; iter < 5; ++iter) {
        const double lat_mid = 0.5 * (lat + origin_lat_deg_);
        const double M = M_meridional(lat_mid);
        lat = origin_lat_deg_ + (enu.north_m / M) * rad2deg;
    }

    const double N = N_prime_vertical(lat);
    const double cos_lat = std::cos(lat * deg2rad);
    const double lon = (std::abs(cos_lat) > 1e-12) 
        ? origin_lon_deg_ + (enu.east_m / (N * cos_lat)) * rad2deg 
        : origin_lon_deg_;

    GeodeticCoord geo;
    geo.latitude_deg = lat;
    geo.longitude_deg = lon;
    geo.depth_m = enu.up_m;

    return geo;
}

} // namespace ocean
