import os
import glob
import json
import struct
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "api")
DIST_DATA_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist", "api")

TILE_SEARCH_DIRS = [
    os.path.join(BASE_DIR, "tiles"),
    os.path.join(BASE_DIR, "..", "frontend", "public", "tiles"),
    os.path.join(BASE_DIR, "..", "api", "tiles"),
    os.path.join(BASE_DIR, "..", "tiles"),
    os.path.join(BASE_DIR, "..", "frontend", "dist", "tiles")
]

PROFILE_SEARCH_DIRS = [
    os.path.join(DATA_DIR, "profiles"),
    os.path.join(PUBLIC_DATA_DIR, "profiles"),
    os.path.join(DIST_DATA_DIR, "profiles"),
    os.path.join(BASE_DIR, "..", "api", "data", "profiles"),
    os.path.join(BASE_DIR, "..", "frontend", "public", "data", "profiles")
]

# Model Grid Constants
WIDTH = 520
HEIGHT = 280
LON_MIN, LON_MAX = 35.0, 100.0
LAT_MIN, LAT_MAX = -10.0, 25.0
MODEL_DEPTHS = [0.5, 10.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0]
AVAILABLE_DATES = ["2024-06-01", "2024-06-02", "2024-06-03", "2024-06-04", "2024-06-05"]

# Memory cache for binary tiles to ensure sub-millisecond repeated lookups
_tile_cache: Dict[str, np.ndarray] = {}

def find_profile_json(instrument_id: str) -> Optional[Dict[str, Any]]:
    clean_id = instrument_id.replace("INCOIS_ARGO_", "").replace("INCOIS_OMNI_", "").replace("INCOIS_GLIDER_", "")
    candidate_names = [
        f"{instrument_id}.json",
        f"{clean_id}.json",
        f"INCOIS_ARGO_{clean_id}.json",
        f"INCOIS_OMNI_{clean_id}.json",
        f"INCOIS_GLIDER_{clean_id}.json"
    ]
    for p_dir in PROFILE_SEARCH_DIRS:
        if not os.path.exists(p_dir):
            continue
        for name in candidate_names:
            file_path = os.path.join(p_dir, name)
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception:
                    continue
    return None

def load_tile(variable: str, date: str, depth: float) -> Optional[np.ndarray]:
    cache_key = f"{variable}_{date}_{depth:.1f}"
    if cache_key in _tile_cache:
        return _tile_cache[cache_key]

    depth_candidates = [
        f"{depth:.1f}.bin",
        f"{int(depth)}.bin",
        f"{depth}.bin",
        "0.5.bin" if depth in (0.0, 0.5) else ""
    ]

    for t_dir in TILE_SEARCH_DIRS:
        var_date_dir = os.path.join(t_dir, variable, date)
        if not os.path.exists(var_date_dir):
            continue
        for c in depth_candidates:
            if not c:
                continue
            tile_path = os.path.join(var_date_dir, c)
            if os.path.exists(tile_path):
                try:
                    with open(tile_path, "rb") as f:
                        buf = f.read()
                    if len(buf) < 32:
                        continue
                    grid = np.frombuffer(buf[32:], dtype="<f4").reshape((HEIGHT, WIDTH)).copy()
                    _tile_cache[cache_key] = grid
                    return grid
                except Exception:
                    continue
    return None

