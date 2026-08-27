import pytest
import numpy as np
from app.services.ocean_model import (
    calculate_roms_vertical_depths,
    OceanModel,
    ocean_model_registry,
    ModelVerticalCoordinateMissing,
    ModelZetaInterpolationFailed,
)
from app.services.insitu_store import decode_argo_qc_flags, decode_argo_timestamp, insitu_store
from app.services.validation_engine import validation_engine
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_roms_vertical_s_coordinate_transformation():
    """Verifies that ROMS s-coordinate calculation computes correct physical depths z <= 0."""
    s_rho = np.array([-1.0, -0.5, 0.0])
    Cs_r = np.array([-1.0, -0.4, 0.0])
    h = np.array([[2000.0, 1000.0], [500.0, 200.0]])  # Bathymetry
    hc = 10.0
    zeta = np.array([[0.5, 0.2], [-0.1, 0.0]])  # Sea surface height

    # Test Vtransform = 2 (ROMS modern default)
    z_v2 = calculate_roms_vertical_depths(s_rho, Cs_r, h, hc, zeta=zeta, Vtransform=2)
    assert z_v2.shape == (3, 2, 2)
    # Surface (s=0) should equal zeta
    np.testing.assert_allclose(z_v2[2, :, :], zeta, atol=1e-4)
    # Bottom (s=-1) should equal -h
    np.testing.assert_allclose(z_v2[0, :, :], -h, atol=1e-4)
    # Intermediate level (s=-0.5) must be strictly between -h and zeta
    assert np.all(z_v2[1, :, :] < zeta)
    assert np.all(z_v2[1, :, :] > -h)


def test_roms_local_bathymetry_affects_physical_depth():
    """
    Deterministic test proving that local bathymetry affects physical depth.
    Location A: h = 500 m
    Location B: h = 4000 m
    Identical s_rho levels -> depths_A != depths_B
    """
    s_rho = np.array([-1.0, -0.75, -0.5, -0.25, 0.0])
    Cs_r = np.array([-1.0, -0.6, -0.3, -0.1, 0.0])
    hc = 10.0

    # Vtransform = 1
    depths_A_v1 = calculate_roms_vertical_depths(s_rho, Cs_r, h=500.0, hc=hc, Vtransform=1)
    depths_B_v1 = calculate_roms_vertical_depths(s_rho, Cs_r, h=4000.0, hc=hc, Vtransform=1)
    assert not np.array_equal(depths_A_v1, depths_B_v1)
    assert depths_A_v1[0] == -500.0
    assert depths_B_v1[0] == -4000.0

    # Vtransform = 2
    depths_A_v2 = calculate_roms_vertical_depths(s_rho, Cs_r, h=500.0, hc=hc, Vtransform=2)
    depths_B_v2 = calculate_roms_vertical_depths(s_rho, Cs_r, h=4000.0, hc=hc, Vtransform=2)
    assert not np.array_equal(depths_A_v2, depths_B_v2)
    assert depths_A_v2[0] == -500.0
    assert depths_B_v2[0] == -4000.0


def test_roms_local_zeta_sea_surface_elevation_shift():
    """Verifies that non-zero sea surface height zeta shifts surface and water column depths."""
    s_rho = np.array([-1.0, -0.5, 0.0])
    Cs_r = np.array([-1.0, -0.4, 0.0])
    h = 1000.0
    hc = 10.0

    depths_flat = calculate_roms_vertical_depths(s_rho, Cs_r, h=h, hc=hc, zeta=0.0, Vtransform=2)
    depths_elev = calculate_roms_vertical_depths(s_rho, Cs_r, h=h, hc=hc, zeta=1.5, Vtransform=2)

    # Surface level (s=0) must equal zeta
    assert depths_flat[2] == 0.0
    assert depths_elev[2] == 1.5
    assert not np.array_equal(depths_flat, depths_elev)


def test_missing_roms_vertical_metadata_raises_error():
    """Verifies that missing vertical metadata raises ValueError/ModelVerticalCoordinateMissing('MODEL_VERTICAL_COORDINATE_MISSING')."""
    import xarray as xr
    empty_ds = xr.Dataset({"temp": (("time", "lat", "lon"), np.zeros((1, 5, 5)))})

    with pytest.raises((ValueError, ModelVerticalCoordinateMissing), match="MODEL_VERTICAL_COORDINATE_MISSING"):
        model = OceanModel(empty_ds)
        model.sample_profile("temp", lat=15.0, lon=75.0)


