import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data

def test_model_datasets():
    res = client.get("/api/v1/model/datasets")
    assert res.status_code == 200

def test_model_metadata():
    datasets_res = client.get("/api/v1/model/datasets")
    datasets = datasets_res.json().get("datasets", [])
    if datasets:
        filename = datasets[0]
        res = client.get(f"/api/v1/model/metadata?filename={filename}")
        assert res.status_code == 200
        data = res.json()
        assert "variables" in data

def test_model_slice_2d():
    datasets_res = client.get("/api/v1/model/datasets")
    datasets = datasets_res.json().get("datasets", [])
    if datasets:
        filename = datasets[0]
        res = client.get(f"/api/v1/model/slice2d?filename={filename}&variable=temp&time_idx=0&depth_idx=0")
        assert res.status_code == 200
        assert len(res.content) > 0

def test_model_volume_3d():
    datasets_res = client.get("/api/v1/model/datasets")
    datasets = datasets_res.json().get("datasets", [])
    if datasets:
        filename = datasets[0]
        res = client.get(f"/api/v1/model/volume3d?filename={filename}&variable=temp&time_idx=0&dim_x=64&dim_y=64&dim_z=32")
        assert res.status_code == 200
        assert len(res.content) == 64 * 64 * 32 * 4

def test_argo_observations():
    res = client.get("/api/v1/observations/argo")
    assert res.status_code == 200

def test_comparison_profile():
    argo_res = client.get("/api/v1/observations/argo")
    floats = argo_res.json()
    if floats:
        wmo = floats[0]["platform_number"]
        res = client.get(f"/api/v1/comparison/profile?platform_number={wmo}&variable=temp")
        assert res.status_code == 200
        data = res.json()
        assert "metrics" in data