def sample_grid(grid: np.ndarray, lat: float, lon: float) -> Optional[float]:
    """
    Spatially interpolates model grid at (lat, lon) using bilinear weighting.
    Strictly returns None if outside domain, on land, or all surrounding cells are NaN.
    """
    if lat < LAT_MIN or lat > LAT_MAX or lon < LON_MIN or lon > LON_MAX:
        return None

    r = (lat - LAT_MIN) / (LAT_MAX - LAT_MIN) * (HEIGHT - 1)
    c = (lon - LON_MIN) / (LON_MAX - LON_MIN) * (WIDTH - 1)

    r0 = int(r)
    r1 = min(HEIGHT - 1, r0 + 1)
    c0 = int(c)
    c1 = min(WIDTH - 1, c0 + 1)

    dr = r - r0
    dc = c - c0

    # 4 bilinear corner points
    corners = [
        (grid[r0, c0], (1.0 - dr) * (1.0 - dc)),
        (grid[r1, c0], dr * (1.0 - dc)),
        (grid[r0, c1], (1.0 - dr) * dc),
        (grid[r1, c1], dr * dc)
    ]

    valid = [(v, w) for v, w in corners if not np.isnan(v)]
    if not valid:
        return None

    total_weight = sum(w for _, w in valid)
    if total_weight <= 0:
        return None

    val = sum(v * w for v, w in valid) / total_weight
    if np.isnan(val):
        return None
    return float(val)

def get_model_profile(variable: str, date: str, lat: float, lon: float) -> List[Tuple[float, float]]:
    """
    Extracts vertical model sounding profile at (lat, lon) across available standard depths.
    Returns list of (depth, model_value) pairs.
    """
    profile = []
    for d in MODEL_DEPTHS:
        grid = load_tile(variable, date, d)
        if grid is not None:
            val = sample_grid(grid, lat, lon)
            if val is not None:
                profile.append((d, val))
    return profile

def compute_model_vs_obs(instrument_id: str, variable: str = "temperature", date: Optional[str] = None) -> Dict[str, Any]:
    """
    Performs collocated Model vs. Observation comparison.
    Zero synthetic mock data: returns explicit empty state if missing float, out of bounds, or on land.
    """
    prof = find_profile_json(instrument_id)
    if not prof:
        return {
            "instrument_id": instrument_id,
            "available": False,
            "reason": f"No observation profile found for instrument ID '{instrument_id}'",
            "metrics": None,
            "depth_profiles": []
        }

    lat = prof.get("latitude")
    lon = prof.get("longitude")
    if lat is None or lon is None:
        return {
            "instrument_id": instrument_id,
            "available": False,
            "reason": "Instrument metadata lacks geographic coordinates",
            "metrics": None,
            "depth_profiles": []
        }

    # Determine closest model date
    if not date:
        ts = prof.get("timestamp", "")
        if ts and len(ts) >= 10 and ts[:10] in AVAILABLE_DATES:
            date = ts[:10]
        else:
            date = "2024-06-03" # Midpoint of authentic 5-day cycle

    # Fetch collocated model vertical sounding
    model_levels = get_model_profile(variable, date, lat, lon)
    if len(model_levels) < 2:
        return {
            "instrument_id": instrument_id,
            "available": False,
            "reason": f"Model data unavailable at coordinates ({lat:.3f}°N, {lon:.3f}°E) or location is on land/outside domain.",
            "metrics": None,
            "depth_profiles": []
        }

    m_depths = np.array([m[0] for m in model_levels], dtype=float)
    m_vals = np.array([m[1] for m in model_levels], dtype=float)

    measurements = prof.get("measurements", [])
    paired = []

    for m in measurements:
        d_obs = m.get("depth")
        val_obs = m.get(variable)
        if d_obs is None or val_obs is None:
            continue
        # Interpolate within model depth range [0.5, 2000.0]
        if d_obs < m_depths[0] or d_obs > m_depths[-1]:
            continue

        val_mod = float(np.interp(d_obs, m_depths, m_vals))
        residual = val_mod - val_obs
        paired.append({
            "depth": round(float(d_obs), 1),
            "observation": round(float(val_obs), 3),
            "model": round(float(val_mod), 3),
            "residual": round(float(residual), 3)
        })

    if len(paired) == 0:
        return {
            "instrument_id": instrument_id,
            "platform_type": prof.get("platform_type", "argo"),
            "latitude": lat,
            "longitude": lon,
            "available": False,
            "reason": f"Instrument has no valid in-situ observations for variable '{variable}'.",
            "metrics": None,
            "depth_profiles": []
        }

    obs_arr = np.array([p["observation"] for p in paired], dtype=float)
    mod_arr = np.array([p["model"] for p in paired], dtype=float)
    residuals = mod_arr - obs_arr

    n = len(paired)
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    mae = float(np.mean(np.abs(residuals)))
    bias = float(np.mean(residuals))

    # Pearson r calculation with zero-variance check
    std_obs = float(np.std(obs_arr))
    std_mod = float(np.std(mod_arr))
    if std_obs > 1e-9 and std_mod > 1e-9:
        corr = float(np.corrcoef(obs_arr, mod_arr)[0, 1])
        r_squared = float(corr ** 2)
    else:
        corr = None
        r_squared = None

    units_map = {
        "temperature": "°C",
        "salinity": "PSU",
        "chlorophyll": "mg/m³",
        "oxygen": "ml/l"
    }

    return {
        "instrument_id": prof.get("instrument_id", instrument_id),
        "external_id": prof.get("external_id", instrument_id),
        "platform_type": prof.get("platform_type", "argo"),
        "wmo": prof.get("metadata", {}).get("wmo", instrument_id.replace("INCOIS_ARGO_", "")),
        "latitude": lat,
        "longitude": lon,
        "timestamp": prof.get("timestamp"),
        "variable": variable,
        "units": units_map.get(variable, ""),
        "model_date": date,
        "model_name": "INCOIS Operational Bio-ROMS Indian Ocean",
        "data_policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
        "available": True,
        "metrics": {
            "sample_count": n,
            "rmse": round(rmse, 3),
            "mae": round(mae, 3),
            "bias": round(bias, 3),
            "pearson_r": round(corr, 3) if corr is not None else None,
            "r_squared": round(r_squared, 3) if r_squared is not None else None
        },
        "provenance": {
            "observation_source": "INCOIS National Oceanographic Data Centre / GDAC NetCDF",
            "model_source": "INCOIS Operational Bio-ROMS 3.9 Hydrodynamic Model",
            "collocation_method": "Bilinear spatial interpolation + 1D piecewise linear vertical depth collocation",
            "qc_mode": "Strict UNESCO Argo QC flags (1 & 2 only)"
        },
        "depth_profiles": paired
    }