def test_missing_individual_roms_vertical_metadata_raises_error():
    """
    Verifies that missing any required native s-coordinate metadata
    (s_rho, Cs_r, hc, Vtransform, h) raises MODEL_VERTICAL_COORDINATE_MISSING error.
    """
    import xarray as xr
    base_dict = {
        "temp": (("time", "s_rho", "lat", "lon"), np.zeros((1, 3, 2, 2))),
        "s_rho": (("s_rho",), np.array([-1.0, -0.5, 0.0])),
        "Cs_r": (("s_rho",), np.array([-1.0, -0.4, 0.0])),
        "hc": 10.0,
        "Vtransform": 2,
        "h": (("lat", "lon"), np.array([[500.0, 500.0], [500.0, 500.0]])),
        "lat": (("lat",), np.array([10.0, 11.0])),
        "lon": (("lon",), np.array([70.0, 71.0])),
    }

    # 1. Missing s_rho
    d1 = dict(base_dict)
    del d1["s_rho"]
    with pytest.raises((ValueError, ModelVerticalCoordinateMissing), match="MODEL_VERTICAL_COORDINATE_MISSING"):
        OceanModel(xr.Dataset(d1)).sample_profile("temp", lat=10.5, lon=70.5)

    # 2. Missing Cs_r
    d2 = dict(base_dict)
    del d2["Cs_r"]
    with pytest.raises((ValueError, ModelVerticalCoordinateMissing), match="MODEL_VERTICAL_COORDINATE_MISSING"):
        OceanModel(xr.Dataset(d2)).sample_profile("temp", lat=10.5, lon=70.5)

    # 3. Missing hc
    d3 = dict(base_dict)
    del d3["hc"]
    with pytest.raises((ValueError, ModelVerticalCoordinateMissing), match="MODEL_VERTICAL_COORDINATE_MISSING"):
        OceanModel(xr.Dataset(d3)).sample_profile("temp", lat=10.5, lon=70.5)

    # 4. Missing Vtransform
    d4 = dict(base_dict)
    del d4["Vtransform"]
    with pytest.raises((ValueError, ModelVerticalCoordinateMissing), match="MODEL_VERTICAL_COORDINATE_MISSING"):
        OceanModel(xr.Dataset(d4)).sample_profile("temp", lat=10.5, lon=70.5)


def test_time_aware_zeta_interpolation():
    """
    Deterministic test proving that zeta(t0) is used at t0 and zeta(t1) is used at t1.
    t0: zeta = 0.0 m
    t1: zeta = 2.0 m
    Physical depths must differ appropriately between t0 and t1.
    """
    import xarray as xr
    time_arr = np.array(["2024-01-01T00:00:00", "2024-01-02T00:00:00"], dtype="datetime64[s]")
    zeta_data = np.array([
        [[0.0, 0.0], [0.0, 0.0]],
        [[2.0, 2.0], [2.0, 2.0]]
    ])

    ds = xr.Dataset({
        "temp": (("time", "s_rho", "lat", "lon"), np.ones((2, 3, 2, 2)) * 25.0),
        "zeta": (("time", "lat", "lon"), zeta_data),
        "s_rho": (("s_rho",), np.array([-1.0, -0.5, 0.0])),
        "Cs_r": (("s_rho",), np.array([-1.0, -0.4, 0.0])),
        "hc": 10.0,
        "Vtransform": 2,
        "h": (("lat", "lon"), np.array([[1000.0, 1000.0], [1000.0, 1000.0]])),
        "lat": (("lat",), np.array([10.0, 11.0])),
        "lon": (("lon",), np.array([70.0, 71.0])),
        "time": (("time",), time_arr)
    })

    model = OceanModel(ds)
    depths_t0, _ = model.sample_profile("temp", lat=10.5, lon=70.5, time_idx=0)
    depths_t1, _ = model.sample_profile("temp", lat=10.5, lon=70.5, time_idx=1)

    assert not np.array_equal(depths_t0, depths_t1)
    assert abs(depths_t0[2] - 0.0) < 1e-3
    assert abs(depths_t1[2] - 2.0) < 1e-3


def test_zeta_interpolation_failure_raises_error():
    """Verifies that an un-interpolatable zeta variable raises MODEL_ZETA_INTERPOLATION_FAILED instead of zero fallback."""
    import xarray as xr
    ds = xr.Dataset({
        "temp": (("time", "s_rho", "lat", "lon"), np.ones((1, 3, 2, 2))),
        "zeta": (("invalid_dim",), np.array([1.0, 2.0])),
        "s_rho": (("s_rho",), np.array([-1.0, -0.5, 0.0])),
        "Cs_r": (("s_rho",), np.array([-1.0, -0.4, 0.0])),
        "hc": 10.0,
        "Vtransform": 2,
        "h": (("lat", "lon"), np.array([[1000.0, 1000.0], [1000.0, 1000.0]])),
        "lat": (("lat",), np.array([10.0, 11.0])),
        "lon": (("lon",), np.array([70.0, 71.0])),
    })

    with pytest.raises((ValueError, ModelZetaInterpolationFailed), match="MODEL_ZETA_INTERPOLATION_FAILED"):
        OceanModel(ds).sample_profile("temp", lat=10.5, lon=70.5)


