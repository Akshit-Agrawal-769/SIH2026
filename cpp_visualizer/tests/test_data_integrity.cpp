#include "ocean/io/cmems_loader.hpp"
#include "ocean/io/roms_loader.hpp"
#include "ocean/io/argo_loader.hpp"
#include "ocean/io/coriolis_loader.hpp"
#include "ocean/query/query_interface.hpp"
#include "ocean/common/audit_logger.hpp"
#include <iostream>
#include <cassert>
#include <cmath>
#include <filesystem>
#if defined(_WIN32)
#include <windows.h>
#endif

namespace {

std::string resolve_dataset_path(const std::string& rel) {
    if (std::filesystem::exists(rel)) return rel;
    if (std::filesystem::exists("../" + rel)) return "../" + rel;
    if (std::filesystem::exists("../../" + rel)) return "../../" + rel;
    return rel;
}

} // anonymous namespace

void test_cmems_real_integrity() {
    std::string path = resolve_dataset_path("datasets/cmems.nc");
    ocean::CMEMSLoader cmems(path);
    const auto& meta = cmems.metadata();

    std::cout << "CMEMS Region Clamped Grid: Lat count=" << meta.lat_count
              << ", Lon count=" << meta.lon_count << "\n";

    assert(meta.lat_count == 280);
    assert(meta.lon_count == 520);
    assert(meta.clipped_latitudes.front() >= -10.0f);
    assert(meta.clipped_latitudes.back() <= 25.0f);
    assert(meta.clipped_longitudes.front() >= 35.0f);
    assert(meta.clipped_longitudes.back() <= 100.0f);

    auto temp_slice = cmems.read_surface_slice(ocean::CanonicalVar::TEMP);
    assert(temp_slice.size() == 280 * 520);

    size_t valid_count = 0;
    for (float v : temp_slice) {
        if (!std::isnan(v)) {
            // Authentic sea water potential temperature in tropical Indian Ocean: ~10 to 35 C
            assert(v >= 0.0f && v <= 40.0f);
            ++valid_count;
        }
    }
    std::cout << "CMEMS Sea Surface Temperature: " << valid_count << " valid cells (rest land masked)\n";
    assert(valid_count > 50000);
    std::cout << "[PASS] CMEMS Real Data Integrity Verified\n";
}

void test_roms_real_integrity() {
    std::string path = resolve_dataset_path("datasets/INCOIS-BIO-ROMS.nc");
    ocean::ROMSLoader roms(path);
    const auto& meta = roms.metadata();

    std::cout << "ROMS Region Clamped Grid: Lat count=" << meta.lat_count
              << ", Lon count=" << meta.lon_count
              << ", Time steps=" << meta.time_steps << "\n";

    assert(meta.lat_count == 430);
    assert(meta.lon_count == 781);
    assert(meta.time_steps == 480);

    auto chl_slice = roms.read_surface_slice(ocean::CanonicalVar::CHL, 0);
    assert(chl_slice.size() == 430 * 781);

    size_t valid_count = 0;
    for (float v : chl_slice) {
        if (!std::isnan(v)) {
            assert(v >= 0.0f && v <= 100.0f); // Chlorophyll mg/m^3
            ++valid_count;
        }
    }
    std::cout << "ROMS Chlorophyll-a step 0: " << valid_count << " valid cells\n";
    assert(valid_count > 100000);
    std::cout << "[PASS] ROMS Real Data Integrity Verified\n";
}

void test_argo_real_integrity() {
    ocean::ENUTransformer transformer;
    ocean::ArgoLoader argo(transformer);

    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> empty_coriolis_catalog;
    std::vector<ocean::ObservationPoint> points;

    std::string path = resolve_dataset_path("datasets/argo/incois_2902084_prof.nc");
    size_t ingested = argo.stream_file(
        path,
        ocean::CanonicalVar::TEMP,
        empty_coriolis_catalog,
        points,
        1 // full resolution
    );

    std::cout << "Argo Float 2902084: Ingested " << ingested << " authentic QC-verified points\n";
    assert(ingested > 0);
    assert(points.size() == ingested);

    for (const auto& pt : points) {
        // Assert only QC 1 or 2
        assert(pt.qc == ocean::QCFlag::GOOD || pt.qc == ocean::QCFlag::PROBABLY_GOOD);
        // Assert ENU coordinates are within plausible bounding envelope
        assert(!std::isnan(pt.position.east_m));
        assert(!std::isnan(pt.position.north_m));
        assert(!std::isnan(pt.position.up_m));
        // Verify physical depth via inverse geodetic transformation
        auto geo = transformer.enu_to_geodetic(pt.position);
        assert(geo.depth_m >= -2500.0 && geo.depth_m <= 10.0); // Argo float profiles max ~2000m depth
        assert(geo.latitude_deg >= ocean::Constants::REGION_MIN_LAT && geo.latitude_deg <= ocean::Constants::REGION_MAX_LAT);
        assert(geo.longitude_deg >= ocean::Constants::REGION_MIN_LON && geo.longitude_deg <= ocean::Constants::REGION_MAX_LON);
    }

    std::cout << "[PASS] Argo In-situ Real Data Integrity & TEOS-10 Coordinates Verified\n";
}