def compute_timeseries(variable: str, lat: float, lon: float, depth: float = 10.0) -> Dict[str, Any]:
    """
    Computes multi-day model timeseries across authentic dates at (lat, lon, depth).
    Returns real trend slope, start/end delta, and statistics.
    """
    timeseries_points = []
    vals = []

    for dt in AVAILABLE_DATES:
        grid = load_tile(variable, dt, depth)
        if grid is None:
            continue
        v = sample_grid(grid, lat, lon)
        if v is not None:
            timeseries_points.append({"date": dt, "value": round(v, 3)})
            vals.append(v)

    if len(vals) < 2:
        return {
            "available": False,
            "variable": variable,
            "lat": lat,
            "lon": lon,
            "depth": depth,
            "reason": "Coordinates outside model ocean domain or tile data unavailable.",
            "timeseries_points": []
        }

    start_val = vals[0]
    end_val = vals[-1]
    delta = end_val - start_val
    interval_days = len(vals) - 1
    slope_per_day = delta / max(1, interval_days)

    mean_val = float(np.mean(vals))
    std_val = float(np.std(vals))
    min_val = float(np.min(vals))
    max_val = float(np.max(vals))

    return {
        "available": True,
        "variable": variable,
        "lat": lat,
        "lon": lon,
        "depth": depth,
        "interval": f"{len(vals)} days ({AVAILABLE_DATES[0]} to {AVAILABLE_DATES[-1]})",
        "start_value": round(start_val, 3),
        "end_value": round(end_val, 3),
        "delta": round(delta, 3),
        "trend_slope_per_day": round(slope_per_day, 4),
        "mean": round(mean_val, 3),
        "std": round(std_val, 3),
        "min": round(min_val, 3),
        "max": round(max_val, 3),
        "timeseries_points": timeseries_points
    }

