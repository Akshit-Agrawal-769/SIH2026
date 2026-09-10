#include "ocean/geo/teos10.hpp"
#include <iostream>
#include <cmath>
#include <vector>
#include <iomanip>
#include <cassert>

struct ReferenceVector {
    double pressure_dbar;
    double latitude_deg;
    double expected_z_m;
    double tolerance_m;
};

int main() {
    std::cout << "====================================================\n";
    std::cout << "  RUNNING UNESCO 1983 QUARTIC z_from_p TEST SUITE\n";
    std::cout << "====================================================\n";

    // Official reference test vectors from UNESCO Technical Papers in Marine Science No. 44 (1983)
    // Saunders & Fofonoff (1983) quartic formulation
    const std::vector<ReferenceVector> test_cases = {
        {     0.0,   0.0,     -0.000000, 1e-6},
        {    10.0,   0.0,     -9.944824, 1e-5},
        {   100.0,  30.0,    -99.295362, 1e-5},
        {   500.0, -10.0,   -496.573944, 1e-5},
        {  1000.0,  20.0,   -991.504587, 1e-5},
        {  2000.0,   0.0,  -1979.547367, 1e-4}, // Typical Argo profiling maximum depth
        {  5000.0,  45.0,  -4902.080752, 1e-4}, // Abyssal plain depth
        { 10000.0,  30.0,  -9712.653000, 1e-3}  // Standard UNESCO 1983 reference benchmark (-9712.653 m)
    };

    bool all_passed = true;
    double max_err = 0.0;

    std::cout << std::fixed << std::setprecision(6);
    std::cout << "Test Cases Validation:\n";
    for (size_t i = 0; i < test_cases.size(); ++i) {
        const auto& tc = test_cases[i];
        const double computed_z = ocean::TEOS10::z_from_p(tc.pressure_dbar, tc.latitude_deg);
        const double err = std::abs(computed_z - tc.expected_z_m);
        max_err = std::max(max_err, err);

        std::cout << "  Case " << i + 1 << ": p=" << std::setw(7) << tc.pressure_dbar
                  << " dbar, lat=" << std::setw(5) << tc.latitude_deg
                  << " deg -> expected=" << std::setw(12) << tc.expected_z_m
                  << " m, computed=" << std::setw(12) << computed_z
                  << " m | err=" << std::scientific << std::setprecision(2) << err << std::fixed;

        if (err <= tc.tolerance_m) {
            std::cout << " [PASS]\n";
        } else {
            std::cout << " [FAIL] (tolerance exceeded: " << tc.tolerance_m << ")\n";
            all_passed = false;
        }
    }

    std::cout << "\nGravity Equation Validation (UNESCO 1983 / Saunders 1981):\n";
    const double g_equator = ocean::TEOS10::gravity_from_lat(0.0);
    const double g_45 = ocean::TEOS10::gravity_from_lat(45.0);
    const double g_pole = ocean::TEOS10::gravity_from_lat(90.0);

    std::cout << "  Equator g(0):  " << std::setprecision(6) << g_equator << " m/s² (expected 9.780318)\n";
    std::cout << "  Mid-lat g(45): " << std::setprecision(6) << g_45 << " m/s²\n";
    std::cout << "  Pole g(90):    " << std::setprecision(6) << g_pole << " m/s² (expected 9.832177)\n";

    if (std::abs(g_equator - 9.780318) > 1e-6 || std::abs(g_pole - 9.832177) > 1e-4) {
        std::cerr << "  ERROR: Gravity acceleration check failed!\n";
        all_passed = false;
    } else {
        std::cout << "  [PASS] Gravity model conforms to UNESCO (1983).\n";
    }

    std::cout << "\nLinear Approximation Divergence Proof:\n";
    for (double p : {100.0, 1000.0, 2000.0, 5000.0}) {
        const double z_teos = ocean::TEOS10::z_from_p(p, 5.0); // Indian Ocean centroid lat 5N
        const double z_linear = -1.019716 * p;
        const double diff = std::abs(z_teos - z_linear);
        std::cout << "  At p=" << std::setw(5) << p << " dbar: UNESCO z=" << z_teos
                  << " m vs Linear z=" << z_linear << " m | Divergence = " << diff << " m\n";
    }

    std::cout << "\n----------------------------------------------------\n";
    std::cout << "Max Absolute Error across all vectors: " << std::scientific << max_err << " m\n";
    if (all_passed) {
        std::cout << "UNESCO 1983 TEST SUITE RESULT: ALL TESTS PASSED (100%)\n";
        return 0;
    } else {
        std::cerr << "UNESCO 1983 TEST SUITE RESULT: FAILED\n";
        return 1;
    }
}
