import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["healthy", "operational"]
    assert "version" in data
    assert "name" in data

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "available_datasets" in data
    assert data["data_policy"] == "STRICT NO MOCK DATA"

def test_model_datasets_list():
    response = client.get("/api/v1/model/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "datasets" in data
    assert isinstance(data["datasets"], list)
    assert len(data["datasets"]) > 0

def test_model_metadata():
    response = client.get("/api/v1/model/datasets")
    assert response.status_code == 200
    filename = response.json()["datasets"][0]
    
    meta_response = client.get(f"/api/v1/model/metadata?filename={filename}")
    assert meta_response.status_code == 200
    meta = meta_response.json()
    assert meta["filename"] == filename
    assert "bounds" in meta
    assert "depth_levels" in meta
    assert "variables" in meta
    assert "temp" in meta["variables"] or "salt" in meta["variables"]

def test_model_volume3d_binary():
    response = client.get("/api/v1/model/datasets")
    filename = response.json()["datasets"][0]
    
    response = client.get(
        f"/api/v1/model/volume3d?filename={filename}&variable=temp&time_idx=0&dim_x=32&dim_y=32&dim_z=16"
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert "x-data-min" in response.headers
    assert "x-data-max" in response.headers
    assert "x-has-nan" in response.headers
    assert "x-nan-value" in response.headers
    assert "x-units" in response.headers
    assert len(response.content) == 32 * 32 * 16 * 4  # 32x32x16 Float32 bytes

def test_observations_argo_sources():
    response = client.get("/api/v1/observations/sources")
    assert response.status_code == 200
    sources = response.json()
    assert isinstance(sources, list)
    assert len(sources) > 0
    assert any(s["source"] == "coriolis" for s in sources)

def test_observations_argo_metadata():
    response = client.get("/api/v1/observations/metadata")
    assert response.status_code == 200
    meta = response.json()
    assert meta["total_platforms"] >= 100
    assert meta["total_profiles"] >= 10000
    assert "coriolis" in meta["providers"]

def test_observations_argo_floats():
    response = client.get("/api/v1/observations/argo")
    assert response.status_code == 200
    floats = response.json()
    assert isinstance(floats, list)
    assert len(floats) > 0
    wmo = floats[0]["platform_number"]

    # Test profile endpoint for Coriolis float
    prof_res = client.get(f"/api/v1/observations/argo/{wmo}/profile")
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert "depths" in prof
    assert "temperature" in prof
    assert len(prof["depths"]) > 0

def test_model_vs_obs_comparison():
    # Query floats within ROMS model spatial domain
    floats = client.get("/api/v1/observations/argo?min_lat=4.0&max_lat=26.0&min_lon=58.0&max_lon=96.0").json()
    wmo = floats[0]["platform_number"] if floats else "2902084"
    response = client.get(f"/api/v1/comparison/profile?platform_number={wmo}&variable=temp")
    assert response.status_code == 200
    comp = response.json()
    assert "metrics" in comp
    assert "rmse" in comp["metrics"]
    assert "mae" in comp["metrics"]
    assert "bias" in comp["metrics"]
    assert "pearson_r" in comp["metrics"]
    assert "residuals" in comp
    assert len(comp["residuals"]) == len(comp["depths"])
