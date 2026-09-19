import os
import sys
import pytest
import numpy as np

# Ensure api and project root are in sys.path
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
api_dir = os.path.join(repo_root, "api")
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

import analytics_engine as ae
from api.index import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_model_vs_obs_collocation_real_float():
    """Verify authentic collocation on real Argo float 2902084 in Bay of Bengal."""
    res = ae.compute_model_vs_obs("2902084", "temperature", "2024-06-03")
    assert res["available"] is True
    assert res["instrument_id"] in ("2902084", "INCOIS_ARGO_2902084")
    assert res["variable"] == "temperature"
    assert res["units"] == "°C"
    assert res["data_policy"] == "STRICT_REAL_DATA_ZERO_SYNTHETIC"

    metrics = res["metrics"]
    assert metrics is not None
    assert metrics["sample_count"] > 50
    assert metrics["rmse"] > 0.0
    assert metrics["mae"] > 0.0
    # Bio-ROMS strongly correlates with real Argo CTD profile in Indian Ocean (r > 0.95)
    assert metrics["pearson_r"] is not None
    assert metrics["pearson_r"] > 0.90
    assert metrics["r_squared"] is not None
    assert metrics["r_squared"] > 0.80

    profiles = res["depth_profiles"]
    assert len(profiles) == metrics["sample_count"]
    # Check depth profile structure
    p0 = profiles[0]
    assert "depth" in p0
    assert "observation" in p0
    assert "model" in p0
    assert "residual" in p0
    assert abs(p0["residual"] - (p0["model"] - p0["observation"])) < 1e-3

def test_zero_mock_enforcement_missing_and_land():
    """Verify strict Zero-Mock: missing floats and land coordinates return explicit unavailable states."""
    # Non-existent float
    res_fake = ae.compute_model_vs_obs("FAKE_FLOAT_999999", "temperature")
    assert res_fake["available"] is False
    assert res_fake["metrics"] is None
    assert res_fake["depth_profiles"] == []

    # Timeseries on land (central India 20.0°N, 78.0°E)
    res_land_ts = ae.compute_timeseries("temperature", 20.0, 78.0, 10.0)
    assert res_land_ts["available"] is False
    assert res_land_ts["timeline"] == []

    # Anomaly on land
    res_land_anom = ae.compute_anomalies("temperature", 20.0, 78.0, 10.0)
    assert res_land_anom["available"] is False

    # Out of bounds coordinates (North Atlantic 50.0°N, -30.0°E)
    res_oob = ae.compute_timeseries("temperature", 50.0, -30.0, 10.0)
    assert res_oob["available"] is False

def test_timeseries_trend_metrics():
    """Verify multi-day time series and trend slope calculations."""
    res = ae.compute_timeseries("temperature", 13.691, 88.074, depth=10.0)
    assert res["available"] is True
    assert len(res["timeline"]) == 5
    assert res["start_value"] is not None
    assert res["end_value"] is not None
    assert abs(res["delta"] - (res["end_value"] - res["start_value"])) < 1e-3
    assert res["min"] <= res["mean"] <= res["max"]

def test_anomaly_zscore_calculation():
    """Verify authentic Z-score calculation: z = (x - mean) / std."""
    res = ae.compute_anomalies("temperature", 13.691, 88.074, depth=10.0, date="2024-06-03")
    assert res["available"] is True
    val = res["value"]
    mean = res["baseline_mean"]
    std = res["baseline_std"]
    z = res["z_score"]

    expected_z = round((val - mean) / std, 2)
    assert abs(z - expected_z) < 0.05
    assert res["classification"] in ("Normal", "Moderate Anomaly", "Strong Anomaly")

def test_correlation_matrix():
    """Verify NxN Pearson correlation matrix across physical variables."""
    res = ae.compute_correlation(13.691, 88.074, depth=10.0, date="2024-06-03")
    assert res["available"] is True
    assert len(res["variables"]) >= 3
    assert res["sample_count"] >= 5

    matrix = res["matrix"]
    n_vars = len(res["variables"])
    assert len(matrix) == n_vars

    # Diagonals must be 1.0 and matrix must be symmetric
    for i in range(n_vars):
        assert abs(matrix[i][i] - 1.0) < 1e-2
        for j in range(n_vars):
            assert abs(matrix[i][j] - matrix[j][i]) < 1e-2

def test_vertical_profile_stratification():
    """Verify vertical column sounding and stratification indices."""
    res = ae.compute_vertical_profile_analysis(13.691, 88.074, "temperature", "2024-06-03")
    assert res["available"] is True
    assert len(res["levels"]) == 8 # 8 standard depths (0.5m to 2000m)
    assert res["surface_value"] is not None
    assert res["bottom_value"] is not None
    # In tropical ocean, surface temperature is substantially warmer than abyssal depth
    assert res["surface_value"] > res["bottom_value"]
    assert res["thermocline_depth_meters"] is not None
    assert res["max_gradient"] > 0.0

def test_fastapi_endpoints_end_to_end():
    """Verify FastAPI routes return HTTP 200 and schema conforming responses."""
    # 1. Comparison endpoint
    r1 = client.get("/api/comparison/2902084?variable=temperature")
    assert r1.status_code == 200
    assert r1.json()["available"] is True
    assert r1.json()["metrics"]["sample_count"] > 0

    # 2. Timeseries endpoint
    r2 = client.get("/api/analytics/timeseries?variable=temperature&lat=13.691&lon=88.074&depth=10.0")
    assert r2.status_code == 200
    assert r2.json()["available"] is True

    # 3. Anomalies endpoint
    r3 = client.get("/api/analytics/anomalies?variable=temperature&lat=13.691&lon=88.074&depth=10.0")
    assert r3.status_code == 200
    assert r3.json()["available"] is True

    # 4. Correlation endpoint
    r4 = client.get("/api/analytics/correlation?lat=13.691&lon=88.074&depth=10.0")
    assert r4.status_code == 200
    assert r4.json()["available"] is True

    # 5. Profile endpoint
    r5 = client.get("/api/analytics/profile?lat=13.691&lon=88.074&variable=temperature")
    assert r5.status_code == 200
    assert r5.json()["available"] is True
