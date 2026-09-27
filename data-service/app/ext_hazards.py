"""
Disaster Early Warning products built from external observational / operational datasets:

  * NOAA OISST v2.1 daily SST      -> daily marine heatwaves (Hobday et al. 2016, >= 5-day rule) and
                                      coral-bleaching Degree Heating Weeks (NOAA Coral Reef Watch method)
  * HYCOM ESPC-D-V02 currents      -> time-varying total surface currents for drift, NRT eddy vorticity
  * NCEP GFS / NCEP R2 10 m wind   -> leeway (windage) of drifting objects
  * HYCOM ESPC-D-V02 3-D temp      -> Tropical Cyclone Heat Potential (Leipper & Volgenau 1972)
  * NCEP/NCAR R1 monthly fields    -> Genesis Potential Index (Emanuel & Nolan 2004)
  * IBTrACS v04r01                 -> sourced cyclone tracks and layer validation
  * NOAA Global Drifter Program    -> drift skill scores (Liu & Weisberg 2011)

Products are produced by scripts/build_ext_products.py into datasets/ext_products/ and published to the
Hugging Face dataset repo (ext_products/<file>). The service reads them from EXT_PRODUCTS_DIR, else from the
repository checkout, else downloads them from Hugging Face on first use. Missing inputs return
``available: False`` with a reason; nothing is filled or invented.
"""
import datetime as dt
import json
import math
import os
import threading
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

# Served grid (identical to catalog["grid"] written by scripts/build_authentic_dataset.py).
GRID = {"width": 520, "height": 280, "lon0": 35.0625, "lat0": -9.9375, "dlon": 0.125, "dlat": 0.125,
        "bbox": [35.0, -10.0, 100.0, 25.0]}

# Mirrors VAR_CODES in scripts/build_authentic_dataset.py and frontend/src/api/client.ts.
VAR_CODES = {"mhw_daily": 13, "dhw": 14, "tchp": 15, "gpi": 16, "eddy_convergence_nrt": 17}

EARTH_RADIUS_M = 6371000.0
M_PER_DEG = EARTH_RADIUS_M * math.pi / 180.0

_lock = threading.Lock()
_cache: Dict[str, Any] = {}


def grid_axes() -> Tuple[np.ndarray, np.ndarray]:
    return (GRID["lat0"] + GRID["dlat"] * np.arange(GRID["height"]),
            GRID["lon0"] + GRID["dlon"] * np.arange(GRID["width"]))


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M / 1000.0 * math.asin(min(1.0, math.sqrt(a)))


# --------------------------------------------------------------------------- product files

HF_PREFIX = "ext_products"


def _repo_products_dir() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "datasets", "ext_products"))


def products_dir() -> str:
    return os.path.abspath(os.getenv("EXT_PRODUCTS_DIR") or os.path.join(
        os.getenv("VOLUME_CACHE_DIR", os.path.join(__import__("tempfile").gettempdir(), "incois_volume_cache")),
        "ext_products"))


_fetch_errors: Dict[str, Tuple[float, str]] = {}


REFRESH_SECONDS = float(os.getenv("EXT_PRODUCTS_REFRESH_HOURS", "6")) * 3600.0
_last_check: Dict[str, float] = {}
_refreshing: set = set()


def _hf_download(name: str) -> str:
    from huggingface_hub import hf_hub_download
    dest = products_dir()
    os.makedirs(dest, exist_ok=True)
    # local_dir = parent of ext_products/, so the file lands at <cache>/ext_products/<name>
    return hf_hub_download(os.getenv("HF_DATASET_REPO", "ScaryCobra/incois"), f"{HF_PREFIX}/{name}",
                           repo_type="dataset", revision=os.getenv("HF_DATASET_REVISION", "main"),
                           token=os.getenv("HF_TOKEN") or None, local_dir=os.path.dirname(dest))


def _refresh_async(name: str) -> None:
    """Re-check Hugging Face for a newer copy (the near-real-time job republishes products); hf_hub_download
    only transfers the file when its etag changed. Readers pick the new file up by its mtime."""
    import time
    if name in _refreshing:
        return
    _refreshing.add(name)

    def run():
        try:
            _hf_download(name)
        except Exception as exc:
            print(f"[ext] refresh of {name} failed: {type(exc).__name__}", flush=True)
        finally:
            _last_check[name] = time.time()
            _refreshing.discard(name)

    threading.Thread(target=run, daemon=True).start()


def product_path(name: str) -> Tuple[Optional[str], Optional[str]]:
    """Local path of a product file, downloading it from Hugging Face on first use and re-checking it every
    EXT_PRODUCTS_REFRESH_HOURS (default 6). (path, reason)."""
    import time
    for base in (os.getenv("EXT_PRODUCTS_DIR"), _repo_products_dir()):
        if base and os.path.isfile(os.path.join(base, name)):
            return os.path.join(base, name), None
    cached = os.path.join(products_dir(), name)
    offline = os.getenv("EXT_PRODUCTS_OFFLINE") == "1"
    if os.path.isfile(cached):
        if not offline and time.time() - _last_check.get(name, os.path.getmtime(cached)) > REFRESH_SECONDS:
            _refresh_async(name)
        return cached, None
    if offline:
        return None, f"Product {name} not present locally (EXT_PRODUCTS_OFFLINE=1)."
    err = _fetch_errors.get(name)
    if err and time.time() - err[0] < 300:
        return None, err[1]
    try:
        with _lock:
            p = _hf_download(name)
        _last_check[name] = time.time()
        return p, None
    except Exception as exc:  # network / missing file
        reason = (f"Product {name} is not available locally and could not be fetched from Hugging Face "
                  f"({type(exc).__name__}). Build it with scripts/build_ext_products.py.")
        _fetch_errors[name] = (time.time(), reason)
        return None, reason