def compute_anomalies(variable: str, lat: float, lon: float, depth: float = 10.0, date: str = "2024-06-03") -> Dict[str, Any]:
    """
    Computes authentic Z-score anomaly at (lat, lon, depth) against the regional ocean field baseline.
    z = (x - mean) / std.
    """
    grid = load_tile(variable, date, depth)
    if grid is None:
        return {
            "available": False,
            "variable": variable,
            "reason": f"Tile data unavailable for variable '{variable}' at depth {depth}m."
        }

    point_val = sample_grid(grid, lat, lon)
    if point_val is None:
        return {
            "available": False,
            "variable": variable,
            "reason": f"Coordinates ({lat:.3f}°N, {lon:.3f}°E) are outside ocean domain or on land."
        }

    valid_cells = grid[~np.isnan(grid)]
    if len(valid_cells) == 0:
        return {
            "available": False,
            "variable": variable,
            "reason": "No valid ocean cells found in baseline domain."
        }

    mean_base = float(np.mean(valid_cells))
    std_base = float(np.std(valid_cells))

    if std_base < 1e-9:
        z_score = 0.0
    else:
        z_score = (point_val - mean_base) / std_base

    abs_z = abs(z_score)
    if abs_z < 1.0:
        classification = "Normal"
        description = "Within 1.0 standard deviation of regional ocean baseline."
    elif abs_z < 2.0:
        classification = "Moderate Anomaly"
        description = f"Statistically elevated departure ({'+' if z_score > 0 else ''}{z_score:.2f}σ from baseline mean)."
    else:
        classification = "Strong Anomaly"
        description = f"Extreme statistical departure ({'+' if z_score > 0 else ''}{z_score:.2f}σ from baseline mean)."

    units_map = {"temperature": "°C", "salinity": "PSU", "chlorophyll": "mg/m³", "currents": "m/s"}

    return {
        "available": True,
        "variable": variable,
        "units": units_map.get(variable, ""),
        "lat": lat,
        "lon": lon,
        "depth": depth,
        "date": date,
        "value": round(point_val, 3),
        "baseline_mean": round(mean_base, 3),
        "baseline_std": round(std_base, 3),
        "baseline_samples": int(len(valid_cells)),
        "z_score": round(z_score, 2),
        "classification": classification,
        "description": description
    }

def compute_correlation(lat: float, lon: float, depth: float = 10.0, date: str = "2024-06-03") -> Dict[str, Any]:
    """
    Computes NxN Pearson correlation matrix across authentic physical variables
    (temperature, salinity, currents, chlorophyll) in the local spatial neighborhood (radius ~ 100km).
    """
    variables = ["temperature", "salinity", "currents", "chlorophyll"]
    r_float = (lat - LAT_MIN) / (LAT_MAX - LAT_MIN) * (HEIGHT - 1)
    c_float = (lon - LON_MIN) / (LON_MAX - LON_MIN) * (WIDTH - 1)

    r_idx = int(round(r_float))
    c_idx = int(round(c_float))

    if r_idx < 0 or r_idx >= HEIGHT or c_idx < 0 or c_idx >= WIDTH:
        return {
            "available": False,
            "reason": "Coordinates are outside model domain."
        }

    # Extract 9x9 neighborhood
    r_start = max(0, r_idx - 4)
    r_end = min(HEIGHT, r_idx + 5)
    c_start = max(0, c_idx - 4)
    c_end = min(WIDTH, c_idx + 5)

    data_arrays = []
    loaded_vars = []

    for v in variables:
        grid = load_tile(v, date, depth)
        if grid is not None:
            sub = grid[r_start:r_end, c_start:c_end].flatten()
            data_arrays.append(sub)
            loaded_vars.append(v)

    if len(loaded_vars) < 2:
        return {
            "available": False,
            "reason": "Fewer than 2 ocean variables available at this location."
        }

    stacked = np.array(data_arrays) # shape (V, N_pixels)
    valid_mask = ~np.isnan(stacked).any(axis=0)
    stacked_valid = stacked[:, valid_mask]

    n_samples = int(stacked_valid.shape[1])
    if n_samples < 5:
        return {
            "available": False,
            "reason": f"Insufficient valid ocean cells in neighborhood (found {n_samples}, need at least 5)."
        }

    # Calculate correlation matrix
    corr_matrix = np.corrcoef(stacked_valid)

    # Format into serializable table
    matrix_list = []
    for i in range(len(loaded_vars)):
        row = []
        for j in range(len(loaded_vars)):
            val = float(corr_matrix[i, j])
            row.append(round(val, 3) if not np.isnan(val) else None)
        matrix_list.append(row)

    return {
        "available": True,
        "lat": lat,
        "lon": lon,
        "depth": depth,
        "date": date,
        "variables": loaded_vars,
        "sample_count": n_samples,
        "matrix": matrix_list
    }

