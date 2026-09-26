"""Unit tests of the external-dataset hazard science (ext_hazards) on hand-checkable fixtures."""
import datetime as dt
import math

import numpy as np
import pytest

from app import ext_hazards as xh


# ---- Hobday (2016) events

def test_events_need_five_days_and_join_short_gaps():
    ex = np.array([1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], dtype=bool)
    ev = xh.detect_events(ex)
    # 5-day run + 2-day gap + 5-day run -> one 12-day event; 3-day gap -> a new event
    assert list(ev[:12]) == list(range(1, 13))
    assert list(ev[12:15]) == [0, 0, 0]
    assert list(ev[15:]) == list(range(1, 7))


def test_runs_shorter_than_five_days_are_not_events():
    ex = np.array([1, 1, 1, 1, 0, 1, 1, 1, 1, 1], dtype=bool)
    assert list(xh.detect_events(ex)) == [0, 0, 0, 0, 0, 1, 2, 3, 4, 5]
    assert xh.detect_events(np.zeros(0, dtype=bool)).size == 0


def test_leap_doy_keeps_march_first_fixed():
    d = [dt.date(2019, 2, 28), dt.date(2019, 3, 1), dt.date(2020, 2, 29), dt.date(2020, 3, 1)]
    assert list(xh.leap_doy(d)) == [59, 61, 60, 61]


def test_climatology_of_a_pure_seasonal_cycle():
    days = [dt.date(1991, 1, 1) + dt.timedelta(days=i) for i in range(365 * 30 + 7)]
    doy = xh.leap_doy(days)
    sst = (28 + 2 * np.sin(2 * np.pi * doy / 366.0)).astype(np.float32)[:, None]
    clim, thresh = xh.hobday_climatology(sst, doy, np.ones(len(days), dtype=bool))
    assert clim.shape == (366, 1)
    # identical years: 11-day pooling + 31-day smoothing of a smooth cycle stays close to the cycle
    ref = 28 + 2 * np.sin(2 * np.pi * np.arange(1, 367) / 366.0)
    assert np.nanmax(np.abs(clim[:, 0] - ref)) < 0.1
    assert np.all(thresh[:, 0] >= clim[:, 0] - 1e-6)


# ---- Coral Reef Watch DHW

def test_dhw_accumulates_hotspots_of_at_least_one_degree():
    n = 100
    sst = np.full((n, 1), 30.0, dtype=np.float32)
    sst[-14:] = 31.5  # two weeks at HotSpot 1.5 degC
    sst[-20:-14] = 30.8  # HotSpot 0.8 < 1: does not count
    hs, dhw = xh.degree_heating_weeks(sst, np.array([30.0], dtype=np.float32))
    assert np.isnan(dhw[82, 0]) and np.isfinite(dhw[83, 0])  # needs 84 days of history
    assert dhw[-1, 0] == pytest.approx(14 * 1.5 / 7.0)
    assert hs[-1, 0] == pytest.approx(1.5)


def test_bleaching_alert_levels():
    hs = np.array([-0.5, 0.5, 1.2, 1.2, 1.2])
    dhw = np.array([0.0, 0.0, 2.0, 5.0, 9.0])
    assert list(xh.bleaching_alert(hs, dhw)) == [0, 1, 2, 3, 4]


def test_mmm_is_max_of_recentred_monthly_climatology():
    years = list(range(1985, 2013))
    mm = np.zeros((12, len(years), 1), dtype=np.float32)
    for m in range(12):
        mm[m, :, 0] = 27 + m * 0.1          # no trend: recentring leaves the mean
    mm[5, :, 0] = 29.0 + 0.01 * (np.array(years) - 1985)  # June has a trend
    out = xh.crw_mmm(mm, years)
    assert out[0] == pytest.approx(29.0 + 0.01 * (1988.2857 - 1985), abs=1e-4)


# ---- TCHP

def test_tchp_matches_hand_integration():
    z = np.array([0, 10, 20, 50, 100.0])
    T = np.array([30, 29, 28, 26, 20.0])[:, None]
    tchp, d26 = xh.tchp_profile(z, T)
    assert d26[0] == pytest.approx(50.0)
    assert tchp[0] == pytest.approx(90 * xh.TCHP_RHO * xh.TCHP_CP / 1e7)  # 90 K m of excess heat


def test_tchp_cold_surface_is_zero_and_unresolved_is_nan():
    z = np.array([0, 10, 20.0])
    tchp, d26 = xh.tchp_profile(z, np.array([[25.0], [24.0], [23.0]]))
    assert tchp[0] == 0 and d26[0] == 0
    tchp, d26 = xh.tchp_profile(z, np.array([[29.0], [28.0], [np.nan]]))
    assert np.isnan(tchp[0])  # warmer than 26 degC down to the seabed: isotherm not reached


