"""
Integration tests against the committed, authentic data catalog
(frontend/public, built by scripts/build_authentic_dataset.py) and the FastAPI app.
"""
import io
import json
import os
import struct

import netCDF4 as nc
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import analytics_engine as ae
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _root(real_root):
    return real_root


def test_every_catalogued_tile_exists_and_matches_header(real_root):
    cat = ae.get_catalog()
    g = cat["grid"]
    assert (g["width"], g["height"], g["dlon"], g["dlat"]) == (520, 280, 0.125, 0.125)
    for var, meta in cat["variables"].items():
        assert meta["timesteps"] == sorted(meta["timesteps"]) and len(set(meta["timesteps"])) == len(meta["timesteps"])
        for d in meta["timesteps"]:
            for z in meta["depths"]:
                path = ae.tile_path(var, d, z)
                assert path, (var, d, z)
                with open(path, "rb") as f:
                    header, arr = ae.parse_tile(f.read(), meta["var_code"])
                assert (header["width"], header["height"]) == (520, 280)
                assert np.isfinite(arr).sum() > 10000


def test_monthly_fields_are_distinct_in_time(real_root):
    """Guards against copying one field to many dates (fabricated temporal progression)."""
    for var in ("temperature", "salinity", "chlorophyll", "mld"):
        ts = ae.timesteps(var)
        digests = {ae.load_tile(var, d, 0.0).tobytes() for d in ts}
        assert len(digests) == len(ts), var


def test_no_fabricated_platforms_and_valid_json(real_root):
    inst = ae.load_instruments()
    assert {f["properties"]["platform_type"] for f in inst["features"]} == {"argo"}
    prof_dir = os.path.join(real_root, "api", "profiles")
    for name in os.listdir(prof_dir):
        text = open(os.path.join(prof_dir, name), encoding="utf-8").read()
        assert "NaN" not in text and "Infinity" not in text
        prof = json.loads(text)
        assert prof["metadata"]["qc_policy"].startswith("Argo QC flags 1")
        depths = [m["depth"] for m in prof["measurements"]]
        assert depths == sorted(depths) and depths[0] >= 0


def test_latest_profile_is_newest_cycle_in_source_file(real_root):
    prof = ae.load_profile("ARGO_2902084")
    src = os.path.join(real_root, "..", "..", "datasets", "argo", "incois_2902084_prof.nc")
    if not os.path.exists(src):
        pytest.skip("source NetCDF not present (datasets/ is not in git)")
    ds = nc.Dataset(src)
    last = int(np.argmax(ds["JULD"][:]))
    assert prof["cycle_number"] == int(ds["CYCLE_NUMBER"][last])
    ds.close()


def test_comparison_metrics_recomputed_from_pairs(real_root):
    res = ae.compute_model_vs_obs("ARGO_2902120", "temperature")
    assert res["available"] is True
    obs = np.array([p["observation"] for p in res["pairs"]])
    mod = np.array([p["model"] for p in res["pairs"]])
    m = res["metrics"]
    assert m["sample_count"] == len(obs) > 100
    assert m["rmse"] == pytest.approx(np.sqrt(np.mean((mod - obs) ** 2)), abs=1e-3)
    assert m["bias"] == pytest.approx(np.mean(mod - obs), abs=1e-3)
    assert m["pearson_r"] == pytest.approx(np.corrcoef(obs, mod)[0, 1], abs=1e-3)
    assert all(abs(p["model_dt_days"]) <= 15.0 for p in res["pairs"])
    assert all(p["obs_depth"] <= 10.0 for p in res["pairs"])


def test_comparison_without_temporal_overlap_is_explicitly_unavailable(real_root):
    res = ae.compute_model_vs_obs("ARGO_1902594", "temperature")
    assert res["available"] is False and res["metrics"] is None and res["pairs"] == []
    assert "No temporal overlap" in res["reason"]
    assert ae.compute_model_vs_obs("ARGO_1902594", "oxygen")["available"] is False


def test_static_comparison_json_matches_live_engine(real_root):
    for iid in ("ARGO_2902120", "ARGO_1902594"):
        static = json.load(open(os.path.join(real_root, "api", "comparison", f"{iid}__temperature.json"),
                                encoding="utf-8"))
        assert static["metrics"] == ae.compute_model_vs_obs(iid, "temperature")["metrics"]


# ------------------------------------------------------------------ HTTP API

def test_health_endpoints():
    for path in ("/health", "/api/health"):
        r = client.get(path)
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["catalog"] is True and body["status"] == "healthy"


def test_manifest_timesteps_come_from_catalog():
    r = client.get("/api/manifest/temperature")
    assert r.status_code == 200
    assert r.json()["timesteps"] == ae.timesteps("temperature")
    assert client.get("/api/manifest/pressure").status_code == 404