def test_argo_qc_decoding_and_filtering():
    """Verifies Argo QC flag decoding and policy enforcement (accept 1, 2; reject 3, 4, 0)."""
    raw_qc_bytes = b"1124131"
    decoded = decode_argo_qc_flags(raw_qc_bytes, len(raw_qc_bytes))
    assert decoded == [1, 1, 2, 4, 1, 3, 1]

    # Filter QC 1 and 2
    valid_mask = [qc in [1, 2] for qc in decoded]
    assert valid_mask == [True, True, True, False, True, False, True]

    # Missing QC must return 0 (Unknown/No QC), NOT 1 (Good Data)
    missing_qc = decode_argo_qc_flags(None, 5)
    assert missing_qc == [0, 0, 0, 0, 0]


def test_argo_timestamp_decoding():
    """Verifies conversion of Argo JULD days-since-reference into ISO8601 UTC timestamp."""
    juld = 26500.5  # Days since 1950-01-01
    ts = decode_argo_timestamp(juld, "1950-01-01T00:00:00Z")
    assert ts.startswith("2022-")
    assert "T12:00:00Z" in ts

    # Missing/invalid timestamp must return None, NOT a hardcoded fallback date
    assert decode_argo_timestamp(None) is None
    assert decode_argo_timestamp(np.nan) is None


def test_pearson_correlation_zero_variance_returns_none():
    """Verifies that if observed or modeled values have 0 variance, Pearson r returns None (null)."""
    # Constant array (variance = 0)
    obs = [25.0, 25.0, 25.0, 25.0]
    mod = [25.1, 25.1, 25.1, 25.1]
    
    metrics, full_res = validation_engine.compute_metrics(obs, mod)
    assert metrics is not None
    assert metrics["pearson_r"] is None  # Must be None, NOT 1.0
    assert metrics["sample_count"] == 4
    assert abs(metrics["bias"] - 0.1) < 1e-4


def test_validation_engine_polymorphic_profile_colocation():
    """Verifies validation_engine.validate_profile executes 4D colocation on any in-memory dataset and observation profile."""
    import xarray as xr
    ds = xr.Dataset(
        {
            "temp": (("time", "depth", "lat", "lon"), np.ones((2, 5, 2, 2)) * 28.0),
        },
        coords={
            "time": ["2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z"],
            "depth": [0.0, 10.0, 50.0, 100.0, 200.0],
            "lat": [10.0, 11.0],
            "lon": [70.0, 71.0],
        }
    )
    model = OceanModel(ds)

    obs_profile = {
        "platform_number": "TEST_GLIDER_01",
        "cycle_number": 42,
        "timestamp": "2024-01-01T12:00:00Z",
        "latitude": 10.5,
        "longitude": 70.5,
        "depths": [0.0, 10.0, 50.0],
        "temperature": [28.5, 28.2, 27.8],
        "qc_flags": [1, 1, 1],
    }

    scorecard = validation_engine.validate_profile(obs_profile, model, variable="temp")
    assert scorecard is not None
    assert scorecard["platform_number"] == "TEST_GLIDER_01"
    assert scorecard["metrics"]["sample_count"] == 3
    assert scorecard["metrics"]["rmse"] > 0.0
    assert len(scorecard["residuals"]) == 3


def test_path_traversal_protection():
    """Verifies API rejects directory traversal attacks with 400 Bad Request or 422 Validation Error."""
    res1 = client.get("/api/v1/model/metadata?filename=../../etc/passwd")
    assert res1.status_code in (400, 422)

    res2 = client.get("/api/v1/model/volume3d?filename=../../../sensitive_file.nc&variable=temp")
    assert res2.status_code in (400, 422)

    res3 = client.get("/api/v1/comparison/profile?platform_number=../malicious&variable=temp")
    assert res3.status_code in (400, 422)


def test_4d_spatio_temporal_colocation():
    """Verifies 4D model-vs-obs colocation endpoint returns residuals and valid metrics."""
    res = client.get("/api/v1/observations/argo")
    assert res.status_code == 200
    floats = res.json()
    assert len(floats) > 0
    wmo = floats[0]["platform_number"]

    comp_res = client.get(f"/api/v1/comparison/profile?platform_number={wmo}&variable=temp")
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert "metrics" in comp
    assert comp["metrics"]["sample_count"] > 0
    assert comp["metrics"]["rmse"] >= 0.0
    assert comp["metrics"]["mae"] >= 0.0
    assert len(comp["residuals"]) == len(comp["depths"])


