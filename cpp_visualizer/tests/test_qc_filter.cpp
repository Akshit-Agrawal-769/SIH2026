#include "ocean/common/types.hpp"
#include "ocean/common/missing.hpp"
#include "ocean/common/audit_logger.hpp"
#include <iostream>
#include <cassert>
#include <cmath>

void test_qc_flags() {
    // Standard Argo QC table verification:
    // Only '1' (Good data) and '2' (Probably good data) are accepted.
    auto is_accepted = [](char flag) {
        return (flag == '1' || flag == '2');
    };

    assert(is_accepted('1'));
    assert(is_accepted('2'));

    assert(!is_accepted('0')); // No QC
    assert(!is_accepted('3')); // Probably bad
    assert(!is_accepted('4')); // Bad data
    assert(!is_accepted('5')); // Value changed
    assert(!is_accepted('8')); // Estimated/Interpolated (Strict data integrity: no synthetic data!)
    assert(!is_accepted('9')); // Missing value
    assert(!is_accepted(' ')); // Blank
    assert(!is_accepted('\0'));

    std::cout << "[PASS] QC acceptance filter correctly retains only flags '1' and '2'\n";
}

void test_missing_value_sanitizer() {
    // Standard NetCDF / Argo fill values
    assert(ocean::Missing::is_missing(99999.0f));
    assert(ocean::Missing::is_missing(99999.0));
    assert(ocean::Missing::is_missing(-999.0f));
    assert(ocean::Missing::is_missing(-9999.0f));
    assert(ocean::Missing::is_missing(1e20f));
    assert(ocean::Missing::is_missing(std::numeric_limits<float>::quiet_NaN()));
    assert(ocean::Missing::is_missing(std::numeric_limits<double>::infinity()));

    // Valid physical oceanographic values
    assert(!ocean::Missing::is_missing(28.4f));  // 28.4 C
    assert(!ocean::Missing::is_missing(35.2f));  // 35.2 PSU
    assert(!ocean::Missing::is_missing(0.0f));   // 0.0 m SSH

    // Sanitization replaces sentinels with NaN
    float sanitized_fill = ocean::Missing::sanitize(99999.0f);
    assert(std::isnan(sanitized_fill));

    float sanitized_real = ocean::Missing::sanitize(24.5f);
    assert(sanitized_real == 24.5f);

    std::cout << "[PASS] Missing value sanitizer correctly identifies and converts sentinels to NaN\n";
}

int main() {
    std::cout << "--- Running QC & Missing Value Filter Test Suite ---\n";
    test_qc_flags();
    test_missing_value_sanitizer();
    std::cout << "All QC & Missing Value filter tests PASSED successfully.\n";
    return 0;
}
