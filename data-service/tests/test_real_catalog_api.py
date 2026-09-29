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


@pytest.fixture(scope="module")
def argo():
    from app import argo_store
    try:
        argo_store.platforms()
    except argo_store.ArgoUnavailable as exc:
        pytest.skip(f"Argo archive unreachable: {exc}")
    return argo_store


def _floats_with_profiles(argo, n):
    return [p for p in argo.platforms() if p.get("tar")][:n]


def test_every_archived_float_is_listed(argo):
    inst = ae.load_instruments()
    feats = inst["features"]
    assert len(feats) == len(argo.platforms()) > 1000
    assert {f["properties"]["platform_type"] for f in feats} == {"argo"}
    assert len({f["id"] for f in feats}) == len(feats)
    for f in feats:
        lon, lat = f["geometry"]["coordinates"]
        assert -180 <= lon <= 360 and -90 <= lat <= 90


def test_static_instruments_match_archive(argo, real_root):
    static = json.load(open(os.path.join(real_root, "api", "instruments.json"), encoding="utf-8"))
    assert {f["id"] for f in static["features"]} == {f"ARGO_{p['wmo']}" for p in argo.platforms()}


def test_profiles_are_qc_filtered_and_valid_json(argo):
    for p in _floats_with_profiles(argo, 3):
        prof = ae.load_profile(f"ARGO_{p['wmo']}")
        if prof is None:
            continue  # float without a QC-good ascending profile
        text = json.dumps(prof, allow_nan=False)
        assert "NaN" not in text
        assert prof["metadata"]["qc_policy"].startswith("Argo QC flags 1")
        assert prof["metadata"]["source_file"].startswith(p["tar"])
        depths = [m["depth"] for m in prof["measurements"]]
        assert depths == sorted(depths) and depths[0] >= 0


def test_comparison_metrics_recomputed_from_pairs(argo):
    for p in _floats_with_profiles(argo, 40):
        res = ae.compute_model_vs_obs(f"ARGO_{p['wmo']}", "temperature")
        if not res["available"]:
            assert res["metrics"] is None and res["pairs"] == [] and res["reason"]
            continue
        obs = np.array([q["observation"] for q in res["pairs"]])
        mod = np.array([q["model"] for q in res["pairs"]])
        m = res["metrics"]
        assert m["sample_count"] == len(obs)
        assert m["rmse"] == pytest.approx(np.sqrt(np.mean((mod - obs) ** 2)), abs=1e-3)
        assert m["bias"] == pytest.approx(np.mean(mod - obs), abs=1e-3)
        assert all(abs(q["model_dt_days"]) <= 15.0 for q in res["pairs"])
        assert all(q["obs_depth"] <= 10.0 for q in res["pairs"])
        return
    pytest.skip("no float in the first 40 overlaps a built IBR month")


def test_comparison_for_unsupported_variable_is_unavailable(argo):
    p = _floats_with_profiles(argo, 1)[0]
    assert ae.compute_model_vs_obs(f"ARGO_{p['wmo']}", "oxygen")["available"] is False


# ------------------------------------------------------------------ HTTP API

def test_health_endpoints():
    r = client.get("/health")  # liveness only: must never block on data or locks
    assert r.status_code == 200 and r.json()["status"] == "alive"
    body = client.get("/api/health").json()
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
    # 12 bundled months; more when the full IBR record is reachable (IBR_LIVE_TILES).
    assert ts["available"] and len(ts["timeseries_points"]) >= 12
    an = client.get("/api/analytics/anomalies", params={"variable": "temperature", "lat": lat, "lon": lon}).json()
    assert an["available"] and an["date"] == ae.latest_timestep("temperature")
    co = client.get("/api/analytics/correlation", params={"lat": lat, "lon": lon}).json()
    assert co["available"] and "currents" in co["skipped"]  # currents are not co-temporal with IBR
    vp = client.get("/api/analytics/profile", params={"variable": "temperature", "lat": lat, "lon": lon}).json()
    assert vp["available"] is False and vp["model_mld_meters"] is not None
    land = client.get("/api/analytics/anomalies", params={"variable": "temperature", "lat": 20.0, "lon": 78.0}).json()
    assert land["available"] is False
    assert client.get("/api/analytics/timeseries", params={"variable": "temperature"}).status_code == 422


def test_instruments_and_profile_endpoints(argo):
    fc = client.get("/api/instruments").json()
    assert fc["type"] == "FeatureCollection" and len(fc["features"]) == len(argo.platforms())
    p = _floats_with_profiles(argo, 1)[0]
    prof = client.get(f"/api/instruments/ARGO_{p['wmo']}/profile").json()
    assert prof["external_id"] == f"ARGO_{p['wmo']}" and "analysis" in prof
    assert client.get(f"/api/instruments/INCOIS_ARGO_{p['wmo']}/profile").status_code == 200  # legacy id alias
    assert client.get("/api/instruments/ARGO_0000000/profile").status_code == 404


def test_cyclones_come_from_ibtracs():
    body = client.get("/api/hazards/cyclones").json()
    if not body["available"]:
        pytest.skip(body["reason"])
    assert body["source"].startswith("IBTrACS") and len(body["cyclones"]) > 50
    ids = [c["id"] for c in body["cyclones"]]
    assert len(set(ids)) == len(ids)
    assert all(c["name"] and c["date"] and -90 <= c["lat"] <= 90 for c in body["cyclones"])


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
