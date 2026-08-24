import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["policy"] == "STRICT NO MOCK DATA"

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert len(data["available_datasets"]) > 0

def test_model_datasets_list():
    response = client.get("/api/v1/model/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "datasets" in data
    assert len(data["datasets"]) > 0

def test_model_metadata():
    datasets = client.get("/api/v1/model/datasets").json()["datasets"]
    filename = datasets[0]
    response = client.get(f"/api/v1/model/metadata?filename={filename}")
    assert response.status_code == 200
    meta = response.json()
    assert "bounds" in meta
    assert "depth_levels" in meta
    assert "variables" in meta
    assert len(meta["variables"]) > 0

def test_model_volume3d_binary():
    datasets = client.get("/api/v1/model/datasets").json()["datasets"]
    filename = datasets[0]
    meta = client.get(f"/api/v1/model/metadata?filename={filename}").json()
    var_name = meta["variables"][0]
    response = client.get(f"/api/v1/model/volume3d?filename={filename}&variable={var_name}&dim_x=32&dim_y=32&dim_z=16")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert "x-data-min" in response.headers
    assert "x-data-max" in response.headers
    assert len(response.content) == 32 * 32 * 16 * 4  # 32x32x16 Float32 bytes

def test_observations_argo_floats():
    response = client.get("/api/v1/observations/argo")
    assert response.status_code == 200
    floats = response.json()
    assert isinstance(floats, list)
    assert len(floats) > 0
    wmo = floats[0]["platform_number"]

    # Test profile endpoint
    prof_res = client.get(f"/api/v1/observations/argo/{wmo}/profile")
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert "depths" in prof
    assert "temperature" in prof
    assert len(prof["depths"]) > 0

def test_model_vs_obs_comparison():
    floats = client.get("/api/v1/observations/argo").json()
    wmo = floats[0]["platform_number"]
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
