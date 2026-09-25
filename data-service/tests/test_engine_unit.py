"""Unit tests of the scientific engine against small hand-checkable fixtures."""
import struct

import numpy as np
import pytest

from app import analytics_engine as ae


def _tile_bytes(var_code, arr):
    arr = np.asarray(arr, dtype="<f4")
    h, w = arr.shape
    return struct.pack("<4sHHHHHHff8s", b"INCO", 1, var_code, w, h, 1, 1, 0.0, 1.0, b"\x00" * 8) + arr.tobytes()


def test_parse_tile_rejects_wrong_variable_code():
    buf = _tile_bytes(1, np.zeros((2, 3)))
    header, arr = ae.parse_tile(buf, expected_var_code=1)
    assert (header["width"], header["height"]) == (3, 2) and arr.shape == (2, 3)
    with pytest.raises(ValueError, match="var_code"):
        ae.parse_tile(buf, expected_var_code=2)  # a temperature tile can never be served as salinity


def test_parse_tile_rejects_bad_magic_and_truncation():
    buf = _tile_bytes(1, np.zeros((2, 3)))
    with pytest.raises(ValueError, match="magic"):
        ae.parse_tile(b"XXXX" + buf[4:])
    with pytest.raises(ValueError, match="payload size"):
        ae.parse_tile(buf[:-4])


def test_validation_metrics_match_hand_calculation():
    obs = np.array([1.0, 2.0, 3.0, 4.0])
    mod = np.array([1.5, 1.5, 3.5, 5.0])
    m = ae.validation_metrics(obs, mod)
    res = mod - obs  # [0.5, -0.5, 0.5, 1.0]
    assert m["sample_count"] == 4
    assert m["bias"] == pytest.approx(res.mean(), abs=1e-4)
    assert m["mae"] == pytest.approx(np.abs(res).mean(), abs=1e-4)
    assert m["rmse"] == pytest.approx(np.sqrt((res ** 2).mean()), abs=1e-4)
    r = np.corrcoef(obs, mod)[0, 1]
    assert m["pearson_r"] == pytest.approx(r, abs=1e-4)
    assert m["r_squared"] == pytest.approx(r * r, abs=1e-4)


def test_validation_metrics_undefined_correlation_cases():
    assert ae.validation_metrics(np.array([1.0, 2.0]), np.array([1.0, 3.0]))["pearson_r"] is None  # n < 3
    flat = ae.validation_metrics(np.array([1.0, 2.0, 3.0]), np.array([5.0, 5.0, 5.0]))
    assert flat["pearson_r"] is None and flat["r_squared"] is None  # zero model variance
    empty = ae.validation_metrics(np.array([]), np.array([]))
    assert empty["sample_count"] == 0 and empty["rmse"] is None


def test_sample_grid_cell_centres_land_and_domain(tiny_root):
    arr = ae.load_tile("temperature", "2019-01-29", 0.0)
    # exactly on a cell centre -> that cell's value (row 1 = 11N, col 2 = 62E)
    assert ae.sample_grid(arr, 11.0, 62.0) == pytest.approx(arr[1, 2])
    # halfway between two cells -> mean
    assert ae.sample_grid(arr, 11.0, 62.5) == pytest.approx((arr[1, 2] + arr[1, 3]) / 2)
    # nearest cell is land (NaN) -> None, never a neighbour value
    assert ae.sample_grid(arr, 10.1, 60.1) is None
    # outside the bbox -> None
    assert ae.sample_grid(arr, 30.0, 62.0) is None


def test_tile_paths_only_for_catalogued_combinations(tiny_root):
    assert ae.tile_path("temperature", "2019-01-29", 0.0)
    assert ae.tile_path("temperature", "2019-03-29", 0.0) is None   # not a real timestep
    assert ae.tile_path("temperature", "2019-01-29", 10.0) is None  # no such depth
    assert ae.tile_path("temperature", "../../etc", 0.0) is None    # rejected date string
    assert ae.tile_path("pressure", "2019-01-29", 0.0) is None      # unknown variable