# ---- drift

def test_sample_many_matches_bilinear_and_skips_land():
    g = xh.GRID
    arr = np.full((g["height"], g["width"]), np.nan)
    arr[10:12, 10:12] = [[1.0, 2.0], [3.0, 4.0]]
    lat = g["lat0"] + 10.5 * g["dlat"]
    lon = g["lon0"] + 10.5 * g["dlon"]
    v = xh.sample_many(arr, np.array([lat, g["lat0"]]), np.array([lon, g["lon0"]]))
    assert v[0] == pytest.approx(2.5)
    assert np.isnan(v[1])  # nearest cell is land


class _Uniform(xh.DriftFields):
    """Uniform eastward current u (m/s) and wind (m/s), for any time."""

    def __init__(self, u, wind):  # super().__init__ not called on purpose
        g = xh.GRID
        self.hours = np.array([0.0, 1e6])
        shape = (g["height"], g["width"])
        self._f = (np.full(shape, u), np.zeros(shape), np.full(shape, wind), np.zeros(shape))

    def at(self, hour):
        return self._f, self._f, 0.0


def test_rk4_uniform_current_and_windage():
    f = _Uniform(0.5, 10.0)
    rng = np.random.default_rng(0)
    t, la, lo, strand, stop = xh.run_ensemble(f, np.array([10.0]), np.array([80.0]), 0.0, 24.0, 30.0,
                                              np.array([0.03]), 0.0, rng)
    speed = 0.5 + 0.03 * 10.0  # m/s eastward
    expected_km = speed * 24 * 3600 / 1000
    got_km = xh.haversine_km(10.0, 80.0, la[-1, 0], lo[-1, 0])
    assert got_km == pytest.approx(expected_km, rel=2e-3)
    assert la[-1, 0] == pytest.approx(10.0, abs=1e-9)
    assert not strand[0] and stop is None


def test_reverse_run_returns_to_origin():
    f = _Uniform(0.4, 0.0)
    rng = np.random.default_rng(0)
    _, la, lo, _, _ = xh.run_ensemble(f, np.array([10.0]), np.array([80.0]), 100.0, 12.0, 30.0, np.array([0.0]),
                                      0.0, rng)
    _, la2, lo2, _, _ = xh.run_ensemble(f, la[-1:, :].ravel(), lo[-1:, :].ravel(), 112.0, 12.0, 30.0,
                                        np.array([0.0]), 0.0, rng, backward=True)
    assert lo2[-1, 0] == pytest.approx(80.0, abs=1e-6)


def test_liu_weisberg_skill_perfect_and_bounded():
    lat = np.array([10.0, 10.1, 10.2, 10.3])
    lon = np.array([80.0, 80.0, 80.0, 80.0])
    assert xh.liu_weisberg_skill(lat, lon, lat, lon) == pytest.approx(1.0)
    far = xh.liu_weisberg_skill(lat, lon, lat + 5, lon)
    assert far == 0.0


# ---- export

def test_cap_and_geojson_exports():
    item = {"type": "marine_heatwave_daily", "level": "strong", "severity": 2, "date": "2026-09-24",
            "source": "NOAA OISST v2.1", "title": "Strong marine heatwave <test>", "detail": "x & y",
            "caveat": "c", "region": {"bbox": [70.0, 8.0, 74.0, 12.0], "centroid": {"lat": 10.0, "lon": 72.0},
                                      "area_km2": 1000.0, "peak": {"lat": 10, "lon": 72, "value": 2.2}}}
    cap = xh.advisories_cap([item], "2026-09-26T00:00:00Z")
    assert cap.startswith('<?xml') and "urn:oasis:names:tc:emergency:cap:1.2" in cap
    assert "&lt;test&gt;" in cap and "x &amp; y" in cap
    assert "<polygon>8.0,70.0 8.0,74.0 12.0,74.0 12.0,70.0 8.0,70.0</polygon>" in cap
    gj = xh.advisories_geojson([item], "2026-09-26T00:00:00Z")
    assert gj["type"] == "FeatureCollection"
    assert gj["features"][0]["geometry"]["coordinates"][0][0] == [70.0, 8.0]


def test_haversine_one_degree_of_latitude():
    assert xh.haversine_km(0, 80, 1, 80) == pytest.approx(math.pi * 6371 / 180, rel=1e-6)