def compute_vertical_profile_analysis(lat: float, lon: float, variable: str = "temperature", date: str = "2024-06-03") -> Dict[str, Any]:
    """
    Computes vertical model sounding, Mixed Layer Depth (MLD), and thermocline gradient.
    """
    levels = []
    for d in MODEL_DEPTHS:
        grid = load_tile(variable, date, d)
        if grid is not None:
            v = sample_grid(grid, lat, lon)
            if v is not None:
                levels.append({"depth": d, "value": round(v, 3)})

    if len(levels) < 3:
        return {
            "available": False,
            "variable": variable,
            "reason": f"Coordinates ({lat:.3f}°N, {lon:.3f}°E) lack sufficient depth levels or are on land.",
            "levels": []
        }

    depths = [lvl["depth"] for lvl in levels]
    vals = [lvl["value"] for lvl in levels]

    surface_val = vals[0]
    bottom_val = vals[-1]

    # Mixed Layer Depth (MLD) estimate for temperature:
    # Standard de Boyer Montégut definition: depth where T decreases by 0.2°C from reference depth (10m)
    mld = None
    ref_idx = 1 if len(vals) > 1 and depths[1] == 10.0 else 0
    ref_val = vals[ref_idx]
    delta_thresh = 0.2 if variable == "temperature" else 0.03 # 0.03 PSU for salinity

    for k in range(ref_idx + 1, len(levels)):
        if abs(vals[k] - ref_val) >= delta_thresh:
            # Interpolate depth
            d0, d1 = depths[k - 1], depths[k]
            v0, v1 = vals[k - 1], vals[k]
            if abs(v1 - v0) > 1e-6:
                mld = d0 + (ref_val - delta_thresh - v0) / (v1 - v0) * (d1 - d0) if variable == "temperature" else d0 + (d1 - d0) * 0.5
            else:
                mld = d0
            mld = max(depths[0], min(depths[-1], mld))
            break

    # Maximum Vertical Gradient (Thermocline strength)
    max_gradient = 0.0
    thermocline_depth = depths[0]
    for k in range(len(levels) - 1):
        dz = depths[k + 1] - depths[k]
        dv = abs(vals[k + 1] - vals[k])
        grad = dv / dz
        if grad > max_gradient:
            max_gradient = grad
            thermocline_depth = (depths[k] + depths[k + 1]) / 2.0

    units_map = {"temperature": "°C", "salinity": "PSU", "chlorophyll": "mg/m³", "currents": "m/s"}

    return {
        "available": True,
        "variable": variable,
        "units": units_map.get(variable, ""),
        "lat": lat,
        "lon": lon,
        "date": date,
        "levels": levels,
        "surface_value": round(surface_val, 3),
        "bottom_value": round(bottom_val, 3),
        "mld_meters": round(float(mld), 1) if mld is not None else None,
        "thermocline_depth_meters": round(float(thermocline_depth), 1),
        "max_gradient": round(float(max_gradient), 4),
        "gradient_unit": f"{units_map.get(variable, '')}/m"
    }

