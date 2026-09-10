#include "ocean/common/types.hpp"
#include "ocean/common/constants.hpp"
#include "ocean/common/audit_logger.hpp"
#include "ocean/geo/teos10.hpp"
#include "ocean/geo/enu_transform.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include "ocean/io/cmems_loader.hpp"
#include "ocean/io/roms_loader.hpp"
#include "ocean/io/argo_loader.hpp"
#include "ocean/io/coriolis_loader.hpp"
#include "ocean/data/volume_buffer.hpp"
#include "ocean/data/point_cloud.hpp"
#include "ocean/data/lod_decimator.hpp"
#include "ocean/query/spatial_index.hpp"
#include "ocean/query/query_interface.hpp"

#include <iostream>
#include <iomanip>
#include <chrono>
#include <cmath>
#include <filesystem>
#if defined(_WIN32)
#include <windows.h>
#endif

namespace fs = std::filesystem;

int main() {
    std::cout << "====================================================================\n";
    std::cout << "  INDIAN OCEAN DATASET INGESTION & 3D VISUALIZER PIPELINE\n";
    std::cout << "  Region: Lat [-10, 25 N], Lon [35, 100 E] | Origin: 5 N, 75 E\n";
    std::cout << "  Data Integrity: STRICT REAL DATA (Zero Synthetic / Gap Filling)\n";
    std::cout << "====================================================================\n\n";

    // Initialize audit log
    ocean::AuditLogger::instance().init("audit_log.jsonl");

    ocean::ENUTransformer transformer(
        ocean::Constants::REGION_CENTROID_LAT,
        ocean::Constants::REGION_CENTROID_LON,
        ocean::Constants::REGION_CENTROID_ALT
    );

    // 1. CMEMS 2D Surface Keyframe Ingestion
    std::string cmems_path = "datasets/cmems.nc";
    std::shared_ptr<ocean::CMEMSLoader> cmems;
    if (fs::exists(cmems_path)) {
        std::cout << "[1/4] Ingesting CMEMS Gridded Keyframe (" << cmems_path << ")...\n";
        cmems = std::make_shared<ocean::CMEMSLoader>(cmems_path);
        const auto& meta = cmems->metadata();
        std::cout << "      Clamped grid dimensions: " << meta.lat_count << " x " << meta.lon_count
                  << " (" << meta.lat_count * meta.lon_count << " cells)\n";

        auto sst_slice = cmems->read_surface_slice(ocean::CanonicalVar::TEMP);
        auto sss_slice = cmems->read_surface_slice(ocean::CanonicalVar::PSAL);
        auto ssh_slice = cmems->read_surface_slice(ocean::CanonicalVar::SSH);

        size_t sst_valid = 0;
        for (float v : sst_slice) if (!std::isnan(v)) ++sst_valid;
        std::cout << "      TEMP (to): " << sst_valid << " valid ocean cells\n";
        std::cout << "      PSAL (so): Practical Salinity (PSS-78), unit=0.001\n";
        std::cout << "      SSH  (zo): Sea surface height\n";
    } else {
        std::cout << "[WARN] CMEMS file not found at " << cmems_path << "\n";
    }

    // 2. INCOIS-BIO-ROMS 2D Surface 480-Month Time Series Ingestion
    std::string roms_path = "datasets/INCOIS-BIO-ROMS.nc";
    std::shared_ptr<ocean::ROMSLoader> roms;
    if (fs::exists(roms_path)) {
        std::cout << "\n[2/4] Ingesting INCOIS-BIO-ROMS Primary Surface Time Series (" << roms_path << ")...\n";
        roms = std::make_shared<ocean::ROMSLoader>(roms_path);
        const auto& meta = roms->metadata();
        std::cout << "      Clamped grid: " << meta.lat_count << " x " << meta.lon_count
                  << " across " << meta.time_steps << " monthly steps (1980 - 2019)\n";

        auto chl_slice = roms->read_surface_slice(ocean::CanonicalVar::CHL, 0);
        auto pco2_slice = roms->read_surface_slice(ocean::CanonicalVar::PCO2_INT, 0);
        auto uncert_slice = roms->read_surface_slice(ocean::CanonicalVar::PCO2_UNCERT, 0);

        std::cout << "      CHL, NO3, DIC, pCO2_Int, pCO2_Original, Deviant_uncertainty ready\n";
    } else {
        std::cout << "[WARN] ROMS file not found at " << roms_path << "\n";
    }

    // 3. In-Situ Float Profiles (Coriolis + Argo) with TEOS-10 Depth
    std::cout << "\n[3/4] Streaming In-Situ Float Profiles with TEOS-10 Dynamic Depth...\n";
    auto point_cloud = std::make_shared<ocean::PointCloudBuffer>();
    std::unordered_set<ocean::ProfileKey, ocean::ProfileKeyHash> ingested_keys;

    ocean::CoriolisLoader coriolis_loader(transformer);
    ocean::ArgoLoader argo_loader(transformer);

    // Stream Coriolis profile repository
    std::string coriolis_root = "datasets/coriolis";
    if (fs::exists(coriolis_root)) {
        std::cout << "      Walking Coriolis profiles (datasets/coriolis/*/profiles/*.nc)...\n";
        std::vector<ocean::ObservationPoint> coriolis_pts;
        coriolis_loader.stream_directory(
            coriolis_root,
            ocean::CanonicalVar::TEMP,
            ingested_keys,
            coriolis_pts,
            0, // Process all matching files
            2  // Stride 2 levels
        );
        for (const auto& p : coriolis_pts) point_cloud->add_point(p);
        std::cout << "      Coriolis authentic in-situ points loaded: " << coriolis_pts.size() 
                  << " (registered " << ingested_keys.size() << " unique profile keys)\n";
    }

    // Stream Argo files and deduplicate against Coriolis
    std::vector<std::string> argo_files = {
        "datasets/argo/incois_2902084_prof.nc",
        "datasets/argo/incois_2902120_prof.nc"
    };

    for (const auto& argo_file : argo_files) {
        if (fs::exists(argo_file)) {
            std::vector<ocean::ObservationPoint> pts;
            size_t n = argo_loader.stream_file(
                argo_file,
                ocean::CanonicalVar::TEMP,
                ingested_keys,
                pts
            );
            for (const auto& p : pts) point_cloud->add_point(p);
            std::cout << "      Argo file " << argo_file << ": ingested " << n << " points\n";
        }
    }

    std::cout << "      Total authentic in-situ 3D points loaded: " << point_cloud->size() << "\n";

    double min_e, max_e, min_n, max_n, min_u, max_u;
    point_cloud->get_bounds(min_e, max_e, min_n, max_n, min_u, max_u);
    std::cout << "      ENU Bounding Envelope (meters from 5N, 75E):\n";
    std::cout << "        East:  [" << std::fixed << std::setprecision(1) << min_e << ", " << max_e << "]\n";
    std::cout << "        North: [" << min_n << ", " << max_n << "]\n";
    std::cout << "        Up:    [" << min_u << ", " << max_u << "] (depth down to " << -min_u << " m)\n";

    // 4. Build Spatial Index & Demonstrate Common Query Interface
    std::cout << "\n[4/4] Demonstrating Query Interface & Spatial Lookups...\n";
    ocean::SpatialIndex spatial_index(25000.0); // 25 km binning
    spatial_index.build(*point_cloud);

    ocean::QueryInterface query(cmems, roms, point_cloud);

    // Query 1: Surface value at (10 N, 75 E)
    auto sst_val = query.get_surface_value_at(10.0, 75.0, ocean::CanonicalVar::TEMP, 0);
    if (sst_val) {
        std::cout << "      Surface TEMP at (10 N, 75 E): " << *sst_val << " C\n";
    }

    // Query 2: pCO2 with paired Deviant_uncertainty
    auto pco2_int = query.get_pco2_at(12.0, 68.0, ocean::CanonicalVar::PCO2_INT, 0);
    if (pco2_int) {
        std::cout << "      pCO2_Int at (12 N, 68 E): " << pco2_int->value << " uatm\n";
        if (pco2_int->deviant_uncertainty_1sigma) {
            std::cout << "        Paired Deviant_uncertainty: +/- " << *pco2_int->deviant_uncertainty_1sigma << " uatm\n";
        }
    }

    auto pco2_orig = query.get_pco2_at(12.0, 68.0, ocean::CanonicalVar::PCO2_ORIG, 0);
    if (pco2_orig) {
        std::cout << "      pCO2_Original at (12 N, 68 E): " << pco2_orig->value << " uatm\n";
        std::cout << "        Uncertainty pairing: " 
                  << (pco2_orig->deviant_uncertainty_1sigma ? "present" : "std::nullopt (direct model output)") << "\n";
    }

    // Query 3: Time Series query over 480 steps
    auto chl_series = query.get_surface_timeseries(10.0, 75.0, ocean::CanonicalVar::CHL);
    std::cout << "      CHL Time Series at (10 N, 75 E): " << chl_series.size() << " monthly steps retrieved\n";

    // Query 4: In-situ depth profile
    auto profile = query.get_float_profile("2902084", 1, ocean::CanonicalVar::TEMP);
    std::cout << "      Argo Float 2902084 Cycle 1: " << profile.size() << " depth levels\n";
    if (!profile.empty()) {
        std::cout << "        Surface: depth=" << profile.front().depth_m << " m, TEMP=" << profile.front().value << " C\n";
        std::cout << "        Deepest: depth=" << profile.back().depth_m << " m, TEMP=" << profile.back().value << " C\n";
    }

    // Query 5: Spatial nearest neighbor with physical depth validation
    ocean::ENUCoord test_target = transformer.geodetic_to_enu(10.0, 75.0, -100.0);
    const auto* nearest = spatial_index.find_nearest(test_target, ocean::CanonicalVar::TEMP, 1000000.0); // 1000 km
    if (nearest) {
        auto nearest_geo = transformer.enu_to_geodetic(nearest->position);
        std::cout << "      Nearest float measurement to (10N, 75E, target_depth=100m):\n";
        std::cout << "        Source:       " << (nearest->source == ocean::DatasetSource::CORIOLIS_FLOAT_PROFILE ? "CORIOLIS" : "ARGO") << "\n";
        std::cout << "        Platform WMO: " << nearest->platform_id << "\n";
        std::cout << "        Cycle:        " << nearest->cycle_number << "\n";
        std::cout << "        Location:     Lat " << std::fixed << std::setprecision(4) << nearest_geo.latitude_deg 
                  << " N, Lon " << nearest_geo.longitude_deg << " E\n";
        std::cout << "        True Depth:   " << std::setprecision(2) << nearest->depth_m << " m (ENU up: " << nearest->position.up_m << " m)\n";
        std::cout << "        Temperature:  " << nearest->value << " C (QC flag: " << static_cast<char>(nearest->qc) << ")\n";
    }

    ocean::AuditLogger::instance().flush();
    std::cout << "\n====================================================================\n";
    std::cout << "  PIPELINE EXECUTION COMPLETE\n";
    std::cout << "  Audit log written to: audit_log.jsonl\n";
    std::cout << "====================================================================\n" << std::endl;

#if defined(_WIN32)
    TerminateProcess(GetCurrentProcess(), 0);
#else
    _Exit(0);
#endif
}
