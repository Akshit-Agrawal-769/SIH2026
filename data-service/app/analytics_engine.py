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


def get_catalog() -> Optional[Dict[str, Any]]:
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


def tile_path(variable: str, date: str, depth: float) -> Optional[str]:
    """Validated on-disk tile path, or None when the tile is not part of the catalog."""
    meta = variable_meta(variable)
    d = normalize_date(date)
    if meta is None or d is None or d not in meta["timesteps"]:
        return None
    if not any(abs(float(depth) - float(x)) < 1e-6 for x in meta["depths"]):
        return None
    path = os.path.join(get_data_root(), "tiles", variable, d, f"{depth_key(depth)}.bin")
    return path if os.path.isfile(path) else None


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


def load_tile(variable: str, date: str, depth: float = 0.0) -> Optional[np.ndarray]:
    path = tile_path(variable, date, depth)
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
    ts = timesteps(variable)
    for d in ts:
        arr = load_tile(variable, d, depth)
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


def health() -> Dict[str, Any]:
    cat = get_catalog()
    return {
        "catalog": bool(cat),
        "catalog_generated_at": cat.get("generated_at") if cat else None,
        "variables": {k: len(v["timesteps"]) for k, v in cat["variables"].items()} if cat else {},
        "instruments": len(cat.get("instruments", [])) if cat else 0,
        "server_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
