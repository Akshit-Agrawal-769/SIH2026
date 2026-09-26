"""
Scientific analytics engine for the INCOIS 3D Ocean data-service.

Every value returned here is read from artefacts produced by
``scripts/build_authentic_dataset.py`` from authentic source files
(INCOIS Bio-ROMS, CMEMS ARMOR3D, Argo GDAC). Missing data produces an explicit
``available: False`` with a reason; nothing is filled, extrapolated or invented.

The same module is imported by the build script to precompute the static
comparison / profile-analysis JSON used by static hosting, so there is a single
implementation of every statistic.
"""
import json
import os
import re
import struct
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

HEADER_FMT = "<4sHHHHHHff8s"
HEADER_SIZE = 32
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

UNITS = {
    "temperature": "°C",
    "salinity": "PSU",
    "chlorophyll": "mg/m³",
    "currents": "m/s",
    "mld": "m",
    "oxygen": "µmol/kg",
}

# Argo variable -> IBR model field used for collocation (surface fields only).
COMPARABLE_VARIABLES = ("temperature", "salinity")

_lock = threading.Lock()
_state: Dict[str, Any] = {"root": None, "catalog": None, "catalog_mtime": None}
_tile_cache: Dict[Tuple[str, str, str, float], np.ndarray] = {}
_TILE_CACHE_MAX = 96


# --------------------------------------------------------------------------- data root / catalog

def _default_data_root() -> str:
    env = os.getenv("OCEAN_DATA_ROOT")
    if env:
        return os.path.abspath(env)
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "..", "data"),                    # container image: /app/data
        os.path.join(here, "..", "..", "frontend", "public"),  # repository checkout
    ]
    for c in candidates:
        if os.path.exists(os.path.join(c, "api", "catalog.json")):
            return os.path.abspath(c)
    return os.path.abspath(candidates[-1])


def set_data_root(path: str) -> None:
    with _lock:
        _state["root"] = os.path.abspath(path)
        _state["catalog"] = None
        _state["catalog_mtime"] = None
        _tile_cache.clear()


def get_data_root() -> str:
    if _state["root"] is None:
        _state["root"] = _default_data_root()
    return _state["root"]


def get_catalog(live: bool = True) -> Optional[Dict[str, Any]]:
    """The served catalog. With ``live`` (default) the IBR variables list every timestep of
    the source file (tiles generated on demand by app.ibr_live); otherwise only the static export."""
    static = _static_catalog()
    if static is None or not live:
        return static
    return _with_full_ibr_record(static)


_live_cache: Dict[str, Any] = {"key": None, "catalog": None}


def _with_full_ibr_record(static: Dict[str, Any]) -> Dict[str, Any]:
    from app import ibr_live
    times = ibr_live.timesteps()
    if not times:
        return static
    key = (id(static), len(times))
    if _live_cache["key"] == key:
        return _live_cache["catalog"]
    full = sorted(times)
    cat = dict(static)
    cat["variables"] = {}
    for name, meta in static["variables"].items():
        if meta.get("source_id") == "ibr" and meta.get("source_variable"):
            meta = dict(meta)
            meta["static_timesteps"] = list(meta["timesteps"])
            meta["timesteps"] = sorted(set(full) | set(meta["timesteps"]))
        cat["variables"][name] = meta
    if "ibr" in static.get("sources", {}):
        cat["sources"] = dict(static["sources"])
        src = dict(cat["sources"]["ibr"])
        src["exported_window"] = (f"full record, {full[0]} .. {full[-1]} ({len(full)} timesteps); "
                                  f"static export {src.get('exported_window', '')}, other months regridded "
                                  f"on demand from {ibr_live.IBR_FILE} with the same method")
        cat["sources"]["ibr"] = src
    _live_cache.update(key=key, catalog=cat)
    return cat


def _static_catalog() -> Optional[Dict[str, Any]]:
    path = os.path.join(get_data_root(), "api", "catalog.json")
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    with _lock:
        if _state["catalog"] is None or _state["catalog_mtime"] != mtime:
            with open(path, encoding="utf-8") as f:
                _state["catalog"] = json.load(f)
            _state["catalog_mtime"] = mtime
            _tile_cache.clear()
        return _state["catalog"]


def variable_meta(variable: str) -> Optional[Dict[str, Any]]:
    cat = get_catalog()
    if not cat:
        return None
    return cat["variables"].get(variable)


def source_meta(source_id: str) -> Dict[str, Any]:
    cat = get_catalog() or {}
    return cat.get("sources", {}).get(source_id, {})


def grid() -> Dict[str, Any]:
    cat = get_catalog()
    if not cat:
        raise RuntimeError("Data catalog not found; run scripts/build_authentic_dataset.py")
    return cat["grid"]


def depth_key(depth: float) -> str:
    return f"{float(depth):.1f}"


def normalize_date(value: Optional[str]) -> Optional[str]:
    """Accept 'YYYY-MM-DD' or an ISO-8601 datetime; return 'YYYY-MM-DD' or None."""
    if not value:
        return None
    d = value.strip()[:10]
    return d if DATE_RE.match(d) else None


def timesteps(variable: str) -> List[str]:
    meta = variable_meta(variable)
    return list(meta["timesteps"]) if meta else []


def latest_timestep(variable: str) -> Optional[str]:
    ts = timesteps(variable)
    return ts[-1] if ts else None


