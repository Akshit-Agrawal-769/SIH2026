#pragma once

namespace ocean {

struct Constants {
    // WGS84 Reference Ellipsoid Parameters
    static constexpr double WGS84_A = 6378137.0;            // Semi-major axis [m]
    static constexpr double WGS84_F = 1.0 / 298.257223563;  // Flattening
    static constexpr double WGS84_B = WGS84_A * (1.0 - WGS84_F); // Semi-minor axis [m]
    static constexpr double WGS84_E2 = 2.0 * WGS84_F - WGS84_F * WGS84_F; // First eccentricity squared

    // Indian Ocean Study Region Bounding Box
    static constexpr double REGION_MIN_LAT = -10.0;
    static constexpr double REGION_MAX_LAT =  25.0;
    static constexpr double REGION_MIN_LON =  35.0;
    static constexpr double REGION_MAX_LON = 100.0;

    // Local East-North-Up (ENU) Frame Origin (Centroid)
    static constexpr double ENU_ORIGIN_LAT = 5.0;   // 5° N
    static constexpr double ENU_ORIGIN_LON = 75.0;  // 75° E
    static constexpr double ENU_ORIGIN_ALT = 0.0;   // Sea Surface

    // Aliases for centroid origin
    static constexpr double REGION_CENTROID_LAT = ENU_ORIGIN_LAT;
    static constexpr double REGION_CENTROID_LON = ENU_ORIGIN_LON;
    static constexpr double REGION_CENTROID_ALT = ENU_ORIGIN_ALT;

    // UNESCO / TEOS-10 Gravity & Depth Constants
    static constexpr double GSW_GAMMA = 2.184e-6;   // [m/s² / dbar]
    static constexpr double GSW_C1 = 9.72659;
    static constexpr double GSW_C2 = 2.2512e-5;
    static constexpr double GSW_C3 = 2.279e-10;
    static constexpr double GSW_C4 = 1.82e-15;

    // Time Origin Offsets
    // Argo JULD epoch is 1950-01-01 00:00:00 UTC
    // Unix epoch is 1970-01-01 00:00:00 UTC
    // Difference: 7305 days * 86400 seconds = 631152000.0 seconds
    static constexpr double JULD_TO_UNIX_OFFSET_SECONDS = 631152000.0;
};

} // namespace ocean
