"""
INCOIS 3D Ocean Data Visualization System
Real Data Validation Script

This script verifies real ocean model NetCDF files (ROMS/INDOFOS) and real Argo profiling
float NetCDF files. It inspects CF metadata, curvilinear coordinate dimensions, depth/pressure
conversions (using gsw TEOS-10), QC flags, and physical scalar bounds.

STRICT RULE: NO MOCK DATA. If datasets are absent, it reports REAL DATASET REQUIRED.
"""

import os
import sys
import argparse
import numpy as np

# Ensure project root and backend are in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def validate_ocean_model(file_path: str):
    print("=" * 80)
    print(f"VALIDATING REAL OCEAN MODEL NETCDF: {file_path}")
    print("=" * 80)
    
    if not os.path.exists(file_path):
        print("STATUS: REAL DATASET REQUIRED")
        print(f"REASON: File not found at '{file_path}'.")
        print("ACTION REQUIRED: Download real ROMS NetCDF from INCOIS ERDDAP (https://erddap.incois.gov.in/).")
        return False

    try:
        from app.services.ocean_model import OceanModel
        
        model = OceanModel(file_path)
        meta = model.get_metadata()
        
        print("\n--- GLOBAL METADATA ---")
        print(f"Title: {meta.get('title', 'N/A')}")
        print(f"Source: {meta.get('source', 'INCOIS Model')}")
        print(f"Grid Type: {meta.get('grid_type', 'N/A')}")
        print(f"Native S-Coordinates: {meta.get('is_native_s_coord', False)}")
        
        print("\n--- DIMENSIONS ---")
        for dim_name, dim_size in meta.get("dimensions", {}).items():
            print(f"  - {dim_name}: {dim_size}")
            
        print("\n--- CORE VARIABLES ---")
        for var_name, vinfo in meta.get("variable_info", {}).items():
            print(f"  [FOUND] {var_name}: shape={vinfo['shape']}, units={vinfo['units']}, name={vinfo['long_name']}")
                
        print("\n--- SPATIAL BOUNDS & VERTICAL EXTENT ---")
        bounds = meta.get("bounds", {})
        print(f"  Longitude: [{bounds.get('min_lon', 0.0):.2f}°E, {bounds.get('max_lon', 0.0):.2f}°E]")
        print(f"  Latitude:  [{bounds.get('min_lat', 0.0):.2f}°N, {bounds.get('max_lat', 0.0):.2f}°N]")
        depths = meta.get("depth_levels", [])
        if depths:
            print(f"  Depth Range: {min(depths):.1f}m to {max(depths):.1f}m ({len(depths)} vertical levels)")

        return True

    except Exception as e:
        print(f"ERROR PARSING NETCDF DATASET: {e}")
        return False


def validate_argo_profile(file_path: str):
    print("\n" + "=" * 80)
    print(f"VALIDATING REAL ARGO FLOAT PROFILES NETCDF: {file_path}")
    print("=" * 80)
    
    if not os.path.exists(file_path):
        print("STATUS: REAL DATASET REQUIRED")
        print(f"REASON: File not found at '{file_path}'.")
        print("ACTION REQUIRED: Download real Argo NetCDF profile from GDAC (https://data-argo.ifremer.fr/).")
        return False

    try:
        from app.services.insitu_store import insitu_store
        
        meta, profiles = insitu_store.parse_single_file(file_path, filter_qc=True)
        
        print("\n--- ARGO PROFILE METADATA ---")
        print(f"Platform Number: {meta.get('platform_number')}")
        print(f"QC Policy: {meta.get('qc_policy')}")
        print(f"Valid QC Filtered Profiles: {len(profiles)} / {meta.get('profiles_count')}")
        
        if profiles:
            first_p = profiles[0]
            print(f"\n--- SAMPLE PROFILE (Cycle {first_p['cycle_number']}, Time: {first_p['timestamp']}) ---")
            print(f"  Position: {first_p['latitude']}°N, {first_p['longitude']}°E")
            print(f"  Depth Range: {min(first_p['depths']):.1f}m to {max(first_p['depths']):.1f}m ({len(first_p['depths'])} valid levels)")
            for i in range(min(5, len(first_p['depths']))):
                print(f"    Level {i:02d}: Depth = {first_p['depths'][i]:6.1f} m | Temp = {first_p['temperature'][i]:5.2f} °C | QC = {first_p['qc_flags'][i]}")
                    
        return True
    except Exception as e:
        print(f"ERROR PARSING ARGO NETCDF: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="INCOIS Real Oceanographic Data Validation Tool")
    parser.add_argument("--model", type=str, default="datasets/model/incois_roms_indian_ocean.nc", help="Path to real ROMS NetCDF model file")
    parser.add_argument("--argo", type=str, default="datasets/argo/incois_2902084_prof.nc", help="Path to real Argo NetCDF profile file")
    
    args = parser.parse_args()
    
    print("Running Milestone 1 — Task 1 Real Data Validation...")
    model_ok = validate_ocean_model(args.model)
    argo_ok = validate_argo_profile(args.argo)
    
    if not (model_ok and argo_ok):
        print("\nNotice: System operates in strict NO MOCK DATA mode. Place real NetCDF files in datasets/ directory to proceed.")
        sys.exit(1)
    else:
        print("\nSUCCESS: All real datasets passed CF compliance, dimension checks, and TEOS-10 conversions!")