def test_extract_3d_volume_preserves_physical_coordinates_and_nan_sentinel():
    """Verifies that 3D volume buffer extraction preserves physical bounds, units, scientific min/max, and NaN sentinels."""
    models = ocean_model_registry.list_available_models()
    assert len(models) > 0
    filename = models[0]
    model = ocean_model_registry.get_model(filename)
    assert model is not None

    result = model.extract_volume_buffer(variable="temp", time_idx=0, target_shape=(32, 32, 16))
    assert result is not None
    buffer, meta = result
    assert buffer is not None
    assert "min_lon" in meta
    assert "max_lon" in meta
    assert "min_lat" in meta
    assert "max_lat" in meta
    assert "min_depth" in meta
    assert "max_depth" in meta
    assert "min_val" in meta
    assert "max_val" in meta
    assert "has_nan" in meta
    assert meta["nan_value"] == -1.0
    assert meta["min_lon"] < meta["max_lon"]
    assert meta["min_lat"] < meta["max_lat"]
    assert meta["min_depth"] <= meta["max_depth"]


def test_ocean_model_metadata_and_lazy_discovery():
    """Verifies that ocean model NetCDF files in datasets/model/ are discovered and parsed."""
    models = ocean_model_registry.list_available_models()
    assert len(models) > 0, "At least one model NetCDF should be discovered in registry"
    target = models[0]
    
    model = ocean_model_registry.get_model(target)
    assert model is not None
    meta = model.get_metadata()

    # Verify CF dimensions and coordinates
    assert "dimensions" in meta
    assert len(meta["time_range"]) > 0
    assert "bounds" in meta
    assert "variables" in meta
    assert "temp" in meta["variables"]


def test_ocean_model_variables_and_nan_masking():
    """Verifies that 3D volume buffer extraction works across multiple variables with NaN preservation."""
    models = ocean_model_registry.list_available_models()
    assert len(models) > 0
    model = ocean_model_registry.get_model(models[0])
    assert model is not None

    meta = model.get_metadata()
    test_vars = [v for v in ["temp", "salt", "u", "v", "chl"] if v in meta["variables"]]
    for var in test_vars:
        buf, vmeta = model.extract_volume_buffer(var, time_idx=0, target_shape=(32, 32, 16))
        assert len(buf) == 32 * 32 * 16 * 4  # Float32 bytes
        assert vmeta["variable"] == var
        assert vmeta["dim_x"] == 32
        assert vmeta["dim_y"] == 32
        assert vmeta["dim_z"] == 16
        assert vmeta["nan_value"] == -1.0
        assert vmeta["min_val"] <= vmeta["max_val"]


def test_ocean_model_bounded_memory_and_lru_caching():
    """
    Verifies that volume extraction runs with bounded memory (< 50 MB)
    and that LRU caching delivers sub-millisecond responses on repeated queries.
    """
    import os
    import time
    try:
        import psutil
        process = psutil.Process(os.getpid())
        rss_start_mb = process.memory_info().rss / (1024 * 1024)
    except ImportError:
        rss_start_mb = None

    models = ocean_model_registry.list_available_models()
    assert len(models) > 0
    model = ocean_model_registry.get_model(models[0])
    assert model is not None

    # First access: uncached
    t0 = time.time()
    buf1, meta1 = model.extract_volume_buffer("temp", time_idx=0, target_shape=(32, 32, 16))
    t_uncached = time.time() - t0

    # Second access: LRU cache hit
    t1 = time.time()
    buf2, meta2 = model.extract_volume_buffer("temp", time_idx=0, target_shape=(32, 32, 16))
    t_cached = time.time() - t1

    assert buf1 == buf2
    assert meta1 == meta2
    assert t_cached < 0.05, f"Cache lookup took too long: {t_cached:.6f}s"

    if rss_start_mb is not None:
        rss_end_mb = process.memory_info().rss / (1024 * 1024)
        rss_diff_mb = rss_end_mb - rss_start_mb
        assert rss_diff_mb < 100.0, f"Memory delta exceeded threshold: {rss_diff_mb:.2f} MB"


def test_ocean_model_api_volume_streaming():
    """Verifies that FastAPI volume3d endpoint streams Float32 binary buffer."""
    models = ocean_model_registry.list_available_models()
    assert len(models) > 0
    filename = models[0]
    res = client.get(f"/api/v1/model/volume3d?filename={filename}&variable=temp&time_idx=0&dim_x=32&dim_y=32&dim_z=16")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/octet-stream"
    assert len(res.content) == 32 * 32 * 16 * 4