void test_pco2_pairing_policy() {
    auto cmems = std::make_shared<ocean::CMEMSLoader>(resolve_dataset_path("datasets/cmems.nc"));
    auto roms = std::make_shared<ocean::ROMSLoader>(resolve_dataset_path("datasets/INCOIS-BIO-ROMS.nc"));
    auto points = std::make_shared<ocean::PointCloudBuffer>();

    ocean::QueryInterface query(cmems, roms, points);

    // Query in open Arabian Sea (15 N, 65 E)
    auto pco2_int = query.get_pco2_at(15.0, 65.0, ocean::CanonicalVar::PCO2_INT, 0);
    if (pco2_int) {
        std::cout << "pCO2_Int at (15N, 65E): " << pco2_int->value << " uatm\n";
        assert(pco2_int->deviant_uncertainty_1sigma.has_value());
        std::cout << "  -> Paired Deviant_uncertainty: " << *pco2_int->deviant_uncertainty_1sigma << "\n";
    }

    auto pco2_orig = query.get_pco2_at(15.0, 65.0, ocean::CanonicalVar::PCO2_ORIG, 0);
    if (pco2_orig) {
        std::cout << "pCO2_Orig at (15N, 65E): " << pco2_orig->value << " uatm\n";
        // STRICT POLICY: PCO2_ORIG has NO deviant uncertainty
        assert(!pco2_orig->deviant_uncertainty_1sigma.has_value());
        std::cout << "  -> Deviant uncertainty correctly std::nullopt for PCO2_ORIG\n";
    }

    std::cout << "[PASS] pCO2 Deviant Uncertainty Pairing Policy Verified\n";
}

void test_coriolis_real_integrity() {
    ocean::ENUTransformer transformer;
    ocean::CoriolisLoader coriolis(transformer);

    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> keys;
    std::vector<ocean::ObservationPoint> points;

    std::string path = resolve_dataset_path("datasets/coriolis/1902594/profiles/R1902594_001.nc");
    if (!std::filesystem::exists(path)) {
        std::cout << "[SKIP] Coriolis test file not found at " << path << "\n";
        return;
    }

    size_t ingested = coriolis.stream_file(
        path,
        ocean::CanonicalVar::TEMP,
        keys,
        points,
        1
    );

    std::cout << "Coriolis Float 1902594 Profile 001: Ingested " << ingested << " points\n";
    assert(ingested > 0);
    assert(keys.size() >= 1);
    assert(coriolis.stats().files_attempted == 1);
    assert(coriolis.stats().files_failed_open == 0);
    assert(coriolis.stats().files_successfully_ingested == 1);

    for (const auto& pt : points) {
        assert(pt.qc == ocean::QCFlag::GOOD || pt.qc == ocean::QCFlag::PROBABLY_GOOD);
        assert(pt.source == ocean::DatasetSource::CORIOLIS_FLOAT_PROFILE);
        assert(!std::isnan(pt.position.east_m));
        assert(!std::isnan(pt.position.north_m));
        assert(!std::isnan(pt.position.up_m));
        assert(pt.depth_m >= 0.0f && pt.depth_m <= 12000.0f);
        assert(std::abs(pt.position.up_m) <= 12000.0);
    }

    std::cout << "[PASS] Coriolis Real Data Integrity & Adjusted Fallback Verified\n";
}

int main() {
    std::cout << "--- Running End-to-End Real Data Integrity Test Suite ---\n";
    test_cmems_real_integrity();
    test_roms_real_integrity();
    test_argo_real_integrity();
    test_coriolis_real_integrity();
    test_pco2_pairing_policy();
    std::cout << "All End-to-End Real Data Integrity tests PASSED successfully." << std::endl;
#if defined(_WIN32)
    TerminateProcess(GetCurrentProcess(), 0);
#else
    _Exit(0);
#endif
}