def resolve_date(variable: str, date: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """Return (date, error). No nearest-date substitution: the date must exist."""
    ts = timesteps(variable)
    if not ts:
        return None, f"Variable '{variable}' has no timesteps in the catalog."
    if date is None:
        return ts[-1], None
    d = normalize_date(date)
    if d is None:
        return None, f"Invalid date '{date}' (expected YYYY-MM-DD)."
    if d not in ts:
        return None, (f"No '{variable}' data at {d}. Available timesteps: {ts[0]} .. {ts[-1]} "
                      f"({len(ts)} steps).")
    return d, None


def tile_path(variable: str, date: str, depth: float, generate: bool = True) -> Optional[str]:
    """Validated on-disk tile path, or None when the tile is not part of the catalog.
    IBR months outside the static export are regridded from the source file on demand
    (``generate``); that may raise model_store.StoreError when the source is unreachable."""
    meta = variable_meta(variable)
    d = normalize_date(date)
    if meta is None or d is None or d not in meta["timesteps"]:
        return None
    if not any(abs(float(depth) - float(x)) < 1e-6 for x in meta["depths"]):
        return None
    path = os.path.join(get_data_root(), "tiles", variable, d, f"{depth_key(depth)}.bin")
    if os.path.isfile(path):
        return path
    if meta.get("source_id") == "ibr" and abs(float(depth)) < 1e-6:
        from app import ibr_live
        cached = ibr_live.cached_tile_path(variable, d)
        if cached or not generate:
            return cached
        return ibr_live.tile_path(variable, d, meta, grid())
    return None


def parse_tile(buf: bytes, expected_var_code: Optional[int] = None) -> Tuple[Dict[str, Any], np.ndarray]:
    if len(buf) < HEADER_SIZE:
        raise ValueError("tile shorter than INCO header")
    magic, version, var_code, width, height, depth_count, data_type, vmin, vmax, _ = struct.unpack(
        HEADER_FMT, buf[:HEADER_SIZE])
    if magic != b"INCO":
        raise ValueError(f"bad magic {magic!r}")
    if data_type != 1:
        raise ValueError(f"unsupported data_type {data_type}")
    if expected_var_code is not None and var_code != expected_var_code:
        raise ValueError(f"tile var_code {var_code} != expected {expected_var_code}")
    n = width * height * depth_count
    if len(buf) != HEADER_SIZE + 4 * n:
        raise ValueError(f"payload size {len(buf) - HEADER_SIZE} != {4 * n}")
    arr = np.frombuffer(buf, dtype="<f4", count=n, offset=HEADER_SIZE).reshape((height, width))
    header = {"version": version, "var_code": var_code, "width": width, "height": height,
              "depth_count": depth_count, "min": vmin, "max": vmax}
    return header, arr


def load_tile(variable: str, date: str, depth: float = 0.0, generate: bool = True) -> Optional[np.ndarray]:
    try:
        path = tile_path(variable, date, depth, generate)
    except Exception as exc:  # source unreachable while generating an on-demand IBR tile
        print(f"[analytics] tile {variable} {date} unavailable: {exc}", flush=True)
        return None
    if path is None:
        return None
    key = (variable, normalize_date(date), depth_key(depth), os.path.getmtime(path))
    cached = _tile_cache.get(key)
    if cached is not None:
        return cached
    meta = variable_meta(variable)
    g = grid()
    with open(path, "rb") as f:
        header, arr = parse_tile(f.read(), meta["var_code"])
    if (header["width"], header["height"]) != (g["width"], g["height"]):
        raise ValueError(f"tile {path} grid {header['width']}x{header['height']} does not match catalog")
    arr = arr.astype(np.float64)
    if len(_tile_cache) >= _TILE_CACHE_MAX:
        _tile_cache.pop(next(iter(_tile_cache)))
    _tile_cache[key] = arr
    return arr


def grid_index(lat: float, lon: float) -> Optional[Tuple[float, float]]:
    """Fractional (row, col) in cell-centre registration; None outside the bbox."""
    g = grid()
    w, s, e, n = g["bbox"]
    if not (w <= lon <= e and s <= lat <= n):
        return None
    r = (lat - g["lat0"]) / g["dlat"]
    c = (lon - g["lon0"]) / g["dlon"]
    return min(max(r, 0.0), g["height"] - 1.0), min(max(c, 0.0), g["width"] - 1.0)


def sample_grid(arr: np.ndarray, lat: float, lon: float) -> Optional[float]:
    """
    Bilinear sample at (lat, lon). Returns None outside the domain or when the
    nearest cell is NaN (land / no data). Corners that are NaN are excluded and
    the weights renormalised, so values are never taken from land cells.
    """
    idx = grid_index(lat, lon)
    if idx is None:
        return None
    r, c = idx
    h, w = arr.shape
    if not np.isfinite(arr[int(round(r)), int(round(c))]):
        return None
    r0, c0 = int(np.floor(r)), int(np.floor(c))
    r1, c1 = min(h - 1, r0 + 1), min(w - 1, c0 + 1)
    dr, dc = r - r0, c - c0
    corners = ((arr[r0, c0], (1 - dr) * (1 - dc)), (arr[r1, c0], dr * (1 - dc)),
               (arr[r0, c1], (1 - dr) * dc), (arr[r1, c1], dr * dc))
    num = sum(v * wt for v, wt in corners if np.isfinite(v))
    den = sum(wt for v, wt in corners if np.isfinite(v))
    if den <= 0:
        return None
    return float(num / den)


def _r(x: Optional[float], nd: int = 4) -> Optional[float]:
    if x is None or not np.isfinite(x):
        return None
    return round(float(x), nd)


def _load_json(rel_path: str) -> Optional[Dict[str, Any]]:
    path = os.path.join(get_data_root(), rel_path)
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------------- instruments

def canonical_instrument_id(instrument_id: str) -> str:
    m = re.search(r"(\d{7})", instrument_id or "")
    return f"ARGO_{m.group(1)}" if m else instrument_id


def load_instruments() -> Optional[Dict[str, Any]]:
    return _load_json(os.path.join("api", "instruments.json"))


def load_profile(instrument_id: str) -> Optional[Dict[str, Any]]:
    iid = canonical_instrument_id(instrument_id)
    if not re.fullmatch(r"ARGO_\d{7}", iid):
        return None
    return _load_json(os.path.join("api", "profiles", f"{iid}.json"))


# --------------------------------------------------------------------------- statistics

def validation_metrics(obs: np.ndarray, mod: np.ndarray) -> Dict[str, Any]:
    """RMSE, MAE, bias (model - obs), Pearson r and r^2 for paired samples."""
    obs = np.asarray(obs, dtype=float)
    mod = np.asarray(mod, dtype=float)
    n = int(obs.size)
    if n == 0:
        return {"sample_count": 0, "rmse": None, "mae": None, "bias": None, "pearson_r": None, "r_squared": None}
    res = mod - obs
    out = {
        "sample_count": n,
        "rmse": _r(np.sqrt(np.mean(res ** 2))),
        "mae": _r(np.mean(np.abs(res))),
        "bias": _r(np.mean(res)),
        "pearson_r": None,
        "r_squared": None,
        "obs_mean": _r(np.mean(obs)),
        "model_mean": _r(np.mean(mod)),
        "obs_std": _r(np.std(obs)),
        "model_std": _r(np.std(mod)),
    }
    if n >= 3 and np.std(obs) > 1e-12 and np.std(mod) > 1e-12:
        r = float(np.corrcoef(obs, mod)[0, 1])
        out["pearson_r"] = _r(r)
        out["r_squared"] = _r(r * r)
    return out


# --------------------------------------------------------------------------- model vs observation

def compute_model_vs_obs(instrument_id: str, variable: str = "temperature",
                         date: Optional[str] = None) -> Dict[str, Any]:
    """
    Surface matchups between an Argo float and INCOIS Bio-ROMS (IBR).

    Pairs were collocated offline against the native IBR grid (nearest monthly
    timestep within +/-15 days, bilinear in space). Metrics are computed here
    from the stored pairs. ``date`` optionally restricts pairs to one model
    timestep (YYYY-MM-DD).
    """
    iid = canonical_instrument_id(instrument_id)
    units = UNITS.get(variable, "")
    base = {"instrument_id": iid, "variable": variable, "units": units, "available": False,
            "metrics": None, "pairs": [], "data_policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC"}
    ibr = source_meta("ibr")
    base["model_name"] = ibr.get("title", "INCOIS Bio-ROMS (IBR)")
    base["model_source"] = {k: ibr.get(k) for k in ("title", "institution", "doi", "doi_url", "time_coverage",
                                                    "vertical_levels")}
    prof = load_profile(iid)
    if prof:
        base.update({"wmo": prof["metadata"].get("wmo"), "latitude": prof["latitude"],
                     "longitude": prof["longitude"], "timestamp": prof["timestamp"],
                     "platform_type": prof.get("platform_type", "argo")})
    if variable not in COMPARABLE_VARIABLES:
        base["reason"] = (f"No model counterpart for '{variable}': IBR surface matchups are available for "
                          f"{', '.join(COMPARABLE_VARIABLES)} only.")
        return base
    mu = _load_json(os.path.join("api", "matchups", f"{iid}.json")) if re.fullmatch(r"ARGO_\d{7}", iid) else None
    if mu is None:
        base["reason"] = f"No observation record found for instrument '{instrument_id}'."
        return base

    only_date = normalize_date(date) if date else None
    records = mu.get("records", [])
    excluded = {"outside_model_time_coverage": 0, "no_near_surface_observation": 0,
                "model_no_data_at_location": 0, "other_model_timestep": 0}
    pairs = []
    obs_times = [r["time"] for r in records]
    for rec in records:
        if rec.get("status") != "collocated":
            excluded["outside_model_time_coverage"] += 1
            continue
        if only_date and rec.get("model_time") != only_date:
            excluded["other_model_timestep"] += 1
            continue
        v = rec.get(variable)
        if not v or v.get("obs") is None:
            excluded["no_near_surface_observation"] += 1
            continue
        if v.get("model") is None:
            excluded["model_no_data_at_location"] += 1
            continue
        pairs.append({
            "cycle": rec["cycle"], "time": rec["time"], "latitude": rec["latitude"], "longitude": rec["longitude"],
            "obs_depth": v["obs_depth"], "observation": v["obs"], "model": v["model"],
            "residual": round(v["model"] - v["obs"], 4),
            "model_time": rec["model_time"], "model_dt_days": rec["model_dt_days"],
        })
    base["method"] = mu.get("method")
    base["exclusions"] = excluded
    base["profiles_considered"] = len(records)
    base["model_time_coverage"] = mu.get("model_time_coverage")
    base["provenance"] = {
        "observation_source": (prof or {}).get("metadata", {}).get("source_file", "Argo GDAC NetCDF"),
        "observation_institution": (prof or {}).get("metadata", {}).get("institution"),
        "model_source": f"{ibr.get('title', 'INCOIS Bio-ROMS')} (DOI {ibr.get('doi', 'n/a')})",
        "collocation_method": "; ".join(f"{k}: {v}" for k, v in (mu.get("method") or {}).items()),
        "qc_mode": "Argo QC flags 1 and 2 only; adjusted values for A/D data modes",
    }
    if not pairs:
        span = f"{min(obs_times)[:10]} .. {max(obs_times)[:10]}" if obs_times else "none"
        cov = mu.get("model_time_coverage") or ["?", "?"]
        if excluded["outside_model_time_coverage"] == len(records):
            base["reason"] = (f"No temporal overlap: float profiles span {span}; IBR model coverage is "
                              f"{cov[0]} .. {cov[1]}.")
        else:
            base["reason"] = f"No valid collocated '{variable}' pairs ({excluded})."
        return base
    obs = np.array([p["observation"] for p in pairs])
    mod = np.array([p["model"] for p in pairs])
    base["available"] = True
    base["metrics"] = validation_metrics(obs, mod)
    base["pairs"] = pairs
    base["time_range"] = [pairs[0]["time"], pairs[-1]["time"]]
    base["model_date"] = only_date or f"{pairs[0]['model_time']} .. {pairs[-1]['model_time']}"
    return base


# --------------------------------------------------------------------------- observed profile analysis

MLD_REF_DEPTH_M = 10.0
MLD_DELTA_T = 0.2  # de Boyer Montegut et al. (2004), temperature criterion


def _interp_at(depths: np.ndarray, vals: np.ndarray, z: float) -> Optional[float]:
    if depths.size < 2 or z < depths[0] or z > depths[-1]:
        return None
    return float(np.interp(z, depths, vals))


def compute_observed_profile_analysis(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mixed-layer depth and thermocline from a measured Argo temperature profile.
    MLD: first depth below 10 m where |T - T(10 m)| >= 0.2 °C (de Boyer Montégut
    et al., 2004), linearly interpolated between the bracketing measured levels.
    Thermocline: depth of the maximum downward temperature decrease rate between
    consecutive measured levels below the MLD (<= 1000 m).
    """
    ms = [m for m in profile.get("measurements", [])
          if m.get("temperature") is not None and m.get("depth") is not None]
    ms.sort(key=lambda m: m["depth"])
    out: Dict[str, Any] = {
        "method": "de Boyer Montégut et al. (2004) ΔT = 0.2 °C relative to 10 m; thermocline = max -dT/dz",
        "levels_used": len(ms),
        "mld_meters": None,
        "thermocline_depth_meters": None,
        "thermocline_gradient_c_per_m": None,
        "reference_temperature": None,
    }
    if len(ms) < 3:
        out["reason"] = "Fewer than 3 QC-good temperature levels."
        return out
    z = np.array([m["depth"] for m in ms], dtype=float)
    t = np.array([m["temperature"] for m in ms], dtype=float)
    t_ref = _interp_at(z, t, MLD_REF_DEPTH_M)
    if t_ref is None:
        out["reason"] = "Profile does not bracket the 10 m reference depth."
        return out
    out["reference_temperature"] = round(t_ref, 4)
    mld = None
    below = np.where(z > MLD_REF_DEPTH_M)[0]
    prev_z, prev_t = MLD_REF_DEPTH_M, t_ref
    for k in below:
        if abs(t[k] - t_ref) >= MLD_DELTA_T:
            target = t_ref + np.sign(t[k] - t_ref) * MLD_DELTA_T
            frac = (target - prev_t) / (t[k] - prev_t) if t[k] != prev_t else 0.0
            mld = prev_z + frac * (z[k] - prev_z)
            break
        prev_z, prev_t = z[k], t[k]
    out["mld_meters"] = _r(mld, 1)
    start = mld if mld is not None else MLD_REF_DEPTH_M
    best, best_z = None, None
    for k in range(len(z) - 1):
        if z[k] < start or z[k + 1] > 1000.0:
            continue
        dz = z[k + 1] - z[k]
        if dz <= 0.5:
            continue
        g = (t[k] - t[k + 1]) / dz
        if best is None or g > best:
            best, best_z = g, 0.5 * (z[k] + z[k + 1])
    out["thermocline_depth_meters"] = _r(best_z, 1)
    out["thermocline_gradient_c_per_m"] = _r(best, 4)
    if mld is None:
        out["reason"] = "No 0.2 °C departure from the 10 m reference within the profile."
    return out


# --------------------------------------------------------------------------- gridded analytics

def _unavailable(variable: str, reason: str, **extra) -> Dict[str, Any]:
    out = {"available": False, "variable": variable, "reason": reason}
    out.update(extra)
    return out


def _check_variable(variable: str) -> Optional[str]:
    if variable_meta(variable) is None:
        cat = get_catalog()
        known = ", ".join(cat["variables"].keys()) if cat else "none (catalog missing)"
        return f"Unknown variable '{variable}'. Available: {known}."
    return None


def compute_timeseries(variable: str, lat: float, lon: float, depth: float = 0.0) -> Dict[str, Any]:
    """Point time series over all catalog timesteps with an ordinary least-squares trend."""
    err = _check_variable(variable)
    if err:
        return _unavailable(variable, err, lat=lat, lon=lon, depth=depth, timeseries_points=[])
    points, days, vals, missing = [], [], [], []
    # Only months that already exist as tiles (static export + ones generated on demand);
    # regridding all 480 IBR months for one point request would take minutes.
    ts = [d for d in timesteps(variable) if tile_path(variable, d, depth, generate=False)]
    if not ts:
        return _unavailable(variable, "No materialised tiles for this variable yet.", lat=lat, lon=lon,
                            depth=depth, timeseries_points=[])
    for d in ts:
        arr = load_tile(variable, d, depth, generate=False)
        v = sample_grid(arr, lat, lon) if arr is not None else None
        if v is None:
            missing.append(d)
            continue
        points.append({"date": d, "value": round(v, 4)})
        days.append((datetime.strptime(d, "%Y-%m-%d") - datetime.strptime(ts[0], "%Y-%m-%d")).days)
        vals.append(v)
    meta = variable_meta(variable)
    if len(vals) < 2:
        return _unavailable(variable, "Fewer than 2 valid values at this location/depth "
                                      "(outside domain, land, or no tile at this depth).",
                            lat=lat, lon=lon, depth=depth, timeseries_points=points, missing_dates=missing)
    x = np.array(days, dtype=float)
    y = np.array(vals, dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    return {
        "available": True,
        "variable": variable,
        "units": meta["units"],
        "source_id": meta["source_id"],
        "lat": lat, "lon": lon, "depth": depth,
        "interval": f"{points[0]['date']} to {points[-1]['date']} ({len(vals)} of {len(ts)} timesteps)",
        "start_value": round(y[0], 4),
        "end_value": round(y[-1], 4),
        "delta": round(y[-1] - y[0], 4),
        "trend_slope_per_day": round(float(slope), 6),
        "trend_slope_per_30_days": round(float(slope) * 30.0, 4),
        "trend_method": "ordinary least squares on actual day offsets; seasonal cycle not removed",
        "mean": round(float(np.mean(y)), 4),
        "std": round(float(np.std(y)), 4),
        "min": round(float(np.min(y)), 4),
        "max": round(float(np.max(y)), 4),
        "missing_dates": missing,
        "timeseries_points": points,
    }


def compute_anomalies(variable: str, lat: float, lon: float, depth: float = 0.0,
                      date: Optional[str] = None) -> Dict[str, Any]:
    """
    Spatial standardized departure: z = (x - mean_domain) / std_domain, computed
    over all valid cells of the same field (same date, same depth). This is NOT
    a climatological anomaly.
    """
    err = _check_variable(variable)
    if err:
        return _unavailable(variable, err)
    d, derr = resolve_date(variable, date)
    if derr:
        return _unavailable(variable, derr)
    arr = load_tile(variable, d, depth)
    if arr is None:
        return _unavailable(variable, f"No '{variable}' tile at {d}, depth {depth} m.")
    x = sample_grid(arr, lat, lon)
    if x is None:
        return _unavailable(variable, f"({lat:.3f}°N, {lon:.3f}°E) is outside the domain or on land.")
    valid = arr[np.isfinite(arr)]
    mu, sd = float(np.mean(valid)), float(np.std(valid))
    if sd < 1e-12:
        return _unavailable(variable, "Baseline field has zero variance; z-score undefined.")
    z = (x - mu) / sd
    a = abs(z)
    cls = "Normal" if a < 1.0 else ("Moderate Anomaly" if a < 2.0 else "Strong Anomaly")
    return {
        "available": True,
        "variable": variable,
        "units": UNITS.get(variable, ""),
        "lat": lat, "lon": lon, "depth": depth, "date": d,
        "value": round(x, 4),
        "baseline_mean": round(mu, 4),
        "baseline_std": round(sd, 4),
        "baseline_samples": int(valid.size),
        "baseline_definition": f"all valid ocean cells of the {d} field over the 35-100°E, 10°S-25°N domain",
        "z_score": round(z, 3),
        "classification": cls,
        "description": f"{'+' if z > 0 else ''}{z:.2f} σ relative to the same-day domain mean "
                       f"(spatial departure, not a climatological anomaly).",
    }


def compute_correlation(lat: float, lon: float, depth: float = 0.0, date: Optional[str] = None) -> Dict[str, Any]:
    """Pearson correlation between co-temporal fields over a 9x9-cell (~1.1°) neighbourhood."""
    cat = get_catalog()
    if not cat:
        return {"available": False, "reason": "Data catalog missing.", "variables": [], "sample_count": 0,
                "matrix": []}
    idx = grid_index(lat, lon)
    if idx is None:
        return {"available": False, "reason": "Coordinates outside the model domain.", "variables": [],
                "sample_count": 0, "matrix": []}
    if date is None:
        date = latest_timestep("temperature")
    d = normalize_date(date)
    r0, c0 = int(round(idx[0])), int(round(idx[1]))
    g = cat["grid"]
    rs, re_ = max(0, r0 - 4), min(g["height"], r0 + 5)
    cs, ce = max(0, c0 - 4), min(g["width"], c0 + 5)
    names, stacks, skipped = [], [], {}
    for var in cat["variables"]:
        arr = load_tile(var, d, depth) if d else None
        if arr is None:
            skipped[var] = f"no tile at {d}"
            continue
        names.append(var)
        stacks.append(arr[rs:re_, cs:ce].ravel())
    if len(names) < 2:
        return {"available": False, "reason": f"Fewer than 2 variables share timestep {d}.", "variables": names,
                "sample_count": 0, "matrix": [], "skipped": skipped, "date": d}
    stacked = np.vstack(stacks)
    mask = np.all(np.isfinite(stacked), axis=0)
    data = stacked[:, mask]
    n = int(data.shape[1])
    if n < 5:
        return {"available": False, "reason": f"Only {n} co-valid ocean cells in the neighbourhood (need 5).",
                "variables": names, "sample_count": n, "matrix": [], "skipped": skipped, "date": d}
    std = data.std(axis=1)
    matrix = []
    for i in range(len(names)):
        row = []
        for j in range(len(names)):
            if std[i] < 1e-12 or std[j] < 1e-12:
                row.append(None)
            else:
                row.append(round(float(np.corrcoef(data[i], data[j])[0, 1]), 3))
        matrix.append(row)
    return {
        "available": True, "lat": lat, "lon": lon, "depth": depth, "date": d,
        "variables": names, "sample_count": n, "matrix": matrix, "skipped": skipped,
        "note": "Neighbouring cells are spatially autocorrelated; coefficients are descriptive, not significance-tested.",
    }


def compute_vertical_profile_analysis(lat: float, lon: float, variable: str = "temperature",
                                      date: Optional[str] = None) -> Dict[str, Any]:
    """Vertical structure from the gridded model, when it has vertical levels."""
    err = _check_variable(variable)
    if err:
        return _unavailable(variable, err, lat=lat, lon=lon, levels=[])
    meta = variable_meta(variable)
    d, derr = resolve_date(variable, date)
    if derr:
        return _unavailable(variable, derr, lat=lat, lon=lon, levels=[])
    extra: Dict[str, Any] = {"lat": lat, "lon": lon, "date": d, "levels": [],
                             "model_depths": meta["depths"], "units": meta["units"]}
    mld_meta = variable_meta("mld")
    if mld_meta and d in mld_meta["timesteps"]:
        arr = load_tile("mld", d, 0.0)
        mld = sample_grid(arr, lat, lon) if arr is not None else None
        extra["model_mld_meters"] = _r(mld, 1)
        extra["model_mld_source"] = f"{source_meta(mld_meta['source_id']).get('title', '')} MLD diagnostic"
    levels = []
    for z in meta["depths"]:
        arr = load_tile(variable, d, z)
        v = sample_grid(arr, lat, lon) if arr is not None else None
        if v is not None:
            levels.append({"depth": z, "value": round(v, 4)})
    extra["levels"] = levels
    if len(levels) < 3:
        return _unavailable(
            variable,
            f"The {meta['source_id'].upper()} {variable} field has {len(meta['depths'])} vertical level(s) "
            f"({meta.get('vertical_coverage', 'surface only')}); a vertical profile, thermocline or "
            f"profile-based MLD cannot be derived from it. Use an Argo profile for vertical structure.",
            **extra)
    # Multi-level model (future datasets): temperature-criterion MLD on model levels.
    model_column = {"measurements": [{"depth": lv["depth"], "temperature": lv["value"]} for lv in levels]}
    analysis = compute_observed_profile_analysis(model_column) if variable == "temperature" else None
    extra.update({
        "available": True, "variable": variable,
        "surface_value": levels[0]["value"], "bottom_value": levels[-1]["value"],
        "mld_meters": analysis["mld_meters"] if analysis else None,
        "thermocline_depth_meters": analysis["thermocline_depth_meters"] if analysis else None,
        "max_gradient": analysis["thermocline_gradient_c_per_m"] if analysis else None,
        "gradient_unit": f"{meta['units']}/m",
    })
    return extra


# --------------------------------------------------------------------------- hazard layers (derived)
#
# Derived layers are listed under catalog["derived"] (not catalog["variables"], so existing
# variable lists, correlation and timelines are unchanged). Each is computed only from source
# fields already served here; anything that cannot be derived honestly returns available: False.
#
#   mhw_intensity     (6)  Hobday et al. (2018) intensity ratio (SST - clim) / (p90 - clim) against a
#                          per-cell monthly climatology (IBR SST, baseline in sst_climatology.npz).
#                          MONTHLY-MEAN index: the >= 5-day duration rule cannot be checked.
#   current_u / _v    (7/8) ARMOR3D surface GEOSTROPHIC velocity, native 0.125 deg (single date).
#   vorticity         (9)  Relative vorticity of that geostrophic flow (spherical finite differences).
#   eddy_convergence (10)  Warm-water & eddy convergence indicator: SST >= 26.5 degC AND cyclonic
#                          geostrophic vorticity. Descriptive co-occurrence, NOT a cyclone forecast.

EARTH_RADIUS_M = 6371000.0
M_PER_DEG = EARTH_RADIUS_M * np.pi / 180.0
SST_GENESIS_THRESHOLD_C = 26.5  # Gray (1968) / Palmen (1948) threshold for tropical-cyclone-supporting SST
EQUATORIAL_EXCLUSION_DEG = 2.0  # f -> 0: cyclonic sense undefined and geostrophy unreliable
EDDY_REF_PERCENTILE = 95.0

MHW_CATEGORIES = ((1.0, "Moderate"), (2.0, "Strong"), (3.0, "Severe"), (4.0, "Extreme"))

GEOSTROPHIC_CAVEATS = [
    "Currents are CMEMS ARMOR3D surface GEOSTROPHIC velocities only (thermal-wind balance): "
    "no wind-driven (Ekman) component, no Stokes (wave) drift, no tides or inertial motion.",
    "A single ARMOR3D snapshot is used and held constant; the real flow changes over hours to days.",
]
MHW_CAVEAT = ("Monthly-mean marine-heatwave index: Hobday et al. (2018) categories applied to monthly-mean IBR SST "
              "against a fixed 1990-2019 monthly climatology. The >= 5-day duration criterion cannot be checked on "
              "monthly data, so this indicates months whose mean exceeded the 90th percentile, not verified "
              "heatwave events. A fixed baseline still counts part of the long-term warming as heatwave; see the "
              "detrended variant and the daily OISST index.")
MHW_DETRENDED_CAVEAT = ("Detrended monthly-mean MHW index: the per-cell linear 1980-2019 SST trend is removed "
                        "before comparing with the 1990-2019 climatology (Jacox et al. 2020 shifting baseline), so "
                        "this isolates short-term extremes from long-term warming. Monthly data: no >= 5-day rule.")
CHL_BLOOM_CAVEAT = ("Chlorophyll bloom anomaly index from IBR model chlorophyll (monthly): the MHW ratio method "
                    "applied to log10(CHL) against a 1990-2019 per-cell monthly climatology and 90th percentile. "
                    "High chlorophyll marks unusually strong phytoplankton biomass; it does NOT identify harmful "
                    "species or toxins, so it is a screening indicator for harmful algal blooms, not a HAB detection.")
EDDY_CAVEAT = ("Warm-water & eddy convergence indicator, NOT a cyclone forecast or genesis probability. Tropical "
               "cyclogenesis is controlled by atmospheric conditions (low-level vorticity, humidity, vertical wind "
               "shear) that are not in these datasets. This layer only marks where warm surface water (SST >= "
               "26.5 degC) coincides with cyclonic OCEAN geostrophic vorticity.")


def mhw_intensity(sst: np.ndarray, clim: np.ndarray, p90: np.ndarray) -> np.ndarray:
    """
    Hobday et al. (2018) intensity ratio r = (SST - clim) / (p90 - clim). r >= 1 means SST is above
    the 90th-percentile threshold; floor(r) gives the category (1 moderate, 2 strong, 3 severe,
    4+ extreme). NaN wherever any input is missing or the threshold is not above the mean.
    """
    sst, clim, p90 = (np.asarray(a, dtype=np.float64) for a in (sst, clim, p90))
    diff = p90 - clim
    ok = np.isfinite(sst) & np.isfinite(clim) & np.isfinite(p90) & (diff > 0)
    out = np.full(sst.shape, np.nan, dtype=np.float64)
    out[ok] = (sst[ok] - clim[ok]) / diff[ok]
    return out.astype(np.float32)


def mhw_detrended(sst: np.ndarray, date: str, clim: Dict[str, Any]) -> np.ndarray:
    """MHW ratio on SST with the per-cell linear trend removed relative to the baseline midpoint
    (clim: arrays from sst_climatology.npz incl. trend_per_year, trend_ref_year, *_detrended)."""
    y, m = int(date[:4]), int(date[5:7])
    t = y + (m - 0.5) / 12.0
    ref = float(np.asarray(clim["trend_ref_year"]).ravel()[0])
    det = np.asarray(sst, dtype=np.float64) - np.asarray(clim["trend_per_year"], dtype=np.float64) * (t - ref)
    return mhw_intensity(det, clim["clim_detrended"][m - 1], clim["p90_detrended"][m - 1])


def mhw_category(ratio: float) -> Tuple[int, str]:
    """(category number 0-4, label) for one intensity ratio; 0 = below threshold."""
    if ratio is None or not np.isfinite(ratio) or ratio < 1.0:
        return 0, "None"
    cat = 0
    for i, (lo, _) in enumerate(MHW_CATEGORIES):
        if ratio >= lo:
            cat = i + 1
    return cat, MHW_CATEGORIES[cat - 1][1]


def relative_vorticity(u: np.ndarray, v: np.ndarray, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """
    Relative vorticity zeta = (1 / (R cos(phi))) * (dv/dlambda - d(u cos(phi))/dphi)  [s^-1]
    on a regular lat/lon grid (rows = lats ascending, cols = lons). Central differences only:
    a cell is NaN unless both neighbours on each axis are finite, so land edges and the domain
    border are never extrapolated.
    """
    u = np.asarray(u, dtype=np.float64)
    v = np.asarray(v, dtype=np.float64)
    phi = np.deg2rad(np.asarray(lats, dtype=np.float64))[:, None]
    dlam = np.deg2rad(float(lons[1] - lons[0]))
    dphi = np.deg2rad(float(lats[1] - lats[0]))
    zeta = np.full(u.shape, np.nan)
    dv_dlam = (v[1:-1, 2:] - v[1:-1, :-2]) / (2.0 * dlam)
    ucos = u * np.cos(phi)
    ducos_dphi = (ucos[2:, 1:-1] - ucos[:-2, 1:-1]) / (2.0 * dphi)
    zeta[1:-1, 1:-1] = (dv_dlam - ducos_dphi) / (EARTH_RADIUS_M * np.cos(phi[1:-1]))
    return zeta.astype(np.float32)


def eddy_convergence_indicator(sst: np.ndarray, zeta: np.ndarray, lats: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    0-100 indicator where SST >= 26.5 degC AND the geostrophic vorticity is cyclonic
    (zeta * sign(latitude) > 0): 100 * min(1, cyclonic zeta / zeta_ref), zeta_ref = 95th percentile
    of cyclonic vorticity over the domain. 0 = ocean cell without both conditions; NaN = missing input
    or within +/-2 deg of the equator. A relative descriptive index, not a probability.
    """
    lat2 = np.broadcast_to(np.asarray(lats, dtype=np.float64)[:, None], zeta.shape)
    cyc = np.asarray(zeta, dtype=np.float64) * np.sign(lat2)
    band_ok = np.abs(lat2) >= EQUATORIAL_EXCLUSION_DEG
    zeta_ok = np.isfinite(cyc) & band_ok
    pos = cyc[zeta_ok & (cyc > 0)]
    if pos.size == 0:
        return np.full(zeta.shape, np.nan, dtype=np.float32), {"zeta_ref": None}
    zeta_ref = float(np.percentile(pos, EDDY_REF_PERCENTILE))
    valid = zeta_ok & np.isfinite(sst)
    out = np.full(zeta.shape, np.nan)
    out[valid] = 0.0
    hit = valid & (np.asarray(sst) >= SST_GENESIS_THRESHOLD_C) & (cyc > 0)
    out[hit] = 100.0 * np.minimum(1.0, cyc[hit] / zeta_ref)
    return out.astype(np.float32), {"zeta_ref": zeta_ref, "zeta_ref_percentile": EDDY_REF_PERCENTILE,
                                    "sst_threshold_c": SST_GENESIS_THRESHOLD_C,
                                    "equatorial_exclusion_deg": EQUATORIAL_EXCLUSION_DEG}


def pack_tile(var_code: int, data: np.ndarray) -> bytes:
    """Serialise a served-grid field in the 32-byte INCO tile format (inverse of parse_tile)."""
    data = np.asarray(data, dtype="<f4")
    h, w = data.shape
    valid = data[np.isfinite(data)]
    vmin, vmax = (float(valid.min()), float(valid.max())) if valid.size else (float("nan"), float("nan"))
    return struct.pack(HEADER_FMT, b"INCO", 1, var_code, w, h, 1, 1, vmin, vmax, b"\x00" * 8) + data.tobytes()


def derived_meta(layer: str) -> Optional[Dict[str, Any]]:
    cat = get_catalog()
    return (cat or {}).get("derived", {}).get(layer)


def _grid_axes() -> Tuple[np.ndarray, np.ndarray]:
    g = grid()
    return (g["lat0"] + g["dlat"] * np.arange(g["height"]), g["lon0"] + g["dlon"] * np.arange(g["width"]))


_clim_cache: Dict[str, Dict[str, Any]] = {}


def _load_climatology(name: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Monthly climatology arrays (data/<name>.npz) on the served grid, or (None, reason)."""
    path = os.path.join(get_data_root(), "data", f"{name}.npz")
    if not os.path.isfile(path):
        return None, (f"{name} not built (data/{name}.npz missing). Run "
                      "`python scripts/build_authentic_dataset.py --hazards-only`.")
    mtime = os.path.getmtime(path)
    hit = _clim_cache.get(name)
    if hit is None or hit["mtime"] != mtime:
        z = dict(np.load(path))
        g = grid()
        if z["clim"].shape != (12, g["height"], g["width"]):
            return None, f"{name} grid {z['clim'].shape[1:]} does not match the served grid."
        z["baseline"] = [int(z["baseline"][0]), int(z["baseline"][1])]
        hit = {"mtime": mtime, "data": z}
        _clim_cache[name] = hit
    return hit["data"], None


def load_sst_climatology() -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Monthly SST climatology + 90th percentile (fixed and detrended) on the served grid, or (None, reason)."""
    return _load_climatology("sst_climatology")


def load_chl_climatology() -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    return _load_climatology("chl_climatology")


def _derived_cache_path(layer: str, d: str) -> str:
    base = os.getenv("VOLUME_CACHE_DIR", os.path.join(__import__("tempfile").gettempdir(), "incois_volume_cache"))
    return os.path.join(base, "derived_tiles", layer, d, "0.0.bin")


def _derive_field(layer: str, d: str) -> Tuple[Optional[np.ndarray], Optional[str]]:
    """Compute an IBR-dependent derived layer for date d from its real inputs."""
    if layer == "chl_bloom":
        chl = load_tile("chlorophyll", d, 0.0)
        if chl is None:
            return None, f"No chlorophyll field for {d} (IBR source unreachable or date not in record)."
        cc, err = load_chl_climatology()
        if err:
            return None, err
        floor = float(np.asarray(cc.get("floor_mg_m3", [1e-3])).ravel()[0])
        with np.errstate(all="ignore"):
            logc = np.where(np.isfinite(chl), np.log10(np.maximum(chl, floor)), np.nan)
        m = int(d[5:7]) - 1
        return mhw_intensity(logc, cc["clim"][m], cc["p90"][m]), None
    sst = load_tile("temperature", d, 0.0)
    if sst is None:
        return None, f"No SST field for {d} (IBR source unreachable or date not in record)."
    if layer == "mhw_intensity":
        clim, err = load_sst_climatology()
        if err:
            return None, err
        m = int(d[5:7]) - 1
        return mhw_intensity(sst, clim["clim"][m], clim["p90"][m]), None
    if layer == "mhw_detrended":
        clim, err = load_sst_climatology()
        if err:
            return None, err
        if "trend_per_year" not in clim:
            return None, "SST climatology has no detrended fields; rebuild with --hazards-only."
        return mhw_detrended(sst, d, clim), None
    if layer == "eddy_convergence":
        zeta, zerr, _ = load_derived("vorticity", None)
        if zeta is None:
            return None, zerr
        lats, _ = _grid_axes()
        return eddy_convergence_indicator(sst, zeta, lats)[0], None
    return None, f"'{layer}' is not derived on demand."


def load_derived(layer: str, date: Optional[str], generate: bool = True
                 ) -> Tuple[Optional[np.ndarray], Optional[str], Optional[str]]:
    """
    (field, reason, date) for a derived layer. Current/vorticity layers exist only for the
    ARMOR3D date and ignore ``date``; SST-dependent layers use an IBR timestep (default: latest).
    Static tiles are used when present, otherwise the field is derived and cached.
    """
    meta = derived_meta(layer)
    if meta is None:
        return None, (f"Derived layer '{layer}' is not in the catalog. Run "
                      f"`python scripts/build_authentic_dataset.py --hazards-only`."), None
    if meta.get("fixed_date"):
        d = meta["fixed_date"]
    else:
        d, derr = resolve_date("temperature", date)
        if derr:
            return None, derr, None
    for path in (os.path.join(get_data_root(), "tiles", layer, d, "0.0.bin"), _derived_cache_path(layer, d)):
        if os.path.isfile(path):
            with open(path, "rb") as f:
                _, arr = parse_tile(f.read(), meta["var_code"])
            return arr.astype(np.float64), None, d
    if not generate or meta.get("fixed_date"):
        return None, f"No '{layer}' tile for {d}.", d
    arr, reason = _derive_field(layer, d)
    if arr is None:
        return None, reason, d
    path = _derived_cache_path(layer, d)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
        with open(tmp, "wb") as f:
            f.write(pack_tile(meta["var_code"], arr))
        os.replace(tmp, path)
    except OSError:
        pass
    return arr.astype(np.float64), None, d


def derived_tile_bytes(layer: str, date: Optional[str]) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
    arr, reason, d = load_derived(layer, date)
    if arr is None:
        return None, reason, d
    return pack_tile(derived_meta(layer)["var_code"], arr), None, d


def _cell_area_km2(lats: np.ndarray) -> np.ndarray:
    g = grid()
    return (M_PER_DEG / 1000.0) ** 2 * g["dlat"] * g["dlon"] * np.cos(np.deg2rad(lats))


def _clusters(mask: np.ndarray, value: np.ndarray, top: int = 5) -> List[Dict[str, Any]]:
    """Connected regions (8-neighbour) of ``mask``, largest first, with area and centroid."""
    from scipy import ndimage
    lats, lons = _grid_axes()
    area = _cell_area_km2(lats)[:, None] * np.ones((1, lons.size))
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    out = []
    for k in range(1, n + 1):
        sel = lab == k
        a = float(area[sel].sum())
        rows, cols = np.nonzero(sel)
        w = area[sel]
        vals = value[sel]
        i = int(np.nanargmax(vals))
        out.append({
            "cells": int(sel.sum()), "area_km2": round(a, 1),
            "centroid": {"lat": round(float(np.average(lats[rows], weights=w)), 3),
                         "lon": round(float(np.average(lons[cols], weights=w)), 3)},
            "peak": {"lat": round(float(lats[rows[i]]), 3), "lon": round(float(lons[cols[i]]), 3),
                     "value": round(float(vals[i]), 3)},
            "mean_value": round(float(np.nanmean(vals)), 3),
            "bbox": [round(float(lons[cols].min()), 3), round(float(lats[rows].min()), 3),
                     round(float(lons[cols].max()), 3), round(float(lats[rows].max()), 3)],
        })
    out.sort(key=lambda c: -c["area_km2"])
    return out[:top]


RATIO_LAYERS = {
    # layer: (caveat, climatology loader key, method template, category labels)
    "mhw_intensity": ("sst", "Hobday et al. (2018) categories on the ratio (SST - clim) / (p90 - clim); clim and "
                             "p90 per cell and calendar month from IBR SST {b0}-{b1}.", MHW_CATEGORIES),
    "mhw_detrended": ("sst", "Hobday et al. (2018) categories on the ratio (SST' - clim') / (p90' - clim') where SST' "
                             "is IBR SST with the per-cell linear trend removed; clim' and p90' over {b0}-{b1}.",
                      MHW_CATEGORIES),
    "chl_bloom": ("chl", "Ratio (log10 CHL - clim) / (p90 - clim), clim and p90 per cell and calendar month from "
                         "IBR chlorophyll {b0}-{b1}; >= 1 means above the 90th percentile.",
                  ((1.0, "Elevated"), (2.0, "High"), (3.0, "Very high"), (4.0, "Extreme"))),
}


def _ratio_caveat(layer: str) -> str:
    return {"mhw_intensity": MHW_CAVEAT, "mhw_detrended": MHW_DETRENDED_CAVEAT, "chl_bloom": CHL_BLOOM_CAVEAT}[layer]


def _ratio_category(ratio: float, cats) -> Tuple[int, str]:
    if ratio is None or not np.isfinite(ratio) or ratio < cats[0][0]:
        return 0, "None"
    cat = max(i + 1 for i, (lo, _) in enumerate(cats) if ratio >= lo)
    return cat, cats[cat - 1][1]


def compute_mhw_summary(date: Optional[str] = None, layer: str = "mhw_intensity") -> Dict[str, Any]:
    """Domain-wide monthly ratio index (MHW fixed / detrended, or chlorophyll bloom) for one IBR month:
    area per category and main regions."""
    if layer not in RATIO_LAYERS:
        return {"available": False, "layer": layer, "reason": f"Unknown ratio layer '{layer}'."}
    caveat = _ratio_caveat(layer)
    arr, reason, d = load_derived(layer, date)
    if arr is None:
        return {"available": False, "layer": layer, "date": d, "reason": reason, "caveat": caveat}
    kind, method, cats_def = RATIO_LAYERS[layer]
    clim, _ = load_sst_climatology() if kind == "sst" else load_chl_climatology()
    lats, lons = _grid_axes()
    area = _cell_area_km2(lats)[:, None] * np.ones((1, lons.size))
    finite = np.isfinite(arr)
    cats = []
    for i, (lo, label) in enumerate(cats_def):
        hi = cats_def[i + 1][0] if i + 1 < len(cats_def) else np.inf
        sel = finite & (arr >= lo) & (arr < hi)
        cats.append({"category": i + 1, "label": label, "ratio_range": [lo, None if hi == np.inf else hi],
                     "cells": int(sel.sum()), "area_km2": round(float(area[sel].sum()), 1)})
    mhw = finite & (arr >= 1.0)
    b0, b1 = clim["baseline"] if clim else ("?", "?")
    return {
        "available": True, "layer": layer, "date": d,
        "method": method.format(b0=b0, b1=b1),
        "baseline": [b0, b1],
        "ocean_cells": int(finite.sum()),
        "mhw_cells": int(mhw.sum()),
        "mhw_fraction": round(float(mhw.sum()) / max(1, int(finite.sum())), 4),
        "categories": cats,
        "max_ratio": round(float(np.nanmax(arr)), 3) if finite.any() else None,
        "regions": _clusters(mhw, arr) if mhw.any() else [],
        "caveat": caveat,
    }


def compute_mhw_point(lat: float, lon: float, date: Optional[str] = None, layer: str = "mhw_intensity"
                      ) -> Dict[str, Any]:
    """Ratio index at one location: value, climatology, threshold, ratio and category."""
    if layer not in RATIO_LAYERS:
        return {"available": False, "lat": lat, "lon": lon, "reason": f"Unknown ratio layer '{layer}'."}
    caveat = _ratio_caveat(layer)
    arr, reason, d = load_derived(layer, date)
    if arr is None:
        return {"available": False, "lat": lat, "lon": lon, "date": d, "reason": reason, "caveat": caveat}
    r = sample_grid(arr, lat, lon)
    if r is None:
        return {"available": False, "lat": lat, "lon": lon, "date": d, "caveat": caveat,
                "reason": f"({lat:.3f}°N, {lon:.3f}°E) is outside the domain, on land, or has no climatology."}
    kind, _, cats_def = RATIO_LAYERS[layer]
    m = int(d[5:7]) - 1
    cat, label = _ratio_category(r, cats_def)
    out = {"available": True, "layer": layer, "lat": lat, "lon": lon, "date": d,
           "intensity_ratio": round(r, 3), "category": cat, "category_label": label, "caveat": caveat}
    if kind == "sst":
        clim, _ = load_sst_climatology()
        sst = load_tile("temperature", d, 0.0)
        suffix = "_detrended" if layer == "mhw_detrended" else ""
        out.update({
            "units": "°C", "sst": _r(sample_grid(sst, lat, lon) if sst is not None else None, 3),
            "climatology": _r(sample_grid(clim["clim" + suffix][m].astype(np.float64), lat, lon), 3),
            "threshold_p90": _r(sample_grid(clim["p90" + suffix][m].astype(np.float64), lat, lon), 3),
            "baseline": clim["baseline"],
        })
        if suffix:
            out["trend_degC_per_decade"] = _r(10 * (sample_grid(clim["trend_per_year"].astype(np.float64), lat, lon)
                                                    or np.nan), 4)
    else:
        clim, _ = load_chl_climatology()
        chl = load_tile("chlorophyll", d, 0.0)
        c = sample_grid(clim["clim"][m].astype(np.float64), lat, lon)
        p = sample_grid(clim["p90"][m].astype(np.float64), lat, lon)
        out.update({
            "units": "mg/m³", "chlorophyll": _r(sample_grid(chl, lat, lon) if chl is not None else None, 4),
            "climatology": _r(10 ** c if c is not None else None, 4),
            "threshold_p90": _r(10 ** p if p is not None else None, 4),
            "baseline": clim["baseline"], "note": "climatology and threshold are geometric (log10) means/percentiles",
        })
    return out


def compute_eddy_convergence_summary(date: Optional[str] = None) -> Dict[str, Any]:
    """Warm-water & eddy convergence indicator for one IBR month (vorticity from the ARMOR3D date)."""
    arr, reason, d = load_derived("eddy_convergence", date)
    zmeta = derived_meta("vorticity") or {}
    base = {"layer": "eddy_convergence", "date": d, "sst_date": d, "currents_date": zmeta.get("fixed_date"),
            "caveat": EDDY_CAVEAT, "geostrophic_caveats": GEOSTROPHIC_CAVEATS}
    if arr is None:
        return {**base, "available": False, "reason": reason}
    finite = np.isfinite(arr)
    hot = finite & (arr >= 50.0)
    lats, _ = _grid_axes()
    zeta, _, _ = load_derived("vorticity", None)
    ref = eddy_convergence_indicator(np.zeros_like(zeta), zeta, lats)[1] if zeta is not None else {}
    return {
        **base, "available": True,
        "date_mismatch": (f"SST is the IBR month {d}; vorticity is from ARMOR3D {zmeta.get('fixed_date')}. "
                          f"They are not simultaneous, so co-location is illustrative only."),
        "method": ("indicator = 100 * min(1, cyclonic zeta / zeta_ref) where SST >= 26.5 °C and zeta*sign(lat) > 0; "
                   "zeta_ref = 95th percentile of cyclonic geostrophic vorticity over the domain; "
                   f"|lat| < {EQUATORIAL_EXCLUSION_DEG}° excluded."),
        "reference": {k: (round(v, 9) if isinstance(v, float) else v) for k, v in ref.items()},
        "cells_nonzero": int((finite & (arr > 0)).sum()),
        "cells_ge_50": int(hot.sum()),
        "regions": _clusters(hot, arr) if hot.any() else [],
    }


def compute_drift(lat: float, lon: float, mode: str = "forward", hours: float = 48.0,
                  step_minutes: float = 60.0) -> Dict[str, Any]:
    """
    Particle path by 4th-order Runge-Kutta through the ARMOR3D surface geostrophic field
    (bilinear, land cells never used). forward: where a particle released here would go;
    reverse: integrate backwards from a last-known position toward a probable origin.
    Stops early if the particle reaches land/no-data or leaves the domain.
    """
    base = {"mode": mode, "start": {"lat": lat, "lon": lon}, "hours_requested": hours,
            "caveats": GEOSTROPHIC_CAVEATS + [
                "Stokes (wave) drift, windage of floating material and Ekman transport are not modelled, so "
                "the true drift can differ substantially in speed and direction."]}
    if mode not in ("forward", "reverse"):
        return {**base, "available": False, "reason": "mode must be 'forward' or 'reverse'."}
    if not (0 < hours <= 240) or not (5 <= step_minutes <= 360):
        return {**base, "available": False, "reason": "hours must be in (0, 240] and step_minutes in [5, 360]."}
    u, ureason, d = load_derived("current_u", None)
    v, vreason, _ = load_derived("current_v", None)
    if u is None or v is None:
        return {**base, "available": False, "reason": ureason or vreason}
    base["currents_date"] = d

    def vel(la: float, lo: float) -> Optional[Tuple[float, float]]:
        uu, vv = sample_grid(u, la, lo), sample_grid(v, la, lo)
        if uu is None or vv is None:
            return None
        return uu, vv

    def deriv(la: float, lo: float) -> Optional[Tuple[float, float]]:
        w = vel(la, lo)
        if w is None:
            return None
        return w[1] / M_PER_DEG, w[0] / (M_PER_DEG * np.cos(np.deg2rad(la)))  # deg/s (dlat, dlon)

    dt = step_minutes * 60.0 * (1.0 if mode == "forward" else -1.0)
    n = int(round(hours * 60.0 / step_minutes))
    w0 = vel(lat, lon)
    if w0 is None:
        return {**base, "available": False,
                "reason": f"({lat:.3f}°N, {lon:.3f}°E) is on land, outside the domain, or has no current data."}
    path = [{"lat": round(lat, 5), "lon": round(lon, 5), "t_hours": 0.0,
             "speed_ms": round(float(np.hypot(*w0)), 4)}]
    la, lo, stop = lat, lon, None
    for i in range(n):
        k1 = deriv(la, lo)
        k2 = k1 and deriv(la + 0.5 * dt * k1[0], lo + 0.5 * dt * k1[1])
        k3 = k2 and deriv(la + 0.5 * dt * k2[0], lo + 0.5 * dt * k2[1])
        k4 = k3 and deriv(la + dt * k3[0], lo + dt * k3[1])
        if not k4:
            stop = "reached land / no-data cells or the domain edge"
            break
        la += dt / 6.0 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
        lo += dt / 6.0 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
        w = vel(la, lo)
        if w is None:
            stop = "reached land / no-data cells or the domain edge"
            break
        path.append({"lat": round(la, 5), "lon": round(lo, 5),
                     "t_hours": round((i + 1) * step_minutes / 60.0 * (1 if mode == "forward" else -1), 3),
                     "speed_ms": round(float(np.hypot(*w)), 4)})
    dist_km = 0.0
    for a, b in zip(path, path[1:]):
        dy = (b["lat"] - a["lat"]) * M_PER_DEG
        dx = (b["lon"] - a["lon"]) * M_PER_DEG * np.cos(np.deg2rad(0.5 * (a["lat"] + b["lat"])))
        dist_km += float(np.hypot(dx, dy)) / 1000.0
    return {
        **base, "available": True,
        "method": f"RK4, step {step_minutes:g} min, bilinear sampling (land corners excluded), steady field",
        "hours_simulated": abs(path[-1]["t_hours"]),
        "stopped_early": stop,
        "end": {"lat": path[-1]["lat"], "lon": path[-1]["lon"]},
        "path_length_km": round(dist_km, 2),
        "path": path,
    }


def compute_advisories(date: Optional[str] = None) -> Dict[str, Any]:
    """Advisory items derived only from the MHW and eddy-convergence summaries above."""
    items: List[Dict[str, Any]] = []
    mhw = compute_mhw_summary(date)
    if mhw["available"]:
        for reg in mhw["regions"][:3]:
            cat, label = mhw_category(reg["peak"]["value"])
            items.append({
                "type": "marine_heatwave", "level": label.lower(), "date": mhw["date"],
                "title": f"{label} monthly-mean MHW index near {reg['centroid']['lat']:.1f}°N, "
                         f"{reg['centroid']['lon']:.1f}°E",
                "detail": f"{reg['area_km2']:,.0f} km² above the 90th-percentile threshold; peak ratio "
                          f"{reg['peak']['value']:.2f} at {reg['peak']['lat']:.2f}°N, {reg['peak']['lon']:.2f}°E.",
                "region": reg, "caveat": MHW_CAVEAT,
            })
    eddy = compute_eddy_convergence_summary(date)
    if eddy["available"]:
        for reg in eddy["regions"][:3]:
            items.append({
                "type": "eddy_convergence", "level": "indicator", "date": eddy["date"],
                "title": f"Warm-water & cyclonic-eddy co-location near {reg['centroid']['lat']:.1f}°N, "
                         f"{reg['centroid']['lon']:.1f}°E",
                "detail": f"{reg['area_km2']:,.0f} km² with indicator ≥ 50 (peak {reg['peak']['value']:.0f}). "
                          + eddy["date_mismatch"],
                "region": reg, "caveat": EDDY_CAVEAT,
            })
    chl = compute_mhw_summary(date, "chl_bloom")
    if chl["available"]:
        for reg in chl["regions"][:2]:
            cat, label = _ratio_category(reg["peak"]["value"], RATIO_LAYERS["chl_bloom"][2])
            items.append({
                "type": "chl_bloom", "level": label.lower(), "date": chl["date"],
                "title": f"{label} chlorophyll bloom anomaly near {reg['centroid']['lat']:.1f}°N, "
                         f"{reg['centroid']['lon']:.1f}°E (HAB screening)",
                "detail": f"{reg['area_km2']:,.0f} km² above the monthly 90th percentile of log10 chlorophyll; peak "
                          f"ratio {reg['peak']['value']:.2f}. Not a harmful-species detection.",
                "region": reg, "caveat": CHL_BLOOM_CAVEAT,
            })
    unavailable = {k: s["reason"] for k, s in (("marine_heatwave", mhw), ("eddy_convergence", eddy),
                                               ("chl_bloom", chl)) if not s["available"]}
    return {"available": bool(items) or not unavailable, "date": mhw.get("date") or eddy.get("date"),
            "advisories": items, "unavailable": unavailable,
            "note": "Advisories are descriptive summaries of the layers above; none is a forecast."}


def health() -> Dict[str, Any]:
    cat = get_catalog(live=False)  # never block a health check on the remote source
    return {
        "catalog": bool(cat),
        "catalog_generated_at": cat.get("generated_at") if cat else None,
        "variables": {k: len(v["timesteps"]) for k, v in cat["variables"].items()} if cat else {},
        "instruments": len(cat.get("instruments", [])) if cat else 0,
        "server_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