def test_tile_endpoint_serves_real_tiles_and_refuses_everything_else():
    d = ae.latest_timestep("temperature")
    r = client.get(f"/api/tiles/temperature/{d}/0")
    assert r.status_code == 200 and r.headers["x-data-source"] == "ibr"
    magic, _, var_code = struct.unpack("<4sHH", r.content[:8])
    assert magic == b"INCO" and var_code == 1
    assert client.get(f"/api/tiles/temperature/{d}/100").status_code == 404      # no subsurface levels
    assert client.get("/api/tiles/temperature/2024-06-01/0").status_code == 404  # legacy synthetic date
    assert client.get("/api/tiles/temperature/not-a-date/0").status_code == 400
    assert client.get(f"/api/tiles/oxygen/{d}/0").status_code == 404


def test_analytics_endpoints():
    lat, lon = 15.0, 65.0
    ts = client.get("/api/analytics/timeseries", params={"variable": "temperature", "lat": lat, "lon": lon}).json()
    assert ts["available"] and len(ts["timeseries_points"]) == 12
    an = client.get("/api/analytics/anomalies", params={"variable": "temperature", "lat": lat, "lon": lon}).json()
    assert an["available"] and an["date"] == ae.latest_timestep("temperature")
    co = client.get("/api/analytics/correlation", params={"lat": lat, "lon": lon}).json()
    assert co["available"] and "currents" in co["skipped"]  # currents are not co-temporal with IBR
    vp = client.get("/api/analytics/profile", params={"variable": "temperature", "lat": lat, "lon": lon}).json()
    assert vp["available"] is False and vp["model_mld_meters"] is not None
    land = client.get("/api/analytics/anomalies", params={"variable": "temperature", "lat": 20.0, "lon": 78.0}).json()
    assert land["available"] is False
    assert client.get("/api/analytics/timeseries", params={"variable": "temperature"}).status_code == 422


def test_instruments_and_profile_endpoints():
    fc = client.get("/api/instruments").json()
    assert fc["type"] == "FeatureCollection" and len(fc["features"]) == len(ae.get_catalog()["instruments"])
    p = client.get("/api/instruments/ARGO_2902084/profile").json()
    assert p["cycle_number"] == 55 and p["analysis"]["mld_meters"] is not None
    assert client.get("/api/instruments/INCOIS_ARGO_2902084/profile").status_code == 200  # legacy id alias
    assert client.get("/api/instruments/ARGO_0000000/profile").status_code == 404


def test_ingest_requires_admin_token(monkeypatch):
    monkeypatch.delenv("ADMIN_API_TOKEN", raising=False)
    assert client.post("/api/instruments/ingest").status_code == 403
    monkeypatch.setenv("ADMIN_API_TOKEN", "test-token-value")
    assert client.post("/api/instruments/ingest", headers={"X-Admin-Token": "wrong"}).status_code == 401


def test_wms_capabilities_and_getmap():
    caps = client.get("/api/wms", params={"SERVICE": "WMS", "REQUEST": "GetCapabilities"}).text
    for d in ae.timesteps("temperature"):
        assert d in caps
    assert "2024-06-14" not in caps and "EPSG:3857" not in caps
    r = client.get("/api/wms", params={"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap",
                                       "LAYERS": "temperature", "CRS": "EPSG:4326",
                                       "BBOX": "5,60,20,75", "WIDTH": 64, "HEIGHT": 64, "FORMAT": "image/png"})
    assert r.status_code == 200 and r.content[:8] == b"\x89PNG\r\n\x1a\n"
    bad = client.get("/api/wms", params={"REQUEST": "GetMap", "LAYERS": "nope", "BBOX": "60,5,75,20"})
    assert bad.status_code == 400
    merc = client.get("/api/wms", params={"REQUEST": "GetMap", "LAYERS": "temperature", "CRS": "EPSG:3857",
                                          "BBOX": "0,0,1,1"})
    assert merc.status_code == 400


def test_netcdf_export_subset_is_exact(tmp_path):
    d = ae.latest_timestep("temperature")
    r = client.get("/api/export/netcdf", params={"variable": "temperature", "date": d, "min_lon": 60, "max_lon": 62,
                                                "min_lat": 10, "max_lat": 11})
    assert r.status_code == 200
    out = tmp_path / "x.nc"
    out.write_bytes(r.content)
    with nc.Dataset(out) as ds:
        lats, lons = ds["latitude"][:], ds["longitude"][:]
        assert lats.min() >= 10 and lats.max() <= 11 and lons.min() >= 60 and lons.max() <= 62
        assert list(ds["depth"][:]) == [0.0]
        tile = ae.load_tile("temperature", d, 0.0)
        g = ae.grid()
        j = int(round((lats[0] - g["lat0"]) / g["dlat"]))
        i = int(round((lons[0] - g["lon0"]) / g["dlon"]))
        assert float(ds["temperature"][0, 0, 0, 0]) == pytest.approx(tile[j, i], abs=1e-5)
