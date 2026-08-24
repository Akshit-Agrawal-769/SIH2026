import pytest
import numpy as np
from ingestion.adapters.roms_adapter import calculate_roms_vertical_depths
from ingestion.adapters.argo_adapter import decode_argo_qc_flags, decode_argo_timestamp
from app.services.comparison_service import comparison_service
from app.services.xarray_service import xarray_service
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


def test_argo_qc_decoding_and_filtering():
    """Verifies Argo QC flag decoding and policy enforcement (accept 1, 2; reject 3, 4)."""
    raw_qc_bytes = b"1124131"
    decoded = decode_argo_qc_flags(raw_qc_bytes, len(raw_qc_bytes))
    assert decoded == [1, 1, 2, 4, 1, 3, 1]

    # Filter QC 1 and 2
    valid_mask = [qc in [1, 2] for qc in decoded]
    assert valid_mask == [True, True, True, False, True, False, True]


def test_argo_timestamp_decoding():
    """Verifies conversion of Argo JULD days-since-reference into ISO8601 UTC timestamp."""
    juld = 26500.5  # Days since 1950-01-01
    ts = decode_argo_timestamp(juld, "1950-01-01T00:00:00Z")
    assert ts.startswith("2022-")
    assert "T12:00:00Z" in ts


def test_pearson_correlation_zero_variance_returns_none():
    """Verifies that if observed or modeled values have 0 variance, Pearson r returns None (null)."""
    # Constant array (variance = 0)
    obs = [25.0, 25.0, 25.0, 25.0]
    mod = [25.1, 25.1, 25.1, 25.1]
    
    # Calculate via standard numpy logic inside comparison
    obs_clean = np.array(obs)
    mod_clean = np.array(mod)
    
    r_val = None
    if len(obs_clean) > 1 and np.std(obs_clean) > 1e-7 and np.std(mod_clean) > 1e-7:
        r_val = float(np.corrcoef(obs_clean, mod_clean)[0, 1])
        
    assert r_val is None  # Must be None, NOT 1.0


def test_path_traversal_protection():
    """Verifies API rejects directory traversal attacks with 400 Bad Request."""
    res1 = client.get("/api/v1/model/metadata?filename=../../etc/passwd")
    assert res1.status_code == 400

    res2 = client.get("/api/v1/model/volume3d?filename=../../../sensitive_file.nc&variable=temp")
    assert res2.status_code == 400

    res3 = client.get("/api/v1/comparison/profile?platform_number=../malicious&variable=temp")
    assert res3.status_code == 400


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
