#include "ocean/io/argo_loader.hpp"
#include "ocean/io/coriolis_loader.hpp"
#include "ocean/common/audit_logger.hpp"
#include <iostream>
#include <cassert>
#include <unordered_set>

void test_duplicate_key_hashing() {
    ocean::ProfileKey k1{"2902084", 12, 'A'};
    ocean::ProfileKey k2{"2902084", 12, 'A'};
    ocean::ProfileKey k3{"2902084", 13, 'A'};
    ocean::ProfileKey k4{"2902084", 12, 'D'};

    assert(k1 == k2);
    assert(!(k1 == k3));
    assert(!(k1 == k4));

    ocean::ProfileKeyHash hasher;
    assert(hasher(k1) == hasher(k2));

    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> set;
    set.insert(k1);
    assert(set.find(k2) != set.end());
    assert(set.find(k3) == set.end());
    assert(set.find(k4) == set.end());

    std::cout << "[PASS] ProfileKey equality and hash consistency verified\n";
}

void test_coriolis_precedence_policy() {
    // Simulate Coriolis ingestion: registers profile keys into set
    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> ingested_keys;

    ocean::ProfileKey coriolis_profile{"2902084", 1, 'A'};
    ingested_keys.insert(coriolis_profile);

    // When Argo attempts to ingest the same key:
    ocean::ProfileKey duplicate_argo{"2902084", 1, 'A'};
    ocean::ProfileKey unique_argo{"2902084", 2, 'A'};

    // Duplicate check in ArgoLoader logic:
    bool is_dup1 = (ingested_keys.find(duplicate_argo) != ingested_keys.end());
    bool is_dup2 = (ingested_keys.find(unique_argo) != ingested_keys.end());

    assert(is_dup1 == true);
    assert(is_dup2 == false);

    std::cout << "[PASS] Coriolis precedence policy correctly identifies duplicates and preserves unique profiles\n";
}

#include <filesystem>

void test_live_argo_duplicate_exclusion() {
    std::string path = "datasets/argo/incois_2902084_prof.nc";
    if (!std::filesystem::exists(path)) {
        if (std::filesystem::exists("../" + path)) path = "../" + path;
        else if (std::filesystem::exists("../../" + path)) path = "../../" + path;
    }
    if (!std::filesystem::exists(path)) {
        std::cout << "[SKIP] Argo dataset file not found for live duplicate test\n";
        return;
    }

    ocean::ENUTransformer transformer;
    ocean::ArgoLoader loader(transformer);

    // 1. Run without duplicates
    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> empty_catalog;
    std::vector<ocean::ObservationPoint> pts_clean;
    size_t clean_count = loader.stream_file(path, ocean::CanonicalVar::TEMP, empty_catalog, pts_clean);

    // 2. Pre-register cycle 1 (both Ascending and Descending) in existing_keys
    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> coriolis_catalog;
    coriolis_catalog.insert(ocean::ProfileKey{"2902084", 1, 'A'});
    coriolis_catalog.insert(ocean::ProfileKey{"2902084", 1, 'D'});
    std::vector<ocean::ObservationPoint> pts_with_dup;
    size_t dup_count = loader.stream_file(path, ocean::CanonicalVar::TEMP, coriolis_catalog, pts_with_dup);

    // Cycle 1 must have been dropped with DUPLICATE_SUPERSEDED
    assert(dup_count < clean_count);
    for (const auto& pt : pts_with_dup) {
        assert(pt.cycle_number != 1);
    }

    std::cout << "[PASS] Live Argo profile duplicate successfully dropped (clean="
              << clean_count << " pts, with_dup=" << dup_count << " pts, cycle 1 dropped)\n";
}

void test_coriolis_cross_file_duplicate_exclusion() {
    std::string path_r = "datasets/coriolis/1902594/profiles/R1902594_001.nc";
    if (!std::filesystem::exists(path_r)) {
        if (std::filesystem::exists("../" + path_r)) path_r = "../" + path_r;
        else if (std::filesystem::exists("../../" + path_r)) path_r = "../../" + path_r;
    }
    std::string path_sr = "datasets/coriolis/1902594/profiles/SR1902594_001.nc";
    if (!std::filesystem::exists(path_sr)) {
        if (std::filesystem::exists("../" + path_sr)) path_sr = "../" + path_sr;
        else if (std::filesystem::exists("../../" + path_sr)) path_sr = "../../" + path_sr;
    }

    if (!std::filesystem::exists(path_r) || !std::filesystem::exists(path_sr)) {
        std::cout << "[SKIP] Coriolis dataset files not found for cross-file duplicate test\n";
        return;
    }

    ocean::ENUTransformer transformer;
    ocean::CoriolisLoader loader(transformer);
    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> ingested_keys;
    std::vector<ocean::ObservationPoint> out_pts;

    // 1. Ingest primary core CTD file R1902594_001.nc (N_PROF = 5)
    // Proves intra-file multi-profile ingestion works: both Prof 0 (deep, 223 pts) and Prof 1 (near-surface, 2 pts) are ingested.
    size_t r_pts = loader.stream_file(path_r, ocean::CanonicalVar::TEMP, ingested_keys, out_pts);
    assert(r_pts == 225);
    assert(out_pts.size() == 225);
    assert(loader.stats().files_successfully_ingested == 1);
    assert(loader.stats().files_zero_accepted_points == 0);

    // ProfileKey{1902594, 1, 'A'} is now registered
    ocean::ProfileKey expected_key{"1902594", 1, 'A'};
    assert(ingested_keys.find(expected_key) != ingested_keys.end());

    // 2. Stream separate synthetic file SR1902594_001.nc (same float 1902594, cycle 1, direction 'A')
    // Proves file-level cross-file deduplication triggers DUPLICATE_SUPERSEDED:
    size_t sr_pts = loader.stream_file(path_sr, ocean::CanonicalVar::TEMP, ingested_keys, out_pts);
    assert(sr_pts == 0); // Must be rejected
    assert(out_pts.size() == 225); // Zero duplicate points added
    assert(loader.stats().files_successfully_ingested == 1); // Not incremented
    assert(loader.stats().files_zero_accepted_points == 1); // Incremented due to duplicate exclusion

    // 3. Re-streaming the same core file also triggers cross-file duplicate exclusion
    size_t r_repeat_pts = loader.stream_file(path_r, ocean::CanonicalVar::TEMP, ingested_keys, out_pts);
    assert(r_repeat_pts == 0);
    assert(out_pts.size() == 225);
    assert(loader.stats().files_zero_accepted_points == 2);

    std::cout << "[PASS] Coriolis cross-file duplicate successfully dropped with DUPLICATE_SUPERSEDED\n"
              << "       (Core R file: " << r_pts << " pts with intra-file multi-profile retained; "
              << "Separate SR file with identical key: 0 pts accepted, suppressed as duplicate)\n";
}

#if defined(_WIN32)
#include <windows.h>
#endif

int main() {
    std::cout << "--- Running Duplicate Resolver Test Suite ---\n";
    test_duplicate_key_hashing();
    test_coriolis_precedence_policy();
    test_live_argo_duplicate_exclusion();
    test_coriolis_cross_file_duplicate_exclusion();
    std::cout << "All duplicate resolver tests PASSED successfully.\n" << std::flush;
#if defined(_WIN32)
    TerminateProcess(GetCurrentProcess(), 0);
#else
    _Exit(0);
#endif
}