def load_json_product(name: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    path, reason = product_path(name)
    if path is None:
        return None, reason
    key = ("json", path, os.path.getmtime(path))
    hit = _cache.get(key)
    if hit is None:
        with open(path, encoding="utf-8") as f:
            hit = json.load(f)
        _cache[key] = hit
    return hit, None


def open_nc(name: str):
    """(netCDF4.Dataset, reason) for a NetCDF product (kept open, re-opened when the file changes)."""
    import netCDF4 as nc
    path, reason = product_path(name)
    if path is None:
        return None, reason
    key = ("nc", path)
    mtime = os.path.getmtime(path)
    with _lock:
        hit = _cache.get(key)
        if hit is None or hit[0] != mtime:
            if hit is not None:
                try:
                    hit[1].close()
                except Exception:
                    pass
            hit = (mtime, nc.Dataset(path))
            _cache[key] = hit
    return hit[1], None


def clear_cache() -> None:
    with _lock:
        for k, v in list(_cache.items()):
            if k[0] == "nc":
                try:
                    v[1].close()
                except Exception:
                    pass
        _cache.clear()
        _field_cache.clear()


_field_cache: Dict[Tuple[str, str], np.ndarray] = {}
_FIELD_CACHE_MAX = 48


def _remember(key: Tuple[str, str], arr: np.ndarray) -> np.ndarray:
    if len(_field_cache) >= _FIELD_CACHE_MAX:
        _field_cache.pop(next(iter(_field_cache)))
    _field_cache[key] = arr
    return arr


def nc_dates(ds) -> List[str]:
    import netCDF4 as nc
    t = ds["time"]
    return [x.strftime("%Y-%m-%d") for x in nc.num2date(t[:], t.units, getattr(t, "calendar", "standard"))]


def read_field(ds, var: str, k: int) -> np.ndarray:
    return np.ma.filled(ds[var][k].astype(np.float64), np.nan)


# --------------------------------------------------------------------------- daily marine heatwaves
#
# Hobday, A.J. et al. (2016) "A hierarchical approach to defining marine heatwaves", Prog. Oceanogr. 141,
# 227-238, as implemented in the reference marineHeatWaves code (E. Oliver):
#   * climatology and 90th-percentile threshold per day-of-year from an 11-day window pooled over a
#     30-year baseline, then smoothed with a 31-day moving average;
#   * an event is >= 5 consecutive days above the threshold; events separated by <= 2 days are joined;
#   * categories (Hobday et al. 2018): floor((SST - clim) / (thresh - clim)), 1 Moderate .. 4+ Extreme.

MHW_DAILY_BASELINE = (1991, 2020)  # WMO climate normal; the first full 30 years after OISST starts in Sep 1981
MHW_WINDOW_HALF_WIDTH = 5
MHW_SMOOTH_WIDTH = 31
MHW_MIN_DURATION = 5
MHW_MAX_GAP = 2


def leap_doy(dates: Sequence[dt.date]) -> np.ndarray:
    """Day of year on a 366-day calendar (Feb 29 = 60, Mar 1 = 61 in every year), as in marineHeatWaves."""
    out = np.empty(len(dates), dtype=np.int16)
    for i, d in enumerate(dates):
        out[i] = (dt.date(2000, d.month, d.day) - dt.date(2000, 1, 1)).days + 1
    return out


def _circular_smooth(a: np.ndarray, width: int) -> np.ndarray:
    """Moving average of width `width` along axis 0 of a 366-row array, wrapping around the year."""
    h = width // 2
    ext = np.concatenate([a[-h:], a, a[:h]], axis=0).astype(np.float64)
    zero = np.zeros((1,) + a.shape[1:])
    c = np.concatenate([zero, np.cumsum(np.nan_to_num(ext, nan=0.0), axis=0)], axis=0)
    n = np.concatenate([zero, np.cumsum(np.isfinite(ext), axis=0)], axis=0)
    s = c[width:] - c[:-width]
    k = n[width:] - n[:-width]
    with np.errstate(all="ignore"):
        out = s / k
    out[k < width] = np.nan  # any undefined day in the window -> undefined (land / partial cells)
    return out.astype(np.float32)


def hobday_climatology(sst: np.ndarray, doy: np.ndarray, in_baseline: np.ndarray, pctile: float = 90.0
                       ) -> Tuple[np.ndarray, np.ndarray]:
    """(clim, thresh), each (366, ...cells), from daily SST (T, ...cells) using baseline days only."""
    import warnings
    base = sst[in_baseline]
    bdoy = doy[in_baseline].astype(np.int32)
    shape = (366,) + sst.shape[1:]
    clim = np.full(shape, np.nan, dtype=np.float32)
    thresh = np.full(shape, np.nan, dtype=np.float32)
    for d in range(1, 367):
        dd = np.abs(((bdoy - d + 183) % 366) - 183)  # circular distance in days
        pool = base[dd <= MHW_WINDOW_HALF_WIDTH]
        with warnings.catch_warnings(), np.errstate(all="ignore"):
            warnings.simplefilter("ignore", RuntimeWarning)
            ok = np.isfinite(pool).mean(axis=0) >= 0.9  # need >= 90 % of the pooled baseline values
            clim[d - 1] = np.where(ok, np.nanmean(pool, axis=0), np.nan)
            thresh[d - 1] = np.where(ok, np.nanpercentile(pool, pctile, axis=0), np.nan)
    return _circular_smooth(clim, MHW_SMOOTH_WIDTH), _circular_smooth(thresh, MHW_SMOOTH_WIDTH)


def detect_events(exceed: np.ndarray, min_duration: int = MHW_MIN_DURATION, max_gap: int = MHW_MAX_GAP
                  ) -> np.ndarray:
    """
    Hobday (2016) events for one cell. Days in a run of >= `min_duration` consecutive exceedances form an
    event; events separated by <= `max_gap` days are joined (gap days included). Returns an int16 array:
    0 outside events, otherwise the day number within the (joined) event.
    """
    exceed = np.asarray(exceed, dtype=bool)
    n = exceed.size
    if n == 0:
        return np.zeros(0, dtype=np.int16)
    edges = np.diff(np.concatenate([[0], exceed.astype(np.int8), [0]]))
    starts, ends = np.nonzero(edges == 1)[0], np.nonzero(edges == -1)[0] - 1
    keep = ends - starts + 1 >= min_duration
    joined: List[List[int]] = []
    for a, b in zip(starts[keep], ends[keep]):
        if joined and a - joined[-1][1] - 1 <= max_gap:
            joined[-1][1] = int(b)
        else:
            joined.append([int(a), int(b)])
    out = np.zeros(n, dtype=np.int16)
    for a, b in joined:
        out[a:b + 1] = np.arange(1, b - a + 2)
    return out


# --------------------------------------------------------------------------- Degree Heating Weeks
#
# NOAA Coral Reef Watch (Liu et al. 2014, Remote Sens. 6, 11579; CRW v3.1 methodology):
#   MMM     = maximum of the 12 monthly-mean climatologies; each monthly climatology is the 1985-2012
#             linear regression of that month's mean SST evaluated at 1988.2857 (CRW's recentring)
#   HotSpot = SST - MMM
#   DHW     = sum over the trailing 84 days (12 weeks) of HotSpot where HotSpot >= 1 degC, / 7  [degC-weeks]
#   Bleaching Alert Area: 0 No stress (HS <= 0), 1 Watch (0 < HS < 1), 2 Warning (HS >= 1, 0 < DHW < 4),
#   3 Alert Level 1 (HS >= 1, 4 <= DHW < 8), 4 Alert Level 2 (HS >= 1, DHW >= 8).

DHW_MMM_YEARS = (1985, 2012)
DHW_MMM_CENTRE = 1988.2857
DHW_WINDOW_DAYS = 84
BAA_LABELS = {0: "No stress", 1: "Bleaching Watch", 2: "Bleaching Warning", 3: "Alert Level 1", 4: "Alert Level 2"}


def crw_mmm(monthly_means: np.ndarray, years: Sequence[int]) -> np.ndarray:
    """MMM from (12, Y, ...cells) monthly means over DHW_MMM_YEARS, with CRW recentring to 1988.2857."""
    import warnings
    y = np.asarray(years, dtype=np.float64)
    ym = y - y.mean()
    clims = []
    for m in range(12):
        x = monthly_means[m].astype(np.float64)
        ok = np.isfinite(x).all(axis=0)
        with warnings.catch_warnings(), np.errstate(all="ignore"):
            warnings.simplefilter("ignore", RuntimeWarning)
            mean = np.nanmean(x, axis=0)
        slope = np.tensordot(ym, np.nan_to_num(x - mean), axes=(0, 0)) / float((ym ** 2).sum())
        c = mean + slope * (DHW_MMM_CENTRE - y.mean())
        c[~ok] = np.nan
        clims.append(c)
    st = np.stack(clims)
    out = np.full(st.shape[1:], np.nan, dtype=np.float32)
    ok = np.isfinite(st).all(axis=0)
    out[ok] = st[:, ok].max(axis=0)
    return out


def degree_heating_weeks(sst: np.ndarray, mmm: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """(hotspot, dhw) for a daily SST stack (T, ...cells). DHW is NaN for the first 83 days and wherever
    any day in its 84-day window is missing."""
    hs = sst - mmm[None]
    contrib = np.where(np.isfinite(hs), np.where(hs >= 1.0, hs, 0.0), np.nan)
    zero = np.zeros((1,) + sst.shape[1:])
    c = np.concatenate([zero, np.cumsum(np.nan_to_num(contrib), axis=0)], axis=0)
    k = np.concatenate([zero, np.cumsum(np.isfinite(contrib), axis=0)], axis=0)
    w = DHW_WINDOW_DAYS
    dhw = np.full(sst.shape, np.nan, dtype=np.float32)
    if sst.shape[0] >= w:
        s = (c[w:] - c[:-w]) / 7.0
        full = (k[w:] - k[:-w]) == w
        dhw[w - 1:] = np.where(full, s, np.nan)
    return hs.astype(np.float32), dhw


def bleaching_alert(hs: np.ndarray, dhw: np.ndarray) -> np.ndarray:
    hs, dhw = np.asarray(hs, dtype=np.float64), np.asarray(dhw, dtype=np.float64)
    out = np.full(hs.shape, np.nan)
    ok = np.isfinite(hs)
    out[ok] = 0
    out[ok & (hs > 0) & (hs < 1)] = 1
    hot = ok & (hs >= 1) & np.isfinite(dhw)
    out[hot & (dhw < 4)] = 2
    out[hot & (dhw >= 4) & (dhw < 8)] = 3
    out[hot & (dhw >= 8)] = 4
    return out


# --------------------------------------------------------------------------- regridding

def regrid_to_served(field: np.ndarray, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """Bilinear from a regular source grid (ascending lats/lons) onto the served 0.125 deg grid;
    any NaN corner gives NaN (land is never smeared into the ocean)."""
    from scipy.interpolate import RegularGridInterpolator
    tl, tn = grid_axes()
    glat, glon = np.meshgrid(tl, tn, indexing="ij")
    f = RegularGridInterpolator((np.asarray(lats, float), np.asarray(lons, float)), np.asarray(field, float),
                                method="linear", bounds_error=False, fill_value=np.nan)
    return f((glat, glon)).astype(np.float32)


def _nearest_index(values: np.ndarray, x: float) -> Optional[int]:
    values = np.asarray(values, dtype=float)
    step = abs(float(values[1] - values[0])) if values.size > 1 else 1.0
    i = int(np.argmin(np.abs(values - x)))
    return i if abs(values[i] - x) <= 0.51 * step else None


def _r(x: Any, nd: int = 3) -> Optional[float]:
    if x is None:
        return None
    x = float(x)
    return round(x, nd) if np.isfinite(x) else None


def _resolve(dates: List[str], date: Optional[str], what: str) -> Tuple[Optional[str], Optional[str]]:
    if not dates:
        return None, f"{what} product has no dates."
    if date is None:
        return dates[-1], None
    d = date.strip()[:10]
    if d not in dates:
        return None, f"No {what} data at {d}. Available: {dates[0]} .. {dates[-1]} ({len(dates)} days)."
    return d, None


# --------------------------------------------------------------------------- OISST layers (served)

MHW_DAILY_CAVEAT = ("Daily marine heatwaves from NOAA OISST v2.1 (0.25 deg, satellite + in situ blend) using "
                    "Hobday et al. (2016): SST above the 1991-2020 day-of-year 90th percentile for >= 5 days. "
                    "Values are Hobday (2018) intensity ratios inside detected events only. OISST is an "
                    "interpolated analysis; small coastal features are smoothed. The fixed 1991-2020 baseline "
                    "counts part of long-term warming.")
DHW_CAVEAT = ("Degree Heating Weeks computed with the NOAA Coral Reef Watch v3.1 method applied to OISST 0.25 deg "
              "(CRW's operational product uses 5 km CoralTemp, so values differ in detail). DHW >= 4 degC-weeks: "
              "significant bleaching likely; >= 8: severe bleaching and mortality likely. Meaningful at coral "
              "reef locations; shown everywhere for context.")


def oisst_dates() -> Tuple[List[str], Optional[str]]:
    ds, reason = open_nc("mhw_daily.nc")
    if ds is None:
        return [], reason
    return nc_dates(ds), None


def oisst_layer_field(layer: str, date: Optional[str]) -> Tuple[Optional[np.ndarray], Optional[str]]:
    """Served-grid field for 'mhw_daily' (intensity ratio inside events, 0 elsewhere over ocean) or 'dhw'."""
    ds, reason = open_nc("mhw_daily.nc")
    if ds is None:
        return None, reason
    dates = nc_dates(ds)
    d, err = _resolve(dates, date, "OISST")
    if err:
        return None, err
    key = (layer, d)
    if key in _field_cache:
        return _field_cache[key], None
    k = dates.index(d)
    lats, lons = ds["lat"][:], ds["lon"][:]
    if layer == "mhw_daily":
        sst, clim, thr = (read_field(ds, v, k) for v in ("sst", "clim", "thresh"))
        ev = read_field(ds, "event_day", k)
        with np.errstate(all="ignore"):
            ratio = (sst - clim) / (thr - clim)
        field = np.where(np.isfinite(ratio), np.where(ev > 0, np.maximum(ratio, 0.0), 0.0), np.nan)
    elif layer == "dhw":
        field = read_field(ds, "dhw", k)
    else:
        return None, f"Unknown OISST layer '{layer}'."
    return _remember(key, regrid_to_served(field, lats, lons)), None


def _served_area_km2() -> np.ndarray:
    lats, lons = grid_axes()
    return ((M_PER_DEG / 1000.0) ** 2 * GRID["dlat"] * GRID["dlon"] * np.cos(np.deg2rad(lats)))[:, None] \
        * np.ones((1, lons.size))


def _clusters(mask: np.ndarray, value: np.ndarray, top: int = 5) -> List[Dict[str, Any]]:
    from app import analytics_engine as ae
    return ae._clusters(mask, value, top)


MHW_CATS = ((1.0, "Moderate"), (2.0, "Strong"), (3.0, "Severe"), (4.0, "Extreme"))


def compute_mhw_daily_summary(date: Optional[str] = None) -> Dict[str, Any]:
    field, reason = oisst_layer_field("mhw_daily", date)
    dates, _ = oisst_dates()
    d = date[:10] if date else (dates[-1] if dates else None)
    base = {"layer": "mhw_daily", "date": d, "caveat": MHW_DAILY_CAVEAT, "source": "NOAA OISST v2.1"}
    if field is None:
        return {**base, "available": False, "reason": reason}
    area = _served_area_km2()
    finite = np.isfinite(field)
    ev = finite & (field > 0)
    cats = []
    for i, (lo, label) in enumerate(MHW_CATS):
        hi = MHW_CATS[i + 1][0] if i + 1 < len(MHW_CATS) else np.inf
        sel = ev & (field >= lo) & (field < hi)
        cats.append({"category": i + 1, "label": label, "cells": int(sel.sum()),
                     "area_km2": round(float(area[sel].sum()), 1)})
    return {
        **base, "available": True, "dates": {"first": dates[0], "last": dates[-1], "count": len(dates)},
        "method": ("Hobday et al. (2016) daily MHW: 1991-2020 day-of-year climatology and 90th percentile "
                   "(11-day window, 31-day smoothing); >= 5-day events, gaps <= 2 days joined."),
        "ocean_cells": int(finite.sum()), "mhw_cells": int(ev.sum()),
        "mhw_fraction": round(float(ev.sum()) / max(1, int(finite.sum())), 4),
        "categories": cats,
        "max_ratio": _r(np.nanmax(field) if ev.any() else None),
        "regions": _clusters(ev, field) if ev.any() else [],
    }


def compute_mhw_daily_point(lat: float, lon: float, date: Optional[str] = None, days: int = 120) -> Dict[str, Any]:
    """Daily SST / climatology / threshold / event timeline at one location (nearest OISST cell)."""
    ds, reason = open_nc("mhw_daily.nc")
    base = {"lat": lat, "lon": lon, "caveat": MHW_DAILY_CAVEAT}
    if ds is None:
        return {**base, "available": False, "reason": reason}
    dates = nc_dates(ds)
    d, err = _resolve(dates, date, "OISST")
    if err:
        return {**base, "available": False, "reason": err}
    j, i = _nearest_index(ds["lat"][:], lat), _nearest_index(ds["lon"][:], lon)
    if j is None or i is None:
        return {**base, "available": False, "reason": f"({lat:.3f}, {lon:.3f}) is outside the OISST product domain."}
    k = dates.index(d)
    k0 = max(0, k - int(days) + 1)
    ser = {v: np.ma.filled(ds[v][k0:k + 1, j, i].astype(float), np.nan)
           for v in ("sst", "clim", "thresh", "event_day", "dhw", "hotspot")}
    if not np.isfinite(ser["sst"][-1]):
        return {**base, "available": False, "reason": "Nearest OISST cell is land / sea ice / no data."}
    with np.errstate(all="ignore"):
        ratio = (ser["sst"] - ser["clim"]) / (ser["thresh"] - ser["clim"])
    ev = ser["event_day"]
    cat = int(min(4, math.floor(ratio[-1]))) if ev[-1] > 0 and np.isfinite(ratio[-1]) and ratio[-1] >= 1 else 0
    baa = bleaching_alert(ser["hotspot"][-1:], ser["dhw"][-1:])[0]
    # current / most recent event within the returned series
    event = None
    if ev[-1] > 0:
        n_ev = int(ev[-1])
        s = max(0, len(ev) - n_ev)
        seg = ratio[s:]
        event = {"start": dates[k0 + s], "duration_days_so_far": n_ev,
                 "max_ratio": _r(np.nanmax(seg)), "mean_intensity_degC": _r(np.nanmean((ser["sst"] - ser["clim"])[s:]))}
    return {
        **base, "available": True, "date": d, "cell": {"lat": float(ds["lat"][j]), "lon": float(ds["lon"][i])},
        "sst": _r(ser["sst"][-1]), "climatology": _r(ser["clim"][-1]), "threshold_p90": _r(ser["thresh"][-1]),
        "intensity_ratio": _r(ratio[-1]), "in_event": bool(ev[-1] > 0), "category": cat,
        "category_label": MHW_CATS[cat - 1][1] if cat else "None", "event": event,
        "dhw": _r(ser["dhw"][-1], 2), "hotspot": _r(ser["hotspot"][-1], 2),
        "bleaching_alert": BAA_LABELS.get(int(baa)) if np.isfinite(baa) else None,
        "series": {"dates": dates[k0:k + 1], "sst": [_r(x) for x in ser["sst"]],
                   "clim": [_r(x) for x in ser["clim"]], "thresh": [_r(x) for x in ser["thresh"]],
                   "event_day": [int(x) if np.isfinite(x) else None for x in ev],
                   "dhw": [_r(x, 2) for x in ser["dhw"]]},
    }


# --------------------------------------------------------------------------- drift ensemble
#
# Particle velocity = HYCOM total surface current + windage * 10 m wind, integrated with RK4 through
# fields that vary in time (linear) and space (bilinear), plus a random-walk diffusion term
# dx = sqrt(2 K dt) N(0, 1) for unresolved motion. The windage coefficient and diffusivity K are user
# assumptions (defaults below) and are reported as such; the ensemble spread is the uncertainty cone.

WINDAGE_PRESETS = {
    "none": (0.0, "No windage: water-following object (drogued drifter, submerged debris)."),
    "low": (0.01, "1 % of the 10 m wind: low-profile objects (e.g. persons in water) - assumed value."),
    "oil": (0.03, "3 % of the 10 m wind: surface oil 'wind-drift factor' rule (ASCE Task Committee 1996); it "
                  "empirically includes wave-induced (Stokes) drift."),
}
DEFAULT_DIFFUSIVITY_M2S = 50.0   # typical sub-grid horizontal eddy diffusivity for a 1/12 deg model (assumption)
DEFAULT_POSITION_SIGMA_KM = 1.0  # uncertainty of the release / last-known position (assumption)
DRIFT_PRODUCTS = {"ops": "drift_ops.nc", "skill": "drift_skill.nc"}


class DriftFields:
    """Time-varying current + wind fields on the served grid, read lazily one timestep at a time."""

    def __init__(self, name: str):
        ds, reason = open_nc(name)
        if ds is None:
            raise LookupError(reason)
        self.ds = ds
        self.name = name
        self.hours = np.asarray(ds["time"][:], dtype=np.float64)
        self._steps: Dict[int, Tuple[np.ndarray, ...]] = {}

    @property
    def t0(self) -> dt.datetime:
        return dt.datetime.fromtimestamp(self.hours[0] * 3600, tz=dt.timezone.utc)

    @property
    def t1(self) -> dt.datetime:
        return dt.datetime.fromtimestamp(self.hours[-1] * 3600, tz=dt.timezone.utc)

    def step(self, k: int) -> Tuple[np.ndarray, ...]:
        hit = self._steps.get(k)
        if hit is None:
            hit = tuple(read_field(self.ds, v, k) for v in ("u", "v", "wind_u", "wind_v"))
            if len(self._steps) > 8:
                self._steps.pop(next(iter(self._steps)))
            self._steps[k] = hit
        return hit

    def at(self, hour: float) -> Optional[Tuple[Tuple[np.ndarray, ...], Tuple[np.ndarray, ...], float]]:
        if hour < self.hours[0] - 1e-6 or hour > self.hours[-1] + 1e-6:
            return None
        j = int(np.searchsorted(self.hours, hour))
        j = min(max(j, 1), len(self.hours) - 1)
        a = (hour - self.hours[j - 1]) / (self.hours[j] - self.hours[j - 1])
        return self.step(j - 1), self.step(j), float(min(max(a, 0.0), 1.0))


def sample_many(arr: np.ndarray, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Bilinear sample of a served-grid field at many points; NaN when the nearest cell is NaN or the
    point is outside the grid. NaN corners are excluded and weights renormalised (as sample_grid)."""
    h, w = arr.shape
    r = (np.asarray(lat) - GRID["lat0"]) / GRID["dlat"]
    c = (np.asarray(lon) - GRID["lon0"]) / GRID["dlon"]
    out = np.full(r.shape, np.nan)
    inside = (r >= 0) & (r <= h - 1) & (c >= 0) & (c <= w - 1)
    if not inside.any():
        return out
    ri, ci = r[inside], c[inside]
    r0 = np.floor(ri).astype(int)
    c0 = np.floor(ci).astype(int)
    r1, c1 = np.minimum(r0 + 1, h - 1), np.minimum(c0 + 1, w - 1)
    dr, dc = ri - r0, ci - c0
    near = arr[np.rint(ri).astype(int), np.rint(ci).astype(int)]
    num = np.zeros(ri.shape)
    den = np.zeros(ri.shape)
    for rr, cc, wt in ((r0, c0, (1 - dr) * (1 - dc)), (r1, c0, dr * (1 - dc)), (r0, c1, (1 - dr) * dc),
                       (r1, c1, dr * dc)):
        v = arr[rr, cc]
        ok = np.isfinite(v)
        num += np.where(ok, v * wt, 0.0)
        den += np.where(ok, wt, 0.0)
    with np.errstate(all="ignore"):
        val = num / den
    val[~np.isfinite(near) | (den <= 0)] = np.nan
    out[inside] = val
    return out


def _velocity(fields: DriftFields, hour: float, lat: np.ndarray, lon: np.ndarray, windage: np.ndarray
              ) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """(dlat/dt, dlon/dt) in deg/s; NaN for particles on land / outside; None outside the time span."""
    got = fields.at(hour)
    if got is None:
        return None
    a_, b_, a = got
    comp = []
    for idx in range(4):
        comp.append((1 - a) * sample_many(a_[idx], lat, lon) + a * sample_many(b_[idx], lat, lon))
    u, v, wu, wv = comp
    wu = np.where(np.isfinite(wu), wu, 0.0) if not np.any(windage) else wu
    wv = np.where(np.isfinite(wv), wv, 0.0) if not np.any(windage) else wv
    ue = u + windage * wu
    ve = v + windage * wv
    return ve / M_PER_DEG, ue / (M_PER_DEG * np.cos(np.deg2rad(lat)))


def run_ensemble(fields: DriftFields, lat0: np.ndarray, lon0: np.ndarray, start_hour: float, hours: float,
                 step_minutes: float, windage: np.ndarray, diffusivity: float, rng: np.random.Generator,
                 backward: bool = False, record_every: int = 1):
    """RK4 + random walk for N particles. Returns (times_h, lat[T, N], lon[T, N], stranded[N], stop_reason)."""
    n = lat0.size
    dt_s = step_minutes * 60.0 * (-1.0 if backward else 1.0)
    nsteps = int(round(hours * 60.0 / step_minutes))
    la, lo = lat0.astype(float).copy(), lon0.astype(float).copy()
    alive = np.isfinite(la)
    stranded = np.zeros(n, dtype=bool)
    rec_t, rec_la, rec_lo = [0.0], [la.copy()], [lo.copy()]
    stop = None
    h = start_hour
    for s in range(nsteps):
        dh = dt_s / 3600.0

        def f(hh, a_, b_):
            return _velocity(fields, hh, a_, b_, windage)

        k1 = f(h, la, lo)
        k2 = k1 and f(h + dh / 2, la + dt_s / 2 * k1[0], lo + dt_s / 2 * k1[1])
        k3 = k2 and f(h + dh / 2, la + dt_s / 2 * k2[0], lo + dt_s / 2 * k2[1])
        k4 = k3 and f(h + dh, la + dt_s * k3[0], lo + dt_s * k3[1])
        if k4 is None:
            stop = "reached the end of the available forcing fields"
            break
        dla = dt_s / 6.0 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
        dlo = dt_s / 6.0 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
        if diffusivity > 0:
            sig = math.sqrt(2.0 * diffusivity * abs(dt_s))  # metres
            dla = dla + rng.standard_normal(n) * sig / M_PER_DEG
            dlo = dlo + rng.standard_normal(n) * sig / (M_PER_DEG * np.cos(np.deg2rad(la)))
        nla, nlo = la + dla, lo + dlo
        # a particle whose next position is land / no-data strands at its last ocean position
        test = _velocity(fields, h + dh, nla, nlo, windage)
        ok = alive & np.isfinite(dla) & np.isfinite(dlo)
        if test is not None:
            ok &= np.isfinite(test[0])
        newly = alive & ~ok
        stranded |= newly
        alive &= ok
        la = np.where(alive, nla, la)
        lo = np.where(alive, nlo, lo)
        h += dh
        if (s + 1) % record_every == 0 or s == nsteps - 1:
            rec_t.append(abs(h - start_hour))
            rec_la.append(la.copy())
            rec_lo.append(lo.copy())
        if not alive.any():
            stop = "all particles reached land / no-data cells"
            break
    return np.array(rec_t), np.stack(rec_la), np.stack(rec_lo), stranded, stop


def _ellipse(lats: np.ndarray, lons: np.ndarray, nsig: float = 2.0, npts: int = 36) -> Optional[List[List[float]]]:
    """Covariance ellipse (nsig standard deviations, ~86 % for 2 sigma in 2-D) of particle positions."""
    ok = np.isfinite(lats) & np.isfinite(lons)
    if ok.sum() < 3:
        return None
    y = (lats[ok] - lats[ok].mean()) * M_PER_DEG
    x = (lons[ok] - lons[ok].mean()) * M_PER_DEG * math.cos(math.radians(float(lats[ok].mean())))
    cov = np.cov(np.vstack([x, y]))
    vals, vecs = np.linalg.eigh(cov)
    vals = np.maximum(vals, 1.0)
    th = np.linspace(0, 2 * np.pi, npts, endpoint=False)
    circ = np.vstack([np.cos(th), np.sin(th)]) * (nsig * np.sqrt(vals))[:, None]
    pts = vecs @ circ
    la = lats[ok].mean() + pts[1] / M_PER_DEG
    lo = lons[ok].mean() + pts[0] / (M_PER_DEG * math.cos(math.radians(float(lats[ok].mean()))))
    return [[round(float(a), 4), round(float(b), 4)] for a, b in zip(la, lo)]


DRIFT_CAVEATS = [
    "Currents are HYCOM ESPC-D-V02 total surface currents (analysis), varying every 3 h; they include "
    "wind-driven (Ekman) and inertial flow but are a model, not observations.",
    "Windage (fraction of the 10 m wind) and horizontal diffusivity are user-selected ASSUMPTIONS; the spread "
    "(cone) shows sensitivity to them and to the start position, not a calibrated probability.",
    "No explicit wave (Stokes) drift: the 3 % oil rule includes it empirically; other presets do not.",
    "Coastline at 1/8 deg: particles strand at the last ocean cell rather than beaching on the true shore.",
    "Reverse runs are weakly constrained where currents converge: different origins can reach the same point.",
]


def compute_drift_ensemble(lat: float, lon: float, mode: str = "forward", hours: float = 48.0,
                           start: Optional[str] = None, windage: str = "oil", diffusivity: Optional[float] = None,
                           members: int = 50, position_sigma_km: Optional[float] = None, product: str = "ops",
                           step_minutes: float = 30.0, seed: int = 7) -> Dict[str, Any]:
    base = {"mode": mode, "start": {"lat": lat, "lon": lon}, "hours_requested": hours, "caveats": DRIFT_CAVEATS}
    if mode not in ("forward", "reverse"):
        return {**base, "available": False, "reason": "mode must be 'forward' or 'reverse'."}
    if windage not in WINDAGE_PRESETS:
        return {**base, "available": False, "reason": f"windage must be one of {', '.join(WINDAGE_PRESETS)}."}
    if product not in DRIFT_PRODUCTS:
        return {**base, "available": False, "reason": f"product must be one of {', '.join(DRIFT_PRODUCTS)}."}
    try:
        fields = DriftFields(DRIFT_PRODUCTS[product])
    except LookupError as exc:
        return {**base, "available": False, "reason": str(exc)}
    K = DEFAULT_DIFFUSIVITY_M2S if diffusivity is None else float(diffusivity)
    psig = DEFAULT_POSITION_SIGMA_KM if position_sigma_km is None else float(position_sigma_km)
    wcoef, wnote = WINDAGE_PRESETS[windage]
    backward = mode == "reverse"
    if start:
        try:
            st = dt.datetime.fromisoformat(start.replace("Z", "+00:00"))
            st = st if st.tzinfo else st.replace(tzinfo=dt.timezone.utc)
        except ValueError:
            return {**base, "available": False, "reason": f"Invalid start '{start}' (ISO 8601 expected)."}
        sh = st.timestamp() / 3600.0
    else:
        # latest run that fits inside the fields: forward ends at the last field time, reverse starts there
        sh = fields.hours[-1] if backward else max(fields.hours[0], fields.hours[-1] - hours)
    if not (fields.hours[0] - 1e-6 <= sh <= fields.hours[-1] + 1e-6):
        return {**base, "available": False,
                "reason": f"Start time outside the forcing window {fields.t0:%Y-%m-%d %H:%M} .. "
                          f"{fields.t1:%Y-%m-%d %H:%M} UTC."}
    hours = float(min(hours, (sh - fields.hours[0]) if backward else (fields.hours[-1] - sh)))
    if hours <= 0:
        return {**base, "available": False, "reason": "No forcing data after the start time for this direction."}
    probe = _velocity(fields, sh, np.array([lat]), np.array([lon]), np.array([wcoef]))
    if probe is None or not np.isfinite(probe[0][0]):
        return {**base, "available": False,
                "reason": f"({lat:.3f}°N, {lon:.3f}°E) is on land, outside the domain, or has no current data."}
    members = int(min(max(members, 1), 200))
    rng = np.random.default_rng(seed)
    la0 = np.full(members, float(lat))
    lo0 = np.full(members, float(lon))
    if members > 1 and psig > 0:
        la0[1:] += rng.standard_normal(members - 1) * psig * 1000.0 / M_PER_DEG
        lo0[1:] += rng.standard_normal(members - 1) * psig * 1000.0 / (M_PER_DEG * math.cos(math.radians(lat)))
    wv = np.full(members, wcoef)
    if members > 1 and wcoef > 0:
        wv[1:] = np.clip(wcoef * (1 + 0.3 * rng.standard_normal(members - 1)), 0.0, None)  # +/-30 % (assumption)
    rec = max(1, int(round(60.0 / step_minutes)))  # record hourly
    # member 0 = deterministic central run (no diffusion, nominal position and windage)
    t, pla, plo, strand, stop = run_ensemble(fields, la0, lo0, sh, hours, step_minutes, wv, 0.0, rng, backward, rec)
    if members > 1 and K > 0:
        t2, la2, lo2, s2, _ = run_ensemble(fields, la0[1:], lo0[1:], sh, hours, step_minutes, wv[1:], K, rng,
                                               backward, rec)
        n = min(len(t), len(t2))
        pla = np.concatenate([pla[:n, :1], la2[:n]], axis=1)
        plo = np.concatenate([plo[:n, :1], lo2[:n]], axis=1)
        t = t[:n]
        strand = np.concatenate([strand[:1], s2])
    sign = -1 if backward else 1
    central = [{"lat": round(float(pla[i, 0]), 5), "lon": round(float(plo[i, 0]), 5),
                "t_hours": round(sign * float(t[i]), 3)} for i in range(len(t))]
    dist = 0.0
    for a, b in zip(central, central[1:]):
        dist += haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
    cone = []
    for mark in (6, 12, 24, 36, 48, 72, 96, 120, 168, 240):
        i = int(np.argmin(np.abs(t - mark)))
        if abs(t[i] - mark) < 0.51 and mark <= t[-1] + 1e-6:
            e = _ellipse(pla[i], plo[i])
            if e:
                d_km = [haversine_km(float(pla[i, 0]), float(plo[i, 0]), float(a), float(b))
                        for a, b in zip(pla[i], plo[i]) if np.isfinite(a)]
                cone.append({"t_hours": sign * mark, "ellipse": e,
                             "radius_km_p50": _r(np.percentile(d_km, 50), 2),
                             "radius_km_p90": _r(np.percentile(d_km, 90), 2)})
    t_start = dt.datetime.fromtimestamp(sh * 3600, tz=dt.timezone.utc)
    t_end = t_start + dt.timedelta(hours=sign * float(t[-1]))
    return {
        **base, "available": True, "engine": "ensemble",
        "method": (f"RK4 ({step_minutes:g} min) through time-varying HYCOM currents + {wcoef * 100:g} % of the 10 m "
                   f"wind; {members} members: member 0 deterministic, others with position sigma {psig:g} km, "
                   f"windage +/-30 % and random-walk diffusivity K = {K:g} m²/s"),
        "forcing": {"currents": getattr(fields.ds, "currents_source", "HYCOM"),
                    "wind": getattr(fields.ds, "wind_source", ""),
                    "window": [f"{fields.t0:%Y-%m-%dT%H:%MZ}", f"{fields.t1:%Y-%m-%dT%H:%MZ}"]},
        "assumptions": {"windage": {"preset": windage, "coefficient": wcoef, "note": wnote},
                        "diffusivity_m2s": K, "position_sigma_km": psig, "members": members,
                        "label": "ASSUMED values - not measured for this incident"},
        "start_time": f"{t_start:%Y-%m-%dT%H:%MZ}", "end_time": f"{t_end:%Y-%m-%dT%H:%MZ}",
        "hours_simulated": round(float(t[-1]), 2),
        "stopped_early": stop if t[-1] < hours - 1e-6 else None,
        "stranded_fraction": round(float(strand.mean()), 3),
        "end": {"lat": central[-1]["lat"], "lon": central[-1]["lon"]},
        "path_length_km": round(dist, 2),
        "path": central,
        "cone": cone,
        "members_end": [[round(float(a), 4), round(float(b), 4)] for a, b in zip(pla[-1], plo[-1]) if np.isfinite(a)],
    }


# --------------------------------------------------------------------------- Tropical Cyclone Heat Potential
#
# Leipper & Volgenau (1972): TCHP = rho * cp * integral from the 26 degC isotherm depth (D26) to the surface
# of (T(z) - 26) dz. rho = 1025 kg m-3, cp = 3992 J kg-1 K-1 (TEOS-10 cp0). Reported in kJ cm-2.
# Values above ~50 kJ cm-2 are associated with tropical-cyclone intensification (Mainelli et al. 2008).

TCHP_RHO = 1025.0
TCHP_CP = 3992.0
TCHP_T26 = 26.0
TCHP_INTENSIFICATION_KJCM2 = 50.0


def tchp_profile(depths: np.ndarray, temp: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """(tchp kJ/cm2, d26 m) for temp (Z, ...cells) on increasing depths (m). NaN where the surface value is
    missing; D26 = 0 and TCHP = 0 where SST < 26 degC; NaN where the column is warmer than 26 degC down to
    its deepest valid level (isotherm not reached)."""
    z = np.asarray(depths, dtype=np.float64)
    T = np.asarray(temp, dtype=np.float64)
    shape = T.shape[1:]
    tchp = np.zeros(shape)
    d26 = np.zeros(shape)
    done = ~np.isfinite(T[0]) | (T[0] < TCHP_T26)
    reached = done.copy()
    for k in range(len(z) - 1):
        t0, t1 = T[k], T[k + 1]
        dz = z[k + 1] - z[k]
        valid = ~done & np.isfinite(t0) & np.isfinite(t1)
        # whole layer above 26
        full = valid & (t1 >= TCHP_T26)
        tchp[full] += 0.5 * ((t0[full] - TCHP_T26) + (t1[full] - TCHP_T26)) * dz
        d26[full] = z[k + 1]
        # crossing inside the layer
        cross = valid & (t1 < TCHP_T26)
        with np.errstate(all="ignore"):
            frac = (t0 - TCHP_T26) / (t0 - t1)
        zc = z[k] + frac * dz
        tchp[cross] += 0.5 * (t0[cross] - TCHP_T26) * (zc[cross] - z[k])
        d26[cross] = zc[cross]
        reached |= cross
        done |= cross | (~done & ~np.isfinite(t1))  # stop at the seabed / last valid level
    tchp = tchp * TCHP_RHO * TCHP_CP / 1.0e7  # J m-2 -> kJ cm-2
    tchp[~np.isfinite(T[0])] = np.nan
    d26[~np.isfinite(T[0])] = np.nan
    unresolved = ~reached & np.isfinite(T[0])
    tchp[unresolved] = np.nan
    d26[unresolved] = np.nan
    return tchp.astype(np.float32), d26.astype(np.float32)


TCHP_CAVEAT = ("Tropical Cyclone Heat Potential from HYCOM ESPC-D-V02 3-D temperature (model analysis at 00 UTC), "
               "Leipper & Volgenau (1972). It measures ocean heat available to a storm; > 50 kJ/cm² favours "
               "intensification (Mainelli et al. 2008). It is not a cyclone forecast. Cells where the water is "
               "warmer than 26 °C down to the seabed (shallow shelves) are left blank.")


def hycom_temperature_column(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Latest HYCOM 3-D temperature column (0-300 m) at the nearest ocean grid point, from
    ext_products/hycom_t3z_latest.nc. None when the product or an ocean point within ~0.2 deg is missing."""
    import netCDF4 as nc
    ds, _ = open_nc("hycom_t3z_latest.nc")
    if ds is None:
        return None
    la, lo = np.asarray(ds["lat"][:], float), np.asarray(ds["lon"][:], float)
    j, i = int(np.argmin(np.abs(la - lat))), int(np.argmin(np.abs(lo - lon)))
    if abs(la[j] - lat) > 0.2 or abs(lo[i] - lon) > 0.2:
        return None
    col = np.ma.filled(ds["water_temp"][0, :, j, i].astype(float), np.nan)
    dep = np.asarray(ds["depth"][:], float)
    ok = np.isfinite(col)
    if ok.sum() < 3:
        return None
    t = ds["time"]
    when = nc.num2date(t[0], t.units)
    return {"levels": [{"depth": round(float(d), 1), "value": round(float(v), 3)} for d, v in zip(dep[ok], col[ok])],
            "date": when.strftime("%Y-%m-%d"), "time": when.strftime("%Y-%m-%dT%H:%MZ"),
            "max_depth": float(dep[ok].max()),
            "distance_km": round(haversine_km(lat, lon, float(la[j]), float(lo[i])), 1)}


def tchp_dates() -> Tuple[List[str], Optional[str]]:
    ds, reason = open_nc("tchp.nc")
    return (nc_dates(ds), None) if ds is not None else ([], reason)


def generic_layer_field(product: str, var: str, date: Optional[str], what: str
                        ) -> Tuple[Optional[np.ndarray], Optional[str], Optional[str]]:
    """(served-grid field, reason, date) from a (time, lat, lon) product already on the served grid."""
    ds, reason = open_nc(product)
    if ds is None:
        return None, reason, None
    dates = nc_dates(ds)
    d, err = _resolve(dates, date, what)
    if err:
        return None, err, None
    key = (f"{product}:{var}", d)
    if key in _field_cache:
        return _field_cache[key], None, d
    return _remember(key, read_field(ds, var, dates.index(d)).astype(np.float32)), None, d


def compute_tchp_summary(date: Optional[str] = None) -> Dict[str, Any]:
    field, reason, d = generic_layer_field("tchp.nc", "tchp", date, "TCHP")
    base = {"layer": "tchp", "date": d, "caveat": TCHP_CAVEAT, "units": "kJ/cm²"}
    if field is None:
        return {**base, "available": False, "reason": reason}
    area = _served_area_km2()
    finite = np.isfinite(field)
    hot = finite & (field >= TCHP_INTENSIFICATION_KJCM2)
    dates, _ = tchp_dates()
    return {**base, "available": True, "dates": dates,
            "threshold_kj_cm2": TCHP_INTENSIFICATION_KJCM2,
            "area_above_threshold_km2": round(float(area[hot].sum()), 1),
            "fraction_above_threshold": round(float(hot.sum()) / max(1, int(finite.sum())), 4),
            "max": _r(np.nanmax(field) if finite.any() else None, 1),
            "regions": _clusters(hot, field) if hot.any() else []}


# --------------------------------------------------------------------------- Genesis Potential Index

GPI_CAVEAT = ("Genesis Potential Index (Emanuel & Nolan 2004) from NCEP/NCAR Reanalysis 1 monthly means (2.5°) "
              "and OISST: combines 850 hPa absolute vorticity, 600 hPa humidity, potential intensity and "
              "200-850 hPa shear. It describes how favourable the monthly-mean environment is for tropical "
              "cyclone formation (a climate index); it is not a forecast of any individual storm. Shown "
              "interpolated from 2.5° and ends when R1 monthly updates stopped.")


def gpi_months() -> Tuple[List[str], Optional[str]]:
    ds, reason = open_nc("gpi_monthly.nc")
    return (nc_dates(ds), None) if ds is not None else ([], reason)


def gpi_field(date: Optional[str], var: str = "gpi") -> Tuple[Optional[np.ndarray], Optional[str], Optional[str]]:
    """GPI (or a component) for the month containing `date`, bilinear onto the served grid."""
    ds, reason = open_nc("gpi_monthly.nc")
    if ds is None:
        return None, reason, None
    dates = nc_dates(ds)
    if date is None:
        d = dates[-1]
    else:
        ym = date[:7]
        m = [x for x in dates if x[:7] == ym]
        if not m:
            return None, f"No GPI for {ym}. Available: {dates[0][:7]} .. {dates[-1][:7]}.", None
        d = m[0]
    key = (f"gpi:{var}", d)
    if key in _field_cache:
        return _field_cache[key], None, d
    fld = read_field(ds, var, dates.index(d))
    return _remember(key, regrid_to_served(fld, ds["lat"][:], ds["lon"][:])), None, d


def gpi_climatology(month: int, baseline: Tuple[int, int] = (1991, 2020)) -> Optional[np.ndarray]:
    ds, _ = open_nc("gpi_monthly.nc")
    if ds is None:
        return None
    key = ("gpi_clim", f"{month}-{baseline}")
    if key in _field_cache:
        return _field_cache[key]
    dates = nc_dates(ds)
    idx = [i for i, d in enumerate(dates) if int(d[5:7]) == month and baseline[0] <= int(d[:4]) <= baseline[1]]
    if not idx:
        return None
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        c = np.nanmean(np.ma.filled(ds["gpi"][idx].astype(float), np.nan), axis=0)
    return _remember(key, regrid_to_served(c, ds["lat"][:], ds["lon"][:]))


def compute_gpi_summary(date: Optional[str] = None) -> Dict[str, Any]:
    field, reason, d = gpi_field(date)
    base = {"layer": "gpi", "date": d, "caveat": GPI_CAVEAT}
    if field is None:
        return {**base, "available": False, "reason": reason}
    months, _ = gpi_months()
    clim = gpi_climatology(int(d[5:7]))
    finite = np.isfinite(field)
    lats, lons = grid_axes()
    out = {**base, "available": True, "months": {"first": months[0][:7], "last": months[-1][:7]},
           "max": _r(np.nanmax(field), 3), "domain_mean": _r(np.nanmean(field), 4)}
    if clim is not None:
        out["domain_mean_clim_1991_2020"] = _r(np.nanmean(clim), 4)
        out["anomaly_ratio_domain"] = _r(np.nanmean(field) / np.nanmean(clim), 3)
    hot = finite & (field >= max(1.0, float(np.nanpercentile(field[finite], 90)) if finite.any() else 1.0))
    out["regions"] = _clusters(hot, field) if hot.any() else []
    for basin, (la0, la1, lo0, lo1) in {"Bay of Bengal": (5, 23, 80, 100), "Arabian Sea": (5, 25, 50, 78)}.items():
        sel = finite & (lats[:, None] >= la0) & (lats[:, None] <= la1) & (lons[None, :] >= lo0) & (lons[None, :] <= lo1)
        out.setdefault("basins", {})[basin] = {
            "mean": _r(np.nanmean(field[sel]), 4) if sel.any() else None,
            "clim_mean": _r(np.nanmean(clim[sel]), 4) if (clim is not None and sel.any()) else None}
    return out


class StaticFields(DriftFields):
    """A single current snapshot held constant in time (the previous geostrophic drift model), no wind."""

    def __init__(self, u: np.ndarray, v: np.ndarray, label: str):  # super().__init__ not called on purpose
        self.name = label
        self.hours = np.array([-1e9, 1e9])
        z = np.zeros_like(u)
        self._fixed = (u, v, z, z)

    def at(self, hour: float):
        return self._fixed, self._fixed, 0.0


def liu_weisberg_skill(obs_lat: np.ndarray, obs_lon: np.ndarray, mod_lat: np.ndarray, mod_lon: np.ndarray,
                       n: float = 1.0) -> Optional[float]:
    """Liu & Weisberg (2011, JGR 116, C09013) skill score: s = sum(d_i) / sum(l_oi), ss = 1 - s/n (0 if s > n)."""
    d = [haversine_km(a, b, c, e) for a, b, c, e in zip(obs_lat[1:], obs_lon[1:], mod_lat[1:], mod_lon[1:])]
    seg = [haversine_km(a, b, c, e) for a, b, c, e in zip(obs_lat[:-1], obs_lon[:-1], obs_lat[1:], obs_lon[1:])]
    lo = np.cumsum(seg)
    if not np.all(np.isfinite(d)) or lo.sum() <= 0:
        return None
    s = float(np.sum(d) / np.sum(lo))
    return 1.0 - s / n if s <= n else 0.0


def compute_dhw_summary(date: Optional[str] = None) -> Dict[str, Any]:
    field, reason = oisst_layer_field("dhw", date)
    dates, _ = oisst_dates()
    d = date[:10] if date else (dates[-1] if dates else None)
    base = {"layer": "dhw", "date": d, "caveat": DHW_CAVEAT, "source": "NOAA OISST v2.1 (CRW v3.1 method)"}
    if field is None:
        return {**base, "available": False, "reason": reason}
    area = _served_area_km2()
    finite = np.isfinite(field)
    bands = [(0.0, 4.0, "0-4 (stress possible)"), (4.0, 8.0, "4-8 (Alert Level 1)"), (8.0, np.inf, ">= 8 (Alert Level 2)")]
    out = []
    for lo, hi, label in bands:
        sel = finite & (field > lo if lo == 0 else field >= lo) & (field < hi)
        out.append({"range": label, "cells": int(sel.sum()), "area_km2": round(float(area[sel].sum()), 1)})
    hot = finite & (field >= 4.0)
    return {**base, "available": True, "units": "degC-weeks", "bands": out,
            "max_dhw": _r(np.nanmax(field) if finite.any() else None, 2),
            "regions": _clusters(hot, field) if hot.any() else []}


# --------------------------------------------------------------------------- catalog / tiles

EXT_LAYERS = {
    "mhw_daily": {"units": "ratio", "long_name": "Daily marine heatwave intensity ratio (Hobday 2016 events)",
                  "source": "NOAA OISST v2.1", "caveat": MHW_DAILY_CAVEAT, "cadence": "daily"},
    "dhw": {"units": "degC-weeks", "long_name": "Degree Heating Weeks (NOAA CRW v3.1 method)",
            "source": "NOAA OISST v2.1", "caveat": DHW_CAVEAT, "cadence": "daily"},
    "tchp": {"units": "kJ/cm²", "long_name": "Tropical Cyclone Heat Potential",
             "source": "HYCOM ESPC-D-V02 3-D temperature", "caveat": TCHP_CAVEAT, "cadence": "daily 00 UTC"},
    "gpi": {"units": "1", "long_name": "Genesis Potential Index (Emanuel & Nolan 2004)",
            "source": "NCEP/NCAR R1 monthly + OISST", "caveat": GPI_CAVEAT, "cadence": "monthly"},
    "eddy_convergence_nrt": {"units": "0-100 indicator",
                             "long_name": "Warm-water & eddy convergence, same-day OISST + HYCOM vorticity",
                             "source": "NOAA OISST v2.1 + HYCOM ESPC-D-V02", "cadence": "daily",
                             "caveat": ("Same-day SST and total-current vorticity (no date mismatch). Still an "
                                        "ocean-only co-location indicator, NOT a cyclone forecast; see GPI for "
                                        "the atmospheric side.")},
}


def layer_dates(layer: str) -> Tuple[List[str], Optional[str]]:
    if layer in ("mhw_daily", "dhw"):
        return oisst_dates()
    if layer == "tchp":
        return tchp_dates()
    if layer == "gpi":
        return gpi_months()
    if layer == "eddy_convergence_nrt":
        ds, reason = open_nc("eddy_nrt.nc")
        return (nc_dates(ds), None) if ds is not None else ([], reason)
    return [], f"Unknown layer '{layer}'."


def ext_catalog() -> Dict[str, Any]:
    out = {}
    for layer, meta in EXT_LAYERS.items():
        dates, reason = layer_dates(layer)
        out[layer] = {**meta, "var_code": VAR_CODES[layer], "available": bool(dates),
                      "dates": dates, **({"reason": reason} if not dates else {})}
    return out


def layer_field(layer: str, date: Optional[str]) -> Tuple[Optional[np.ndarray], Optional[str], Optional[str]]:
    """(served-grid field, reason, resolved date) for any external layer."""
    if layer in ("mhw_daily", "dhw"):
        dates, _ = oisst_dates()
        f, reason = oisst_layer_field(layer, date)
        return f, reason, (date[:10] if date else (dates[-1] if dates else None)) if f is not None else None
    if layer == "tchp":
        return generic_layer_field("tchp.nc", "tchp", date, "TCHP")
    if layer == "eddy_convergence_nrt":
        return generic_layer_field("eddy_nrt.nc", "indicator", date, "eddy convergence (NRT)")
    if layer == "gpi":
        return gpi_field(date)
    return None, f"Unknown layer '{layer}'.", None


# --------------------------------------------------------------------------- cyclone tracks

def cyclone_tracks(season: Optional[int] = None, basin: Optional[str] = None, sid: Optional[str] = None,
                   min_wind_kt: Optional[float] = None, limit: int = 400) -> Dict[str, Any]:
    doc, reason = load_json_product("ibtracs_tracks.json")
    if doc is None:
        return {"available": False, "reason": reason}
    storms = doc["storms"]
    if sid:
        storms = [s for s in storms if s["sid"] == sid]
    if season:
        storms = [s for s in storms if s["season"] == season]
    if basin:
        storms = [s for s in storms if s["basin"] == basin.upper()]
    if min_wind_kt is not None:
        storms = [s for s in storms if (s.get("max_wind_kt") or 0) >= min_wind_kt]
    return {"available": True, "source": doc["source"], "wind_note": doc["wind_note"], "count": len(storms),
            "storms": storms[-limit:]}


COMPACT_STORM_KEYS = ("sid", "name", "season", "basin", "subbasin", "max_wind_kt", "start", "end", "genesis",
                      "landfall", "landfalls")


def compact_tracks(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Globe-friendly track document: per fix [time, lat, lon, wind_kt, imd_grade]."""
    out = {k: v for k, v in doc.items() if k != "storms"}
    out["point_fields"] = ["time", "lat", "lon", "wind_kt", "imd_grade"]
    out["storms"] = [{**{k: st.get(k) for k in COMPACT_STORM_KEYS},
                      "points": [[p["t"], p["lat"], p["lon"],
                                  p["wmo_wind_kt"] if p["wmo_wind_kt"] is not None else p["usa_wind_kt"],
                                  p["imd_grade"]] for p in st["points"]]} for st in doc["storms"]]
    return out


def cyclone_tracks_compact() -> Dict[str, Any]:
    doc, reason = load_json_product("ibtracs_tracks.json")
    if doc is None:
        return {"available": False, "reason": reason}
    key = ("compact_tracks", id(doc))
    hit = _cache.get(key)
    if hit is None:
        hit = {"available": True, **compact_tracks(doc)}
        _cache[key] = hit
    return hit


# --------------------------------------------------------------------------- advisories + export

def compute_ext_advisories(date: Optional[str] = None) -> Dict[str, Any]:
    """Advisory items from the daily / near-real-time layers (each item states its data date)."""
    items: List[Dict[str, Any]] = []
    unavailable: Dict[str, str] = {}
    mhw = compute_mhw_daily_summary(date)
    if mhw["available"]:
        for reg in mhw["regions"][:3]:
            cat = int(min(4, math.floor(reg["peak"]["value"]))) if reg["peak"]["value"] >= 1 else 1
            label = MHW_CATS[cat - 1][1]
            items.append({"type": "marine_heatwave_daily", "level": label.lower(), "severity": cat,
                          "date": mhw["date"], "source": "NOAA OISST v2.1",
                          "title": f"{label} marine heatwave (daily, >= 5 days) near {reg['centroid']['lat']:.1f}°N, "
                                   f"{reg['centroid']['lon']:.1f}°E",
                          "detail": f"{reg['area_km2']:,.0f} km² in a Hobday (2016) event; peak ratio "
                                    f"{reg['peak']['value']:.2f}.", "region": reg, "caveat": MHW_DAILY_CAVEAT})
    else:
        unavailable["marine_heatwave_daily"] = mhw["reason"]
    dhw = compute_dhw_summary(date)
    if dhw["available"]:
        for reg in dhw["regions"][:3]:
            lvl = "Alert Level 2" if reg["peak"]["value"] >= 8 else "Alert Level 1"
            items.append({"type": "coral_bleaching", "level": lvl.lower(), "severity": 3 if lvl.endswith("2") else 2,
                          "date": dhw["date"], "source": "NOAA OISST v2.1 (CRW method)",
                          "title": f"Coral bleaching {lvl} (DHW >= 4) near {reg['centroid']['lat']:.1f}°N, "
                                   f"{reg['centroid']['lon']:.1f}°E",
                          "detail": f"{reg['area_km2']:,.0f} km² with DHW >= 4 °C-weeks; peak "
                                    f"{reg['peak']['value']:.1f}.", "region": reg, "caveat": DHW_CAVEAT})
    else:
        unavailable["coral_bleaching"] = dhw["reason"]
    tchp = compute_tchp_summary(None)
    if tchp["available"]:
        for reg in tchp["regions"][:2]:
            items.append({"type": "cyclone_heat_potential", "level": "indicator", "severity": 1,
                          "date": tchp["date"], "source": "HYCOM ESPC-D-V02",
                          "title": f"High ocean heat content (TCHP >= 50 kJ/cm²) near {reg['centroid']['lat']:.1f}°N, "
                                   f"{reg['centroid']['lon']:.1f}°E",
                          "detail": f"{reg['area_km2']:,.0f} km²; a storm crossing it could intensify. Not a forecast.",
                          "region": reg, "caveat": TCHP_CAVEAT})
    else:
        unavailable["cyclone_heat_potential"] = tchp["reason"]
    return {"available": bool(items) or not unavailable, "advisories": items, "unavailable": unavailable,
            "note": "Descriptive summaries of observed / analysed fields; none is a forecast."}


def _bbox_polygon(b: Sequence[float]) -> List[List[float]]:
    w, s, e, n = b
    return [[w, s], [e, s], [e, n], [w, n], [w, s]]


def advisories_geojson(items: List[Dict[str, Any]], generated: str) -> Dict[str, Any]:
    feats = []
    for i, a in enumerate(items):
        reg = a.get("region") or {}
        geom = ({"type": "Polygon", "coordinates": [_bbox_polygon(reg["bbox"])]} if reg.get("bbox") else None)
        props = {k: v for k, v in a.items() if k != "region"}
        if reg:
            props.update({"area_km2": reg.get("area_km2"), "centroid": reg.get("centroid"), "peak": reg.get("peak")})
        feats.append({"type": "Feature", "id": f"adv-{i + 1}", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "generated": generated,
            "note": "Polygons are the bounding boxes of the flagged regions.", "features": feats}


CAP_SEVERITY = {0: "Minor", 1: "Minor", 2: "Moderate", 3: "Severe", 4: "Extreme"}
CAP_EVENT = {"marine_heatwave": "Marine heatwave (monthly index)", "marine_heatwave_daily": "Marine heatwave",
             "coral_bleaching": "Coral bleaching heat stress", "cyclone_heat_potential": "High ocean heat content",
             "eddy_convergence": "Warm-water and eddy convergence", "chl_bloom": "Chlorophyll bloom anomaly"}


def advisories_cap(items: List[Dict[str, Any]], generated: str, sender: str = "incois-3d-ocean@localhost") -> str:
    """OASIS Common Alerting Protocol 1.2 document, one <info> block per advisory. Certainty is 'Observed' and
    urgency 'Unknown' because the items describe analysed fields, not forecasts; the <note> states that the
    platform is a research prototype and not an official INCOIS warning service."""
    from xml.sax.saxutils import escape
    ident = "incois-3d-" + generated.replace(":", "").replace("-", "")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">',
             f"  <identifier>{escape(ident)}</identifier>", f"  <sender>{escape(sender)}</sender>",
             f"  <sent>{escape(generated)}</sent>", "  <status>Actual</status>", "  <msgType>Alert</msgType>",
             "  <scope>Public</scope>",
             "  <note>Descriptive summaries of observed / analysed ocean fields from the INCOIS 3D Ocean platform "
             "(research prototype). Not an official INCOIS warning.</note>"]
    for a in items:
        reg = a.get("region") or {}
        sev = CAP_SEVERITY.get(int(a.get("severity", 1)), "Minor")
        lines += ["  <info>", "    <language>en</language>", "    <category>Env</category>",
                  f"    <event>{escape(CAP_EVENT.get(a['type'], a['type']))}</event>",
                  "    <urgency>Unknown</urgency>", f"    <severity>{sev}</severity>",
                  "    <certainty>Observed</certainty>",
                  f"    <effective>{escape(str(a.get('date')))}T00:00:00Z</effective>",
                  f"    <headline>{escape(a['title'])}</headline>",
                  f"    <description>{escape(a['detail'])} Data: {escape(a.get('source', ''))}.</description>",
                  f"    <instruction>{escape(a.get('caveat', ''))}</instruction>"]
        if reg.get("bbox"):
            w, s, e, n = reg["bbox"]
            poly = " ".join(f"{la},{lo}" for lo, la in _bbox_polygon(reg["bbox"]))
            lines += ["    <area>", f"      <areaDesc>Region centred {reg['centroid']['lat']:.2f}N "
                                    f"{reg['centroid']['lon']:.2f}E, {reg['area_km2']:.0f} km2</areaDesc>",
                      f"      <polygon>{poly}</polygon>", "    </area>"]
        lines.append("  </info>")
    lines.append("</alert>")
    return "\n".join(lines) + "\n"
