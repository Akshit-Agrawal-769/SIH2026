import os
import struct
import numpy as np
from datetime import datetime, timezone
import netCDF4 as nc

from app.routers.tiles import get_tile
from app.routers.instruments import get_instrument_profile, list_instruments
from app.ingestion.argo import ArgoIngestionAdapter
from fastapi import HTTPException

def test_c_plus_plus_binary_tile_format():
    """Verify C++ exported binary tile layout and non-synthetic ranges."""
    tile_path = "tiles/temperature/2024-06-01/0.5.bin"
    assert os.path.exists(tile_path), f"Tile {tile_path} does not exist!"
    
    with open(tile_path, "rb") as f:
        header_bytes = f.read(32)
        assert len(header_bytes) == 32, "Header must be 32 bytes"
        
        magic = header_bytes[0:4].decode("latin1")
        assert magic == "INCO", f"Expected magic 'INCO', got {magic}"
        
        version, var_code, width, height, depth_count, data_type = struct.unpack("<HHHHHH", header_bytes[4:16])
        min_val, max_val = struct.unpack("<ff", header_bytes[16:24])
        
        assert version == 1
        assert var_code == 1  # temperature
        assert width == 520
        assert height == 280
        assert depth_count == 1
        assert data_type == 1  # Float32
        
        # Authentic CMEMS temperature range for Arabian Sea / Bay of Bengal [16.635, 31.456]
        assert 16.0 <= min_val <= 18.0, f"Unexpected min temp {min_val}"
        assert 30.0 <= max_val <= 33.0, f"Unexpected max temp {max_val}"
        
        payload = f.read()
        cells = np.frombuffer(payload, dtype=np.float32)
        assert len(cells) == width * height
        
        valid_cells = cells[~np.isnan(cells)]
        assert len(valid_cells) == 101279, f"Expected 101279 valid ocean cells, got {len(valid_cells)}"
        assert np.isclose(valid_cells.min(), min_val, atol=1e-3)
        assert np.isclose(valid_cells.max(), max_val, atol=1e-3)

def test_api_tile_serving_authentic_cpp():
    """Verify /api/tiles serves the exact C++ exported tile."""
    res = get_tile("temperature", "2024-06-01", 0.5)
    assert res.status_code == 200
    assert res.headers["X-Data-Source"] == "Authentic-NetCDF"
    assert res.headers["X-Data-Policy"] == "STRICT_REAL_DATA_ZERO_SYNTHETIC"
    
    data = res.body
    assert data[:4] == b"INCO"
    assert len(data) == 32 + (520 * 280 * 4)

def test_missing_data_returns_404_no_synthetic():
    """Verify non-existent depth (e.g. 500m) returns HTTP 404 without synthetic fallback."""
    try:
        get_tile("temperature", "2024-06-01", 500.0)
        assert False, "Should have raised HTTPException 404!"
    except HTTPException as e:
        assert e.status_code == 404
        assert "No authentic oceanographic tile available" in e.detail
        assert "Strictly NO synthetic/mock data permitted" in e.detail

def test_argo_netcdf_observation_pipeline():
    """Verify Argo Float 2902084 observation matches original NetCDF exactly."""
    nc_path = "datasets/argo/incois_2902084_prof.nc"
    assert os.path.exists(nc_path), f"Argo file {nc_path} missing"
    
    with nc.Dataset(nc_path, "r") as ds:
        # Cycle 0 (first profile)
        juld = float(ds.variables["JULD"][0])
        lat = float(ds.variables["LATITUDE"][0])
        lon = float(ds.variables["LONGITUDE"][0])
        pres = ds.variables["PRES"][0, :]
        temp = ds.variables["TEMP"][0, :]
        psal = ds.variables["PSAL"][0, :]
        temp_qc = ds.variables["TEMP_QC"][0, :]
        
        # Valid first depth index
        valid_idx = None
        for i in range(len(temp)):
            if not np.ma.is_masked(temp[i]) and not np.isnan(float(temp[i])):
                qc_char = temp_qc[i]
                if isinstance(qc_char, bytes):
                    qc_char = qc_char.decode("ascii", errors="ignore")
                if qc_char in ("1", "2"):
                    valid_idx = i
                    break
        
        assert valid_idx is not None
        expected_depth = round(float(pres[valid_idx]) * 0.993, 2)
        expected_temp = round(float(temp[valid_idx]), 3)
        expected_sal = round(float(psal[valid_idx]), 3)
        
    # Query API / adapter
    adapter = ArgoIngestionAdapter()
    raw = adapter.fetch(None, None, [])
    norm = adapter.normalize(raw)
    float_record = next(f for f in norm if f["metadata"]["wmo"] == "2902084")
    cycle_0 = float_record["profiles"][0]
    first_meas = cycle_0["measurements"][0]
    
    print(f"\n[Argo NetCDF vs Adapter Verification]")
    print(f"NetCDF Cycle 1: Lat={lat:.3f}, Lon={lon:.3f}, Depth={expected_depth}m, Temp={expected_temp}C, Sal={expected_sal}PSU")
    print(f"Adapter Output: Lat={cycle_0['latitude']:.3f}, Lon={cycle_0['longitude']:.3f}, Depth={first_meas['depth']}m, Temp={first_meas['temperature']}C, Sal={first_meas['salinity']}PSU")
    
    assert np.isclose(cycle_0["latitude"], lat, atol=1e-3)
    assert np.isclose(cycle_0["longitude"], lon, atol=1e-3)
    assert np.isclose(first_meas["depth"], expected_depth, atol=1e-2)
    assert np.isclose(first_meas["temperature"], expected_temp, atol=1e-3)
    assert np.isclose(first_meas["salinity"], expected_sal, atol=1e-3)
    return norm

