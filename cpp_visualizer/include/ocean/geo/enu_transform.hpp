#pragma once

#include "ocean/common/types.hpp"
#include "ocean/common/constants.hpp"

namespace ocean {

/**
 * @brief Geodetic (WGS84) to Earth-Centered Earth-Fixed (ECEF) to Local East-North-Up (ENU).
 */
class ENUTransformer {
public:
    explicit ENUTransformer(
        double origin_lat_deg = Constants::ENU_ORIGIN_LAT,
        double origin_lon_deg = Constants::ENU_ORIGIN_LON,
        double origin_alt_m   = Constants::ENU_ORIGIN_ALT
    );

    /**
     * @brief Forward transform: Geodetic (lat, lon, z) to Local ENU (east, north, up).
     * @param lat_deg Latitude [-90.0, 90.0]
     * @param lon_deg Longitude [-180.0, 180.0]
     * @param z_m Height z in meters (negative below sea surface)
     */
    ENUCoord geodetic_to_enu(double lat_deg, double lon_deg, double z_m) const noexcept;

    /**
     * @brief Inverse transform: Local ENU (east, north, up) to Geodetic (lat, lon, z).
     */
    GeodeticCoord enu_to_geodetic(const ENUCoord& enu) const noexcept;

    double origin_lat() const noexcept { return origin_lat_deg_; }
    double origin_lon() const noexcept { return origin_lon_deg_; }
    double origin_alt() const noexcept { return origin_alt_m_; }

private:
    double origin_lat_deg_;
    double origin_lon_deg_;
    double origin_alt_m_;

    // Precomputed ECEF origin
    double x0_{0.0};
    double y0_{0.0};
    double z0_{0.0};

    // Precomputed rotation matrix coefficients
    double sin_lat_{0.0};
    double cos_lat_{0.0};
    double sin_lon_{0.0};
    double cos_lon_{0.0};

    static void geodetic_to_ecef(double lat_deg, double lon_deg, double alt_m,
                                 double& x, double& y, double& z) noexcept;
    static void ecef_to_geodetic(double x, double y, double z,
                                 double& lat_deg, double& lon_deg, double& alt_m) noexcept;
};

} // namespace ocean
