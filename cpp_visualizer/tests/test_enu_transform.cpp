#include "ocean/geo/enu_transform.hpp"
#include "ocean/common/constants.hpp"
#include <iostream>
#include <cassert>
#include <cmath>

void test_origin() {
    ocean::ENUTransformer transformer(
        ocean::Constants::REGION_CENTROID_LAT,
        ocean::Constants::REGION_CENTROID_LON,
        ocean::Constants::REGION_CENTROID_ALT
    );

    auto enu = transformer.geodetic_to_enu(5.0, 75.0, 0.0);
    assert(std::abs(enu.east_m) < 1e-6);
    assert(std::abs(enu.north_m) < 1e-6);
    assert(std::abs(enu.up_m) < 1e-6);
    std::cout << "[PASS] Origin geodetic_to_enu produces (0, 0, 0)\n";
}

void test_round_trip() {
    ocean::ENUTransformer transformer;

    struct TestCase {
        double lat;
        double lon;
        double h;
    };

    std::vector<TestCase> test_cases = {
        {5.0, 75.0, 0.0},
        {10.0, 80.0, -1500.0},
        {-5.0, 60.0, -3250.0},
        {20.0, 65.0, 10.0},
        {-8.0, 95.0, -5000.0}
    };

    for (const auto& tc : test_cases) {
        auto enu = transformer.geodetic_to_enu(tc.lat, tc.lon, tc.h);
        auto geo = transformer.enu_to_geodetic(enu);

        double d_lat = std::abs(geo.latitude_deg - tc.lat);
        double d_lon = std::abs(geo.longitude_deg - tc.lon);
        double d_h = std::abs(geo.depth_m - tc.h);

        // Precision must be sub-millimeter (< 1e-3 m, or < 1e-8 deg)
        assert(d_lat < 1e-8);
        assert(d_lon < 1e-8);
        assert(d_h < 1e-3);
    }
    std::cout << "[PASS] Geodetic <-> ENU round-trip precision < 1 mm verified\n";
}

void test_cardinal_directions() {
    ocean::ENUTransformer transformer;

    // Moving North
    auto pt_north = transformer.geodetic_to_enu(6.0, 75.0, 0.0);
    assert(pt_north.north_m > 100000.0); // ~111 km
    assert(std::abs(pt_north.east_m) < 1000.0);

    // Moving East
    auto pt_east = transformer.geodetic_to_enu(5.0, 76.0, 0.0);
    assert(pt_east.east_m > 100000.0);  // ~110 km at 5 deg N
    assert(std::abs(pt_east.north_m) < 1000.0);

    // Moving Up (above sea level)
    auto pt_up = transformer.geodetic_to_enu(5.0, 75.0, 500.0);
    assert(std::abs(pt_up.up_m - 500.0) < 1e-3);

    std::cout << "[PASS] Cardinal ENU direction axes verified\n";
}

int main() {
    std::cout << "--- Running ENU Transform Test Suite ---\n";
    test_origin();
    test_round_trip();
    test_cardinal_directions();
    std::cout << "All ENU transform tests PASSED successfully.\n";
    return 0;
}