def test_model_vs_observation_scientific_comparison(norm=None):
    """
    Compare CMEMS model surface temperature at Float 2902084 location
    against authentic in-situ Argo observation (Test C).
    Keeps model and observation scientifically distinct.
    """
    # 1. Argo observation
    if norm is None:
        adapter = ArgoIngestionAdapter()
        norm = adapter.normalize(adapter.fetch(None, None, []))
    float_record = next(f for f in norm if f["metadata"]["wmo"] == "2902084")
    cycle_0 = float_record["profiles"][0]
    obs_lat = cycle_0["latitude"]
    obs_lon = cycle_0["longitude"]
    obs_temp = cycle_0["measurements"][0]["temperature"]
    obs_depth = cycle_0["measurements"][0]["depth"]
    
    # 2. C++ / CMEMS tile sample at (obs_lon, obs_lat)
    tile_path = "tiles/temperature/2024-06-01/0.5.bin"
    with open(tile_path, "rb") as f:
        header_bytes = f.read(32)
        width, height = struct.unpack("<HH", header_bytes[8:12])
        cells = np.frombuffer(f.read(), dtype=np.float32)
        
    # Grid coordinate conversion: lon in [35, 100], lat in [-10, 25]
    x = int(round(((obs_lon - 35.0) / 65.0) * (width - 1)))
    y = int(round(((obs_lat - (-10.0)) / 35.0) * (height - 1)))
    model_temp = float(cells[y * width + x])
    
    diff = model_temp - obs_temp
    abs_err = abs(diff)
    
    print("\n====================================================================")
    print("  TEST C: MODEL VS OBSERVATION SCIENTIFIC COMPARISON")
    print("====================================================================")
    print(f"Float WMO: 2902084 | Position: ({obs_lat:.3f} N, {obs_lon:.3f} E) | Depth: {obs_depth}m")
    print(f"Authentic Argo In-Situ Temp : {obs_temp:.3f} °C")
    print(f"Authentic CMEMS Model Temp  : {model_temp:.3f} °C")
    print(f"Model Bias (Model - Obs)    : {diff:+.3f} °C")
    print(f"Absolute Error              : {abs_err:.3f} °C")
    print("Notice: Model and observation are scientifically distinct.")
    print("====================================================================\n")
    
    # Sanity check that both values are physical ocean temperatures in Bay of Bengal
    assert 25.0 <= obs_temp <= 32.0
    assert 25.0 <= model_temp <= 32.0
    assert abs_err < 3.5  # Typical CMEMS-Argo SST difference in Bay of Bengal

if __name__ == "__main__":
    test_c_plus_plus_binary_tile_format()
    print("[PASS] Test 1: C++ Binary Tile Format Verified")
    test_api_tile_serving_authentic_cpp()
    print("[PASS] Test 2: API Tile Serving Verified")
    test_missing_data_returns_404_no_synthetic()
    print("[PASS] Test 3: Missing Data Explicit 404 Verified")
    norm_records = test_argo_netcdf_observation_pipeline()
    print("[PASS] Test 4: Argo NetCDF Observation Pipeline Verified")
    test_model_vs_observation_scientific_comparison(norm_records)
    print("[PASS] Test 5: Model vs Observation Scientific Validation Verified")
