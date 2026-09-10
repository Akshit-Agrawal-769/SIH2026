#pragma once

namespace ocean {

/**
 * @brief UNESCO / TEOS-10 International Thermodynamic Equation of Seawater
 *        Latitude-dependent depth calculation from sea pressure (GSW z_from_p).
 * 
 * Strict Data Integrity:
 * Never uses linear approximations (e.g. z = -1.019716 * p).
 * Computes exact standard gravity from Somigliana's formula and 4th-order polynomial compression.
 */
class TEOS10 {
public:
    /**
     * @brief Computes height/depth z in meters from pressure in dbar and latitude in degrees.
     * 
     * @param pressure_dbar Sea pressure in decibars (p >= 0)
     * @param latitude_deg Latitude in degrees [-90.0 .. +90.0]
     * @return double Height z in meters (negative below sea level, z <= 0).
     */
    static double z_from_p(double pressure_dbar, double latitude_deg) noexcept;

    /**
     * @brief Computes positive depth in meters from pressure and latitude.
     */
    static double depth_from_p(double pressure_dbar, double latitude_deg) noexcept {
        return -z_from_p(pressure_dbar, latitude_deg);
    }

    /**
     * @brief Gravitational acceleration as a function of latitude using Somigliana's equation.
     */
    static double gravity_from_lat(double latitude_deg) noexcept;
};

} // namespace ocean