def test_resolve_date_never_substitutes_nearest(tiny_root):
    assert ae.resolve_date("temperature", None) == ("2019-04-29", None)
    assert ae.resolve_date("temperature", "2019-02-28T00:00:00Z") == ("2019-02-28", None)
    d, err = ae.resolve_date("temperature", "2019-03-15")
    assert d is None and "No 'temperature' data at 2019-03-15" in err


def test_timeseries_trend_uses_real_day_offsets(tiny_root):
    res = ae.compute_timeseries("temperature", 11.0, 62.0, 0.0)
    assert res["available"] is True
    assert [p["date"] for p in res["timeseries_points"]] == ["2019-01-29", "2019-02-28", "2019-04-29"]
    # values rise 10 per timestep but the timesteps are 30 and 60 days apart
    days = np.array([0.0, 30.0, 90.0])
    vals = np.array([p["value"] for p in res["timeseries_points"]])
    expected = np.polyfit(days, vals, 1)[0]
    assert res["trend_slope_per_day"] == pytest.approx(expected, abs=1e-6)
    assert res["trend_slope_per_day"] != pytest.approx(10.0 / 1.0)  # not "delta / n_steps"


def test_anomaly_is_spatial_zscore(tiny_root):
    res = ae.compute_anomalies("temperature", 11.0, 62.0, 0.0, "2019-01-29")
    arr = ae.load_tile("temperature", "2019-01-29", 0.0)
    valid = arr[np.isfinite(arr)]
    z = (arr[1, 2] - valid.mean()) / valid.std()
    assert res["available"] and res["z_score"] == pytest.approx(z, abs=1e-3)
    assert res["baseline_samples"] == valid.size
    assert "not a climatological anomaly" in res["description"]
    missing = ae.compute_anomalies("temperature", 11.0, 62.0, 0.0, "2019-03-01")
    assert missing["available"] is False


def test_correlation_uses_only_cotemporal_fields(tiny_root):
    res = ae.compute_correlation(11.5, 62.0, 0.0, "2019-01-29")
    assert res["available"] and res["variables"] == ["temperature", "salinity"]
    assert res["matrix"][0][1] == pytest.approx(1.0, abs=1e-6)  # salinity fixture is linear in temperature
    only_t = ae.compute_correlation(11.5, 62.0, 0.0, "2019-02-28")
    assert only_t["available"] is False and "salinity" in only_t["skipped"]


def test_vertical_profile_refuses_surface_only_model(tiny_root):
    res = ae.compute_vertical_profile_analysis(11.0, 62.0, "temperature", "2019-01-29")
    assert res["available"] is False and "vertical level" in res["reason"]


def test_observed_mld_de_boyer_montegut():
    # T = 28 in the top 40 m then drops 0.1 °C per metre: |T - T(10)| = 0.2 at 42 m
    depths = [2, 5, 10, 20, 30, 40, 50, 60, 100, 200]
    temps = [28.0, 28.0, 28.0, 28.0, 28.0, 28.0, 27.0, 26.0, 22.0, 15.0]
    prof = {"measurements": [{"depth": z, "temperature": t} for z, t in zip(depths, temps)]}
    a = ae.compute_observed_profile_analysis(prof)
    assert a["reference_temperature"] == pytest.approx(28.0)
    assert a["mld_meters"] == pytest.approx(42.0, abs=0.05)
    # search starts below the MLD: 50-60 m (1.0 °C / 10 m) is the first maximum-rate layer
    assert a["thermocline_depth_meters"] == pytest.approx(55.0)
    assert a["thermocline_gradient_c_per_m"] == pytest.approx(0.1)


def test_observed_mld_handles_temperature_inversion():
    prof = {"measurements": [{"depth": z, "temperature": t} for z, t in
                             [(5, 26.0), (10, 26.0), (20, 26.1), (30, 26.4), (60, 25.0)]]}
    a = ae.compute_observed_profile_analysis(prof)
    # warming of 0.2 °C is reached between 20 and 30 m: 20 + (0.1/0.3)*10
    assert a["mld_meters"] == pytest.approx(23.3, abs=0.05)


def test_canonical_instrument_ids():
    assert ae.canonical_instrument_id("INCOIS_ARGO_2902084") == "ARGO_2902084"
    assert ae.canonical_instrument_id("2902084") == "ARGO_2902084"
    assert ae.load_profile("../../secrets") is None
