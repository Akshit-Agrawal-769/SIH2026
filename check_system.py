#!/usr/bin/env python3
"""
INCOIS 3D Ocean Data System - System Health & Diagnostics Utility
Checks Python environment, NetCDF datasets, TEOS-10 support, and backend/frontend readiness.
"""

import os
import sys
import glob

def run_diagnostics():
    print("=" * 70)
    print("  INCOIS 3D OCEAN DATA SYSTEM — SYSTEM HEALTH DIAGNOSTICS")
    print("  Problem Statement: SIH 2026 PS 26067")
    print("=" * 70)

    # 1. Python Environment Check
    print("\n[1/5] Checking Python Dependencies...")
    required_packages = [
        "fastapi", "uvicorn", "pydantic", "xarray", "netCDF4", 
        "h5netcdf", "numpy", "scipy", "gsw", "pandas", "httpx"
    ]
    all_pkgs_ok = True
    for pkg in required_packages:
        try:
            __import__(pkg)
            print(f"  ✓ {pkg:<16} (Installed)")
        except ImportError:
            print(f"  ✗ {pkg:<16} (MISSING - pip install {pkg})")
            all_pkgs_ok = False

    # 2. Datasets Inspection
    print("\n[2/5] Inspecting Real Ocean Datasets (NO MOCK DATA Policy)...")
    root_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = os.path.join(root_dir, "datasets", "model")
    argo_dir = os.path.join(root_dir, "datasets", "argo")

    model_files = glob.glob(os.path.join(model_dir, "*.nc*"))
    argo_files = glob.glob(os.path.join(argo_dir, "*.nc*"))

    print(f"  Model files in datasets/model/: {len(model_files)}")
    for mf in model_files:
        size_mb = os.path.getsize(mf) / (1024 * 1024)
        print(f"    - {os.path.basename(mf)} ({size_mb:.2f} MB)")

    print(f"  Argo profiles in datasets/argo/: {len(argo_files)}")
    for af in argo_files:
        size_mb = os.path.getsize(af) / (1024 * 1024)
        print(f"    - {os.path.basename(af)} ({size_mb:.2f} MB)")

    datasets_ok = len(model_files) > 0 and len(argo_files) > 0

    # 3. TEOS-10 GSW Thermodynamic Verification
    print("\n[3/5] Verifying TEOS-10 Thermodynamic Conversion (gsw.z_from_p)...")
    try:
        import gsw
        sample_p = 500.0  # 500 dbar
        sample_lat = 15.0 # Arabian Sea
        depth = -gsw.z_from_p(sample_p, sample_lat)
        print(f"  ✓ 500.0 dbar at 15.0°N -> {depth:.2f} meters depth")
        teos_ok = True
    except Exception as e:
        print(f"  ✗ TEOS-10 check failed: {e}")
        teos_ok = False

    # 4. Frontend Files & Build Status
    print("\n[4/5] Inspecting Frontend Assets...")
    frontend_dist = os.path.join(root_dir, "frontend", "dist", "index.html")
    has_dist = os.path.exists(frontend_dist)
    if has_dist:
        print(f"  ✓ Production bundle built in frontend/dist/ ({os.path.getsize(frontend_dist)} bytes)")
    else:
        print("  Notice: Production bundle not yet built (Run 'npm run build' inside frontend/)")

    # 5. Summary
    print("\n[5/5] System Health Summary")
    print("-" * 70)
    if all_pkgs_ok and datasets_ok and teos_ok:
        print("  STATUS: 100% OPERATIONAL & READY")
        print("  Run './start_dev.sh' to launch both backend and frontend together.")
    else:
        print("  STATUS: ACTION REQUIRED")
        if not datasets_ok:
            print("  - Run 'python3 ingestion/fetch_real_datasets.py' to acquire real datasets.")
        if not all_pkgs_ok:
            print("  - Run 'pip install -r backend/requirements.txt' to install missing dependencies.")
    print("=" * 70)

if __name__ == "__main__":
    run_diagnostics()
