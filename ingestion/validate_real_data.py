"""
INCOIS 3D Ocean Data Visualization System
Milestone 1 — Task 1: Real Data Validation Script

This script verifies real ocean model NetCDF files (ROMS/INDOFOS) and real Argo profiling
float NetCDF files. It inspects CF metadata, curvilinear coordinate dimensions, depth/pressure
conversions (using gsw TEOS-10), missing fill values, and exports one empirical Float32
binary slice for WebGL validation.

STRICT RULE: NO MOCK DATA. If datasets are absent, it reports REAL DATASET REQUIRED.
"""

import os
import sys
import argparse
import numpy as np

def validate_ocean_model(file_path: str):
    print("=" * 80)
    print(f"VALIDATING REAL OCEAN MODEL NETCDF: {file_path}")
    print("=" * 80)
    
    if not os.path.exists(file_path):
        print(f"STATUS: REAL DATASET REQUIRED")
        print(f"REASON: File not found at '{file_path}'.")
        print(f"ACTION REQUIRED: Download real ROMS NetCDF from INCOIS ERDDAP (https://erddap.incois.gov.in/).")
        return False

    try:
        import xarray as xr
        ds = xr.open_dataset(file_path, engine="h5netcdf" if file_path.endswith(".nc4") else "netcdf4")
        
        print("\n--- GLOBAL METADATA ---")
        print(f"Title: {ds.attrs.get('title', 'N/A')}")
        print(f"Conventions: {ds.attrs.get('Conventions', 'N/A')}")
        print(f"Source: {ds.attrs.get('source', 'INCOIS Model')}")
        
        print("\n--- DIMENSIONS ---")
        for dim_name, dim_size in ds.dims.items():
            print(f"  - {dim_name}: {dim_size}")
            
        print("\n--- CORE VARIABLES ---")
        for var_name in ["temp", "salt", "u", "v", "w", "chl", "temperature", "salinity"]:
            if var_name in ds.variables:
                v = ds.variables[var_name]
                print(f"  [FOUND] {var_name}: shape={v.shape}, dtype={v.dtype}, units={v.attrs.get('units', 'N/A')}")
                
        print("\n--- COORDINATES & GRID SYSTEM ---")
        if "lat" in ds and "lon" in ds:
            lat_shape = ds["lat"].shape
            lon_shape = ds["lon"].shape
            if len(lat_shape) == 2:
                print(f"  [GRID TYPE] Curvilinear 2D Grid detected. Lat shape: {lat_shape}, Lon shape: {lon_shape}")
            else:
                print(f"  [GRID TYPE] Regular 1D Grid detected. Lat shape: {lat_shape}, Lon shape: {lon_shape}")

        # Extract 1 sample surface slice for validation
        target_var = "temp" if "temp" in ds else ("temperature" if "temperature" in ds else None)
        if target_var:
            slice_data = ds[target_var].isel(time=0, s_rho=0 if "s_rho" in ds.dims else 0).values
            slice_f32 = np.nan_to_num(slice_data, nan=-9999.0).astype(np.float32)
            
            output_bin = os.path.join(os.path.dirname(file_path), "test_surface_slice.bin")
            slice_f32.tofile(output_bin)
            
            print("\n--- EMPIRICAL SURFACE SLICE STATISTICS ---")
            print(f"  - Shape: {slice_f32.shape}")
            print(f"  - Data Type: {slice_f32.dtype}")
            print(f"  - Min Val: {np.nanmin(slice_data):.4f}")
            print(f"  - Max Val: {np.nanmax(slice_data):.4f}")
            print(f"  - Mean Val: {np.nanmean(slice_data):.4f}")
            print(f"  - Exported Float32 Binary: {output_bin} ({os.path.getsize(output_bin)} bytes)")

        ds.close()
        return True

    except Exception as e:
        print(f"ERROR PARSING NETCDF DATASET: {e}")
        return False

def validate_argo_profile(file_path: str):
    print("\n" + "=" * 80)
    print(f"VALIDATING REAL ARGO FLOAT PROFILES NETCDF: {file_path}")
    print("=" * 80)
    
    if not os.path.exists(file_path):
        print(f"STATUS: REAL DATASET REQUIRED")
        print(f"REASON: File not found at '{file_path}'.")
        print(f"ACTION REQUIRED: Download real Argo NetCDF profile from GDAC (ftp://ftp.ifremer.fr/ifremer/argo).")
        return False

    try:
        import xarray as xr
        import gsw
        
        ds = xr.open_dataset(file_path)
        print("\n--- ARGO PROFILE METADATA ---")
        print(f"Platform Number: {ds.get('PLATFORM_NUMBER', {}).values}")
        print(f"Dimensions: N_PROF={ds.dims.get('N_PROF')}, N_LEVELS={ds.dims.get('N_LEVELS')}")
        
        if "PRES" in ds and "TEMP" in ds:
            pres = ds["PRES"].values[0] # First profile
            temp = ds["TEMP"].values[0]
            lat = float(ds["LATITUDE"].values[0]) if "LATITUDE" in ds else 15.0
            
            # Convert pressure (dbar) to depth (m) using gsw TEOS-10
            depth = -gsw.z_from_p(pres, lat)
            
            print("\n--- SAMPLE PROFILE DEPTH CONVERSION (gsw TEOS-10) ---")
            for i in range(min(10, len(pres))):
                if not np.isnan(pres[i]):
                    print(f"  Level {i:02d}: Pressure = {pres[i]:6.1f} dbar -> Calculated Depth = {depth[i]:6.1f} m | Temp = {temp[i]:5.2f} °C")
                    
        ds.close()
        return True
    except Exception as e:
        print(f"ERROR PARSING ARGO NETCDF: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="INCOIS Real Oceanographic Data Validation Tool")
    parser.add_argument("--model", type=str, default="datasets/model/incois_roms_sample.nc", help="Path to real ROMS NetCDF model file")
    parser.add_argument("--argo", type=str, default="datasets/argo/argo_profile_sample.nc", help="Path to real Argo NetCDF profile file")
    
    args = parser.parse_args()
    
    print("Running Milestone 1 — Task 1 Real Data Validation...")
    model_ok = validate_ocean_model(args.model)
    argo_ok = validate_argo_profile(args.argo)
    
    if not (model_ok and argo_ok):
        print("\nNotice: System operates in strict NO MOCK DATA mode. Place real NetCDF files in datasets/ directory to proceed.")
        sys.exit(0)
