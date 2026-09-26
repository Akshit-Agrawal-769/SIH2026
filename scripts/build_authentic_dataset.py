"""
Authoritative data build for the INCOIS 3D Ocean platform.

Reads ONLY authentic source files and writes every served artefact under
``frontend/public`` (static hosting) which the FastAPI data-service also reads.

Sources (all verified by file metadata, see catalog.json "sources"):
  * INCOIS Bio-ROMS (IBR) surface fields, DOI 10.5281/zenodo.13802393
      datasets/model/INCOIS-BIO-ROMS.nc  (monthly, 1980-01 .. 2019-12, surface only)
  * CMEMS ARMOR3D MULTIOBS_GLO_PHY_TSUV_3D_MYNRT_015_012 (CLS), 2024-12-31, surface
      datasets/cmems.nc                  (observation-based analysis, geostrophic u/v)
  * Argo GDAC profile files (Coriolis / FR GDAC)
      datasets/coriolis/<WMO>/profiles/S*.nc, datasets/argo/incois_<WMO>_prof.nc

Rules enforced here:
  * No synthetic values. Missing / flagged / land values stay NaN in tiles and
    null in JSON. Nothing is filled, extrapolated or invented.
  * Argo QC: only flags 1 and 2 are kept; *_ADJUSTED values are used when the
    parameter data mode is 'A' or 'D'. JULD_QC and POSITION_QC must be 1 or 2.
  * Depth from pressure: TEOS-10 gsw.z_from_p (latitude dependent).
  * Model/observation collocation is done against the native IBR grid:
    nearest IBR timestep within +/-15 days, bilinear in space, all four corners
    must be ocean (finite) or the pair is rejected.

Usage:  python scripts/build_authentic_dataset.py [--ibr-year 2019]
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import shutil
import struct
import sys
import time

import gsw
import netCDF4 as nc
import numpy as np
from scipy.interpolate import RegularGridInterpolator

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS = os.path.join(REPO, "datasets")
OUT = os.path.join(REPO, "frontend", "public")

IBR_PATH = os.path.join(DATASETS, "model", "INCOIS-BIO-ROMS.nc")
ARMOR_PATH = os.path.join(DATASETS, "cmems.nc")

# Served grid: 0.125 deg cell centres, identical to the ARMOR3D native grid subset.
GRID = {
    "width": 520,
    "height": 280,
    "lon0": 35.0625,
    "lat0": -9.9375,
    "dlon": 0.125,
    "dlat": 0.125,
    "bbox": [35.0, -10.0, 100.0, 25.0],
    "registration": "cell_center",
    "row_order": "south_to_north",
}
TGT_LONS = GRID["lon0"] + GRID["dlon"] * np.arange(GRID["width"])
TGT_LATS = GRID["lat0"] + GRID["dlat"] * np.arange(GRID["height"])

SURFACE_DEPTH = 0.0

# Argo floats shown in the application (previous release list minus fabricated
# platforms). 2902126 had no source file anywhere in datasets/ and is dropped.
ARGO_S_FILE_FLOATS = [
    "1902751", "1902757", "1902594", "4903660", "6990514", "6990700",
    "1902681", "5907086", "6990503", "3902490", "3902657",
]
ARGO_MULTIPROF_FILES = [
    os.path.join(DATASETS, "argo", "incois_2902084_prof.nc"),
    os.path.join(DATASETS, "argo", "incois_2902120_prof.nc"),
]

DATA_CENTRES = {
    "IN": "INCOIS (India)",
    "IF": "Coriolis / Ifremer (France)",
    "AO": "AOML (USA)",
    "BO": "BODC (UK)",
    "CS": "CSIRO (Australia)",
    "HZ": "CSIO (China)",
    "JA": "JMA (Japan)",
    "ME": "MEDS (Canada)",
    "KO": "KORDI (Korea)",
}

GOOD_QC = (b"1", b"2")
MATCHUP_MAX_DT_DAYS = 15.0
MATCHUP_MAX_DEPTH_M = 10.0
MAX_CORE_LEVELS = 200
MAX_BGC_LEVELS = 150

JULD_EPOCH = dt.datetime(1950, 1, 1, tzinfo=dt.timezone.utc)


# --------------------------------------------------------------------------- utils

def log(msg):
    print(msg, flush=True)


def rel(path):
    return os.path.relpath(path, REPO).replace("\\", "/")


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        # allow_nan=False guarantees browser-parseable JSON (no NaN tokens).
        json.dump(obj, f, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def clean_dir(path):
    if os.path.isdir(path):
        shutil.rmtree(path)
    os.makedirs(path, exist_ok=True)


def finite_or_none(x, ndigits):
    if x is None:
        return None
    x = float(x)
    if not np.isfinite(x):
        return None
    return round(x, ndigits)


def chars(arr):
    """Decode a netCDF char array (possibly masked) to a stripped str."""
    a = np.ma.filled(arr, b" ")
    return b"".join(a.tolist()).decode("utf-8", "ignore").strip()


def qc_bytes(arr):
    return np.ma.filled(arr, b" ").astype("S1")


def depth_key(depth):
    return f"{float(depth):.1f}"


# --------------------------------------------------------------------------- tiles

# Codes 1-5 are the original served fields; 6+ are derived hazard layers (catalog["derived"]).
# Mirrored in frontend/src/api/client.ts VAR_CODES. Never renumber existing codes.
VAR_CODES = {"temperature": 1, "salinity": 2, "currents": 3, "chlorophyll": 4, "mld": 5,
             "mhw_intensity": 6, "current_u": 7, "current_v": 8, "vorticity": 9, "eddy_convergence": 10,
             "chl_bloom": 11, "mhw_detrended": 12, "mhw_daily": 13, "dhw": 14, "tchp": 15, "gpi": 16,
             "eddy_convergence_nrt": 17}


def pack_tile(var_code, data):
    data = np.asarray(data, dtype="<f4")
    assert data.shape == (GRID["height"], GRID["width"])
    valid = data[np.isfinite(data)]
    vmin, vmax = (float(valid.min()), float(valid.max())) if valid.size else (float("nan"), float("nan"))
    header = struct.pack(
        "<4sHHHHHHff8s", b"INCO", 1, var_code, GRID["width"], GRID["height"], 1, 1, vmin, vmax, b"\x00" * 8
    )
    return header + data.tobytes()


def write_tile(variable, date_str, data):
    path = os.path.join(OUT, "tiles", variable, date_str, f"{depth_key(SURFACE_DEPTH)}.bin")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(pack_tile(VAR_CODES[variable], data))
    return path


def ibr_regridder(ds):
    lat = np.ma.filled(ds["LAT"][:].astype(float), np.nan)
    lon = np.ma.filled(ds["LON"][:].astype(float), np.nan)
    j0 = max(0, int(np.searchsorted(lat, TGT_LATS[0])) - 2)
    j1 = min(len(lat), int(np.searchsorted(lat, TGT_LATS[-1])) + 2)
    i0 = max(0, int(np.searchsorted(lon, TGT_LONS[0])) - 2)
    i1 = min(len(lon), int(np.searchsorted(lon, TGT_LONS[-1])) + 2)
    sub_lat, sub_lon = lat[j0:j1], lon[i0:i1]
    glat, glon = np.meshgrid(TGT_LATS, TGT_LONS, indexing="ij")

    def regrid(field2d):
        interp = RegularGridInterpolator((sub_lat, sub_lon), field2d[j0:j1, i0:i1], method="linear",
                                         bounds_error=False, fill_value=np.nan)
        return interp((glat, glon)).astype(np.float32)

    return regrid


def build_model_tiles(ibr_year):
    catalog_vars = {}
    ranges = {}

    # ---- INCOIS Bio-ROMS (IBR): temperature, salinity, chlorophyll, MLD
    ds = nc.Dataset(IBR_PATH)
    t = ds["TIME"]
    times = nc.num2date(t[:], t.units, t.calendar)
    idx = [k for k, x in enumerate(times) if x.year == ibr_year]
    if not idx:
        raise SystemExit(f"No IBR timesteps in year {ibr_year}")
    regrid = ibr_regridder(ds)
    ibr_vars = {
        "temperature": ("SST", 1.0, "°C", "Sea surface temperature", "sea_surface_temperature"),
        "salinity": ("SSS", 1.0, "PSU", "Sea surface salinity", "sea_surface_salinity"),
        "chlorophyll": ("CHL", 1.0e6, "mg/m³", "Sea surface chlorophyll-a",
                        "mass_concentration_of_chlorophyll_a_in_sea_water"),
        "mld": ("MLD", 1.0, "m", "Mixed layer depth (IBR model diagnostic)", "ocean_mixed_layer_thickness"),
    }
    for var, (src, scale, units, long_name, std_name) in ibr_vars.items():
        dates, all_vals = [], []
        for k in idx:
            field = np.ma.filled(ds[src][k, :, :].astype(float), np.nan) * scale
            tile = regrid(field)
            date_str = times[k].strftime("%Y-%m-%d")
            write_tile(var, date_str, tile)
            dates.append(date_str)
            all_vals.append(tile[np.isfinite(tile)])
        vals = np.concatenate(all_vals)
        ranges[var] = vals
        catalog_vars[var] = {
            "var_code": VAR_CODES[var],
            "units": units,
            "long_name": long_name,
            "standard_name": std_name,
            "source_id": "ibr",
            "source_variable": src,
            "unit_conversion": "kg m-3 -> mg m-3 (x1e6)" if scale != 1.0 else None,
            "depths": [SURFACE_DEPTH],
            "vertical_coverage": "surface only",
            "timesteps": dates,
        }
        log(f"[IBR] {var}: {len(dates)} monthly tiles {dates[0]}..{dates[-1]}")
    ibr_meta = {
        "title": "INCOIS Bio-ROMS (IBR) Indian Ocean surface fields",
        "type": "numerical_model",
        "institution": ds.getncattr("institute"),
        "producers": ds.getncattr("producers"),
        "doi": ds.getncattr("doi"),
        "doi_url": f"https://doi.org/{ds.getncattr('doi')}",
        "file": rel(IBR_PATH),
        "native_grid": f"{ds.dimensions['LON'].size} x {ds.dimensions['LAT'].size} (1/12 deg lon), 30-120E, 30S-30N",
        "time_coverage": [times[0].strftime("%Y-%m-%d"), times[-1].strftime("%Y-%m-%d")],
        "time_resolution": "monthly (timestamps exactly as stored in source TIME variable)",
        "vertical_levels": "surface only (no subsurface levels in source)",
        "exported_window": f"{ibr_year} ({len(idx)} timesteps)",
        "regridding": "bilinear from native grid to 0.125 deg cell centres; any NaN corner yields NaN (no extrapolation)",
    }
    ds.close()

    # ---- CMEMS ARMOR3D: surface geostrophic currents (speed tile + u/v vectors)
    ds = nc.Dataset(ARMOR_PATH)
    lat = ds["latitude"][:].astype(float)
    lon = ds["longitude"][:].astype(float)
    la = np.where((lat > GRID["bbox"][1]) & (lat < GRID["bbox"][3]))[0]
    lo = np.where((lon > GRID["bbox"][0]) & (lon < GRID["bbox"][2]))[0]
    assert len(la) == GRID["height"] and len(lo) == GRID["width"], "ARMOR3D subset does not match served grid"
    assert abs(lat[la[0]] - GRID["lat0"]) < 1e-6 and abs(lon[lo[0]] - GRID["lon0"]) < 1e-6
    u = np.ma.filled(ds["ugo"][0, 0][la][:, lo].astype(float), np.nan)
    v = np.ma.filled(ds["vgo"][0, 0][la][:, lo].astype(float), np.nan)
    tt = ds["time"]
    armor_date = nc.num2date(tt[0], tt.units, getattr(tt, "calendar", "standard")).strftime("%Y-%m-%d")
    speed = np.sqrt(u ** 2 + v ** 2)  # NaN wherever u or v is NaN
    write_tile("currents", armor_date, speed.astype(np.float32))
    ranges["currents"] = speed[np.isfinite(speed)]
    catalog_vars["currents"] = {
        "var_code": VAR_CODES["currents"],
        "units": "m/s",
        "long_name": "Surface geostrophic current speed",
        "standard_name": "sea_water_speed",
        "source_id": "armor3d",
        "source_variable": "sqrt(ugo^2 + vgo^2)",
        "unit_conversion": None,
        "depths": [SURFACE_DEPTH],
        "vertical_coverage": "surface only",
        "timesteps": [armor_date],
        "vectors": "data/currents_uv.json",
    }
    stride = 8  # 1 degree vector spacing, sampled (not averaged) from the native grid
    sub_u, sub_v = u[::stride, ::stride], v[::stride, ::stride]
    to_list = lambda a: [[finite_or_none(x, 3) for x in row] for row in a]
    write_json(os.path.join(OUT, "data", "currents_uv.json"), {
        "source_id": "armor3d",
        "variables": "ugo (eastward), vgo (northward) geostrophic surface velocity",
        "units": "m/s",
        "date": armor_date,
        "depth": SURFACE_DEPTH,
        "stride_cells": stride,
        "lats": [round(float(x), 4) for x in TGT_LATS[::stride]],
        "lons": [round(float(x), 4) for x in TGT_LONS[::stride]],
        "u": to_list(sub_u),
        "v": to_list(sub_v),
        "missing": "null = no data (land, or undefined in source); never zero-filled",
    })
    armor_meta = {
        "title": ds.getncattr("title"),
        "type": "observation_based_analysis",
        "institution": ds.getncattr("institution"),
        "product_id": ds.getncattr("subset:productId"),
        "dataset_id": ds.getncattr("subset:datasetId"),
        "provider": "Copernicus Marine Service (CMEMS)",
        "file": rel(ARMOR_PATH),
        "time_coverage": [armor_date, armor_date],
        "vertical_levels": "surface (depth 0 m) only in local subset",
        "note": "Observation-based analysis (assimilates in-situ profiles incl. Argo); not a numerical model. "
                "Velocities are geostrophic (thermal wind), not total currents.",
        "regridding": "none (native 0.125 deg grid subset)",
    }
    ds.close()

    for var, vals in ranges.items():
        catalog_vars[var]["value_range"] = [round(float(vals.min()), 4), round(float(vals.max()), 4)]
        catalog_vars[var]["display_range"] = [round(float(np.percentile(vals, 2)), 4),
                                              round(float(np.percentile(vals, 98)), 4)]
    return catalog_vars, {"ibr": ibr_meta, "armor3d": armor_meta}


# --------------------------------------------------------------------------- Argo

def param_modes(ds, prof):
    """Map parameter name -> data mode ('R','A','D') for one profile."""
    params = [chars(p) for p in ds["STATION_PARAMETERS"][prof]]
    if "PARAMETER_DATA_MODE" in ds.variables:
        pdm = np.ma.filled(ds["PARAMETER_DATA_MODE"][prof], b" ")
        modes = [m.decode() if isinstance(m, bytes) else str(m) for m in pdm.tolist()]
    else:
        m = chars(ds["DATA_MODE"][prof:prof + 1])
        modes = [m] * len(params)
    return {p: modes[i].strip() or "R" for i, p in enumerate(params) if p}


def param_values(ds, prof, name, mode):
    """Return (values, good_mask, used_field) applying Argo QC flags 1/2."""
    use_adj = mode in ("A", "D") and f"{name}_ADJUSTED" in ds.variables
    field = f"{name}_ADJUSTED" if use_adj else name
    if field not in ds.variables:
        return None, None, None
    vals = np.ma.filled(ds[field][prof].astype(float), np.nan)
    qc = qc_bytes(ds[f"{field}_QC"][prof])
    good = np.isfinite(vals) & np.isin(qc, GOOD_QC)
    return vals, good, field


def profile_header(ds, prof):
    juld = ds["JULD"][prof]
    lat = ds["LATITUDE"][prof]
    lon = ds["LONGITUDE"][prof]
    if np.ma.is_masked(juld) or np.ma.is_masked(lat) or np.ma.is_masked(lon):
        return None
    jqc = qc_bytes(ds["JULD_QC"][prof:prof + 1])[0]
    pqc = qc_bytes(ds["POSITION_QC"][prof:prof + 1])[0]
    if jqc not in GOOD_QC or pqc not in GOOD_QC:
        return None
    lat, lon, juld = float(lat), float(lon), float(juld)
    if not (np.isfinite(lat) and np.isfinite(lon) and np.isfinite(juld)):
        return None
    direction = chars(ds["DIRECTION"][prof:prof + 1]) if "DIRECTION" in ds.variables else "A"
    return {
        "time": JULD_EPOCH + dt.timedelta(days=juld),
        "lat": lat,
        "lon": lon,
        "cycle": int(ds["CYCLE_NUMBER"][prof]),
        "direction": direction or "A",
    }


def stride_pick(indices, max_n):
    indices = np.asarray(indices)
    if len(indices) <= max_n:
        return indices
    step = int(np.ceil(len(indices) / max_n))
    picked = indices[::step]
    if picked[-1] != indices[-1]:
        picked = np.append(picked, indices[-1])  # keep deepest real level
    return picked


def extract_profile(ds, prof, hdr):
    modes = param_modes(ds, prof)
    pres, pres_good, pres_field = param_values(ds, prof, "PRES", modes.get("PRES", "R"))
    if pres is None:
        return None
    fields = {}
    used = {"PRES": pres_field}
    for name in ("TEMP", "PSAL", "DOXY", "CHLA"):
        if name in modes or f"{name}" in ds.variables:
            vals, good, fld = param_values(ds, prof, name, modes.get(name, "R"))
            if vals is not None:
                fields[name] = (vals, good & pres_good)
                used[name] = fld
    if "TEMP" not in fields:
        return None
    core_idx = np.where(fields["TEMP"][1] | fields.get("PSAL", (None, np.zeros_like(pres_good)))[1])[0]
    keep = set(stride_pick(core_idx, MAX_CORE_LEVELS).tolist()) if len(core_idx) else set()
    for name in ("DOXY", "CHLA"):
        if name in fields:
            bidx = np.where(fields[name][1])[0]
            keep |= set(stride_pick(bidx, MAX_BGC_LEVELS).tolist()) if len(bidx) else set()
    levels = sorted(keep, key=lambda i: pres[i])
    lat = hdr["lat"]
    out = []
    for i in levels:
        p = float(pres[i])
        depth = float(-gsw.z_from_p(p, lat))

        def val(name, nd):
            if name not in fields:
                return None
            v, g = fields[name]
            return round(float(v[i]), nd) if g[i] else None

        m = {
            "pressure": round(p, 2),
            "depth": round(depth, 2),
            "temperature": val("TEMP", 4),
            "salinity": val("PSAL", 4),
            "oxygen": val("DOXY", 2),
            "chlorophyll": val("CHLA", 4),
        }
        if any(m[k] is not None for k in ("temperature", "salinity", "oxygen", "chlorophyll")):
            out.append(m)
    n_total = int(np.sum(pres_good))
    return {
        "measurements": out,
        "levels_good_pressure": n_total,
        "levels_served": len(out),
        "parameter_modes": {k: modes.get(k) for k in used},
        "fields_used": used,
    }


def float_metadata(ds, prof, wmo, source_file):
    dc = chars(ds["DATA_CENTRE"][prof]) if "DATA_CENTRE" in ds.variables else ""
    return {
        "wmo": wmo,
        "data_centre": dc,
        "institution": DATA_CENTRES.get(dc, dc or "unknown"),
        "project_name": chars(ds["PROJECT_NAME"][prof]) if "PROJECT_NAME" in ds.variables else None,
        "pi_name": chars(ds["PI_NAME"][prof]) if "PI_NAME" in ds.variables else None,
        "float_platform_type": chars(ds["PLATFORM_TYPE"][prof]) if "PLATFORM_TYPE" in ds.variables else None,
        "source_file": rel(source_file),
    }


def iter_profiles_multiprof(path):
    ds = nc.Dataset(path)
    ds.set_auto_mask(True)
    for prof in range(ds.dimensions["N_PROF"].size):
        hdr = profile_header(ds, prof)
        if hdr is None:
            continue
        yield ds, prof, hdr, path
    ds.close()


def iter_profiles_sfiles(wmo):
    files = sorted(glob.glob(os.path.join(DATASETS, "*", wmo, "profiles", "S*.nc")))
    for path in files:
        try:
            ds = nc.Dataset(path)
        except OSError:
            continue
        ds.set_auto_mask(True)
        for prof in range(ds.dimensions["N_PROF"].size):
            hdr = profile_header(ds, prof)
            if hdr is None:
                continue
            yield ds, prof, hdr, path
        ds.close()


class IBRCollocator:
    """Point collocation against the native IBR grid (no regridding)."""

    def __init__(self, path):
        self.ds = nc.Dataset(path)
        t = self.ds["TIME"]
        self.times = nc.num2date(t[:], t.units, t.calendar)
        self.tsec = np.array([dt.datetime(x.year, x.month, x.day, tzinfo=dt.timezone.utc).timestamp()
                              for x in self.times])
        self.lat = np.ma.filled(self.ds["LAT"][:].astype(float), np.nan)
        self.lon = np.ma.filled(self.ds["LON"][:].astype(float), np.nan)
        for v in ("SST", "SSS"):
            self.ds[v].set_var_chunk_cache(size=256 * 1024 * 1024)
        self.coverage = (self.times[0].strftime("%Y-%m-%d"), self.times[-1].strftime("%Y-%m-%d"))

    def nearest_time(self, when):
        s = when.timestamp()
        k = int(np.argmin(np.abs(self.tsec - s)))
        return k, abs(self.tsec[k] - s) / 86400.0

    def sample(self, var, k, lat, lon):
        if not (self.lat[0] <= lat <= self.lat[-1] and self.lon[0] <= lon <= self.lon[-1]):
            return None
        j = int(np.searchsorted(self.lat, lat)) - 1
        i = int(np.searchsorted(self.lon, lon)) - 1
        j, i = max(0, min(j, len(self.lat) - 2)), max(0, min(i, len(self.lon) - 2))
        block = np.ma.filled(self.ds[var][k, j:j + 2, i:i + 2].astype(float), np.nan)
        if not np.all(np.isfinite(block)):
            return None
        wy = (lat - self.lat[j]) / (self.lat[j + 1] - self.lat[j])
        wx = (lon - self.lon[i]) / (self.lon[i + 1] - self.lon[i])
        top = block[0, 0] * (1 - wx) + block[0, 1] * wx
        bot = block[1, 0] * (1 - wx) + block[1, 1] * wx
        return float(top * (1 - wy) + bot * wy)

    def close(self):
        self.ds.close()


def matchup_record(ds, prof, hdr, collocator):
    """Near-surface observation vs IBR surface model at the profile position/time."""
    modes = param_modes(ds, prof)
    pres, pres_good, _ = param_values(ds, prof, "PRES", modes.get("PRES", "R"))
    temp, temp_good, _ = param_values(ds, prof, "TEMP", modes.get("TEMP", "R"))
    psal, psal_good, _ = param_values(ds, prof, "PSAL", modes.get("PSAL", "R"))
    if pres is None or temp is None:
        return None
    depth = -gsw.z_from_p(np.where(np.isfinite(pres), pres, 0.0), hdr["lat"])
    rec = {
        "cycle": hdr["cycle"],
        "time": hdr["time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latitude": round(hdr["lat"], 4),
        "longitude": round(hdr["lon"], 4),
    }
    for var, vals, good in (("temperature", temp, temp_good), ("salinity", psal, psal_good)):
        if vals is None:
            rec[var] = None
            continue
        ok = np.where(good & pres_good & (depth <= MATCHUP_MAX_DEPTH_M))[0]
        if len(ok) == 0:
            rec[var] = None
            continue
        s = ok[np.argmin(depth[ok])]  # shallowest good level
        rec[var] = {"obs": round(float(vals[s]), 4), "obs_depth": round(float(depth[s]), 2),
                    "obs_pressure": round(float(pres[s]), 2)}
    k, dtd = collocator.nearest_time(hdr["time"])
    rec["model_time"] = collocator.times[k].strftime("%Y-%m-%d")
    rec["model_dt_days"] = round(dtd, 2)
    if dtd > MATCHUP_MAX_DT_DAYS:
        rec["status"] = "outside_model_time_coverage"
        return rec
    for var, src in (("temperature", "SST"), ("salinity", "SSS")):
        if rec.get(var) is not None:
            m = collocator.sample(src, k, hdr["lat"], hdr["lon"])
            rec[var]["model"] = round(m, 4) if m is not None else None
    rec["status"] = "collocated"
    return rec


def build_argo(collocator):
    features = []
    prof_dir = os.path.join(OUT, "api", "profiles")
    mu_dir = os.path.join(OUT, "api", "matchups")
    clean_dir(prof_dir)
    clean_dir(mu_dir)

    sources = [(w, lambda w=w: iter_profiles_sfiles(w)) for w in ARGO_S_FILE_FLOATS]
    for path in ARGO_MULTIPROF_FILES:
        wmo = re.search(r"(\d{7})", os.path.basename(path)).group(1)
        sources.append((wmo, lambda p=path: iter_profiles_multiprof(p)))

    for wmo, it in sources:
        ext_id = f"ARGO_{wmo}"
        latest = None
        n_profiles = 0
        matchups = []
        for ds, prof, hdr, path in it():
            if hdr["direction"] != "A":
                continue  # ascending profiles are the primary Argo product
            n_profiles += 1
            if latest is None or hdr["time"] > latest["hdr"]["time"]:
                extracted = extract_profile(ds, prof, hdr)
                if extracted and extracted["measurements"]:
                    latest = {"hdr": hdr, "profile": extracted, "meta": float_metadata(ds, prof, wmo, path)}
            rec = matchup_record(ds, prof, hdr, collocator)
            if rec is not None:
                matchups.append(rec)
        if latest is None:
            log(f"[Argo] {wmo}: no QC-acceptable ascending profile found; skipped")
            continue
        hdr, extracted, meta = latest["hdr"], latest["profile"], latest["meta"]
        ms = extracted["measurements"]
        has_oxy = any(m["oxygen"] is not None for m in ms)
        has_chl = any(m["chlorophyll"] is not None for m in ms)
        ts = hdr["time"].strftime("%Y-%m-%dT%H:%M:%SZ")
        meta.update({
            "latest_cycle": hdr["cycle"],
            "profile_count_local": n_profiles,
            "parameter_modes": extracted["parameter_modes"],
            "fields_used": extracted["fields_used"],
            "has_oxygen": has_oxy,
            "has_chlorophyll": has_chl,
            "qc_policy": "Argo QC flags 1 (good) and 2 (probably good) only; *_ADJUSTED used for A/D modes; "
                         "JULD_QC and POSITION_QC must be 1 or 2",
            "depth_method": "TEOS-10 gsw.z_from_p(pressure, latitude)",
            "levels_good_pressure": extracted["levels_good_pressure"],
            "levels_served": extracted["levels_served"],
            "units": {"temperature": "°C (ITS-90)", "salinity": "PSU (PSS-78)", "oxygen": "µmol/kg",
                      "chlorophyll": "mg/m³", "pressure": "dbar", "depth": "m (positive down)"},
        })
        profile = {
            "instrument_id": ext_id,
            "external_id": ext_id,
            "platform_type": "argo",
            "profile_id": f"{ext_id}_cycle_{hdr['cycle']:03d}",
            "cycle_number": hdr["cycle"],
            "timestamp": ts,
            "latitude": round(hdr["lat"], 4),
            "longitude": round(hdr["lon"], 4),
            "metadata": meta,
            "measurements": ms,
        }
        write_json(os.path.join(prof_dir, f"{ext_id}.json"), profile)
        collocated = [m for m in matchups if m.get("status") == "collocated"]
        write_json(os.path.join(mu_dir, f"{ext_id}.json"), {
            "instrument_id": ext_id,
            "wmo": wmo,
            "model_source_id": "ibr",
            "model_time_coverage": list(collocator.coverage),
            "method": {
                "observation": f"shallowest QC-good level with depth <= {MATCHUP_MAX_DEPTH_M} m of each ascending profile",
                "temporal": f"nearest IBR timestep, |dt| <= {MATCHUP_MAX_DT_DAYS} days",
                "spatial": "bilinear on native IBR grid; all four corners must be ocean",
                "vertical": "IBR provides surface fields only; no vertical interpolation performed",
            },
            "profiles_considered": len(matchups),
            "profiles_collocated": len(collocated),
            "records": matchups,
        })
        features.append({
            "type": "Feature",
            "id": ext_id,
            "geometry": {"type": "Point", "coordinates": [round(hdr["lon"], 4), round(hdr["lat"], 4)]},
            "properties": {
                "id": ext_id,
                "external_id": ext_id,
                "platform_type": "argo",
                "last_report": ts,
                "metadata": {k: meta[k] for k in ("wmo", "data_centre", "institution", "project_name", "pi_name",
                                                  "latest_cycle", "profile_count_local", "has_oxygen",
                                                  "has_chlorophyll", "qc_policy")},
            },
        })
        log(f"[Argo] {wmo}: latest cycle {hdr['cycle']} @ {ts} ({extracted['levels_served']} levels), "
            f"{n_profiles} ascending profiles, {len(collocated)} collocated with IBR")

    write_json(os.path.join(OUT, "api", "instruments.json"), {"type": "FeatureCollection", "features": features})
    return [f["id"] for f in features]


# --------------------------------------------------------------------------- hazard layers
#
# Derived artefacts for the Disaster Early Warning panel. The science lives in
# data-service/app/analytics_engine.py (mhw_intensity, relative_vorticity,
# eddy_convergence_indicator) so the service and this build share one implementation.

# 30-year baseline. 1990-2019 is the latest 30 years of the IBR record (1980-2019); Hobday et al. (2016)
# recommend a 30-year period. A 1982-2011 baseline let the long-term warming trend itself count as
# "heatwave" (43-67 % of the ocean flagged in every 2019 month), so the fixed baseline moved to the most
# recent 30 years and a detrended variant (Jacox et al. 2020 style shifting baseline) is built alongside.
MHW_BASELINE = (1990, 2019)
CHL_BASELINE = (1990, 2019)
CHL_FLOOR_MG_M3 = 1.0e-3  # log10 needs a positive value


def _engine():
    sys.path.insert(0, os.path.join(REPO, "data-service"))
    os.environ.setdefault("IBR_LIVE_TILES", "0")
    from app import analytics_engine as ae  # noqa: E402
    ae.set_data_root(OUT)
    return ae


class IBRSST:
    """Monthly IBR surface fields on the native grid: local netCDF4 file, else the data-service HF reader."""

    def __init__(self, names=("SST",)):
        self.names = tuple(names)
        if os.path.exists(IBR_PATH):
            self.ds = nc.Dataset(IBR_PATH)
            t = self.ds["TIME"]
            self.times = nc.num2date(t[:], t.units, t.calendar)
            self.lat = np.ma.filled(self.ds["LAT"][:].astype(float), np.nan)
            self.lon = np.ma.filled(self.ds["LON"][:].astype(float), np.nan)
            self.source = rel(IBR_PATH)
            self._read = lambda name, k0, k1: np.ma.filled(self.ds[name][k0:k1, :, :].astype(np.float32), np.nan)
        else:
            sys.path.insert(0, os.path.join(REPO, "data-service"))
            from app import model_store as ms  # noqa: E402
            fn = os.path.basename(IBR_PATH)
            log(f"[MHW] {rel(IBR_PATH)} not found locally; reading {', '.join(self.names)} from Hugging Face "
                f"{ms.HF_REPO} (~1 GB per variable over 480 months; first run also builds the chunk index)")
            r = ms.open_reader(fn)
            dec = lambda name: ms.decode(np.asarray(r.read(name, (slice(None),))), r.variables[name].attrs)
            tv = r.variables["TIME"]
            self.times = nc.num2date(dec("TIME").astype(float), tv.attrs["units"], tv.attrs.get("calendar", "standard"))
            self.lat, self.lon = dec("LAT").astype(float), dec("LON").astype(float)
            self.source = f"huggingface:{ms.HF_REPO}/{fn}"
            self._read = lambda name, k0, k1: ms.decode(ms.read_array(fn, name, (slice(k0, k1),))[0],
                                                        r.variables[name].attrs).astype(np.float32)
            self.ds = None

    def months(self, batch=80):
        """Yield (index, cftime date, {name: native field}) for every timestep (batch = file chunk length)."""
        t0 = time.time()
        for k0 in range(0, len(self.times), batch):
            k1 = min(len(self.times), k0 + batch)
            blocks = {name: self._read(name, k0, k1) for name in self.names}
            log(f"[MHW] {'/'.join(self.names)} {self.times[k0].strftime('%Y-%m')}..{self.times[k1 - 1].strftime('%Y-%m')} "
                f"({k1}/{len(self.times)}, {time.time() - t0:.0f}s)")
            for i in range(k1 - k0):
                yield k0 + i, self.times[k0 + i], {name: blocks[name][i] for name in self.names}

    def close(self):
        if self.ds is not None:
            self.ds.close()


def _regridder_for(lat, lon):
    j0 = max(0, int(np.searchsorted(lat, TGT_LATS[0])) - 2)
    j1 = min(len(lat), int(np.searchsorted(lat, TGT_LATS[-1])) + 2)
    i0 = max(0, int(np.searchsorted(lon, TGT_LONS[0])) - 2)
    i1 = min(len(lon), int(np.searchsorted(lon, TGT_LONS[-1])) + 2)
    glat, glon = np.meshgrid(TGT_LATS, TGT_LONS, indexing="ij")

    def regrid(field2d):  # identical method to ibr_regridder(): bilinear, any NaN corner -> NaN
        interp = RegularGridInterpolator((lat[j0:j1], lon[i0:i1]), field2d[j0:j1, i0:i1], method="linear",
                                         bounds_error=False, fill_value=np.nan)
        return interp((glat, glon)).astype(np.float32)

    return regrid


def _monthly_stats(stack, years, baseline):
    """Per-cell, per-calendar-month mean and 90th percentile over ``baseline`` of a (12, Y, H, W) stack.
    A cell's statistic is NaN unless every baseline year is finite there (no partial-record statistics)."""
    import warnings
    y0, y1 = baseline
    sel = [i for i, y in enumerate(years) if y0 <= y <= y1]
    base = stack[:, sel]
    count = np.isfinite(base).sum(axis=1).astype(np.int16)
    complete = count == len(sel)
    with warnings.catch_warnings(), np.errstate(all="ignore"):
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN (land) cells; masked just below
        clim = np.nanmean(base, axis=1).astype(np.float32)
        p90 = np.nanpercentile(base, 90, axis=1).astype(np.float32)
    clim[~complete] = np.nan
    p90[~complete] = np.nan
    return clim, p90, count


def _decimal_years(years):
    return np.asarray(years, dtype=np.float32)[None, :, None, None] + (np.arange(12)[:, None, None, None] + 0.5) / 12


def _linear_trend(stack, years):
    """Per-cell least-squares trend (units per year) of the deseasonalised monthly series (12, Y, H, W).
    NaN unless every month of the record is finite at that cell (no partial-record statistics)."""
    import warnings
    with warnings.catch_warnings(), np.errstate(all="ignore"):
        warnings.simplefilter("ignore", RuntimeWarning)
        complete = np.isfinite(stack).all(axis=(0, 1))
        t = _decimal_years(years)[:, :, 0, 0].astype(np.float64)       # (12, Y)
        tc = (t - t.mean()).astype(np.float32)
        slope = np.zeros(stack.shape[2:], dtype=np.float64)
        for m in range(12):  # month by month keeps the temporaries small
            anom = stack[m] - np.nanmean(stack[m], axis=0, keepdims=True)  # (Y, H, W)
            slope += np.tensordot(tc[m], np.nan_to_num(anom), axes=(0, 0))
        slope /= float((tc.astype(np.float64) ** 2).sum())
    slope = slope.astype(np.float32)
    slope[~complete] = np.nan
    return slope


def build_ibr_climatologies(ibr_year):
    """
    One pass over the IBR record building:
      * sst_climatology.npz - fixed-baseline (MHW_BASELINE) monthly SST mean / p90, plus the detrended
        variant: per-cell linear trend removed relative to the baseline midpoint, then mean / p90;
      * chl_climatology.npz - monthly log10(CHL) mean / p90 over CHL_BASELINE (bloom anomaly index).
    Returns ({date: {"sst": tile, "chl": tile}} for the display year, metadata).
    """
    src = IBRSST(("SST", "CHL"))
    regrid = _regridder_for(src.lat, src.lon)
    years = sorted({t.year for t in src.times})
    sst = np.full((12, len(years), GRID["height"], GRID["width"]), np.nan, dtype=np.float32)
    chl = np.full_like(sst, np.nan)
    seen = set()
    display = {}
    for k, t, fields in src.months():
        key = (t.year, t.month)
        if key in seen:
            raise SystemExit(f"IBR has two timesteps in {t.year}-{t.month:02d}; monthly climatology is ambiguous.")
        seen.add(key)
        s_tile = regrid(fields["SST"])
        c_mg = regrid(fields["CHL"] * 1.0e6)  # kg/m3 -> mg/m3, as served
        with np.errstate(all="ignore"):
            c_tile = np.log10(np.maximum(c_mg, CHL_FLOOR_MG_M3)).astype(np.float32)
        c_tile[~np.isfinite(c_mg)] = np.nan
        yi = years.index(t.year)
        sst[t.month - 1, yi] = s_tile
        chl[t.month - 1, yi] = c_tile
        if t.year == ibr_year:
            display[t.strftime("%Y-%m-%d")] = {"sst": s_tile, "chl": c_tile}
    src_name = src.source
    src.close()
    for (y0, y1), what in ((MHW_BASELINE, "SST"), (CHL_BASELINE, "CHL")):
        missing = [(m + 1, y) for m in range(12) for y in range(y0, y1 + 1) if (y, m + 1) not in seen]
        if missing:
            raise SystemExit(f"{what} baseline months missing from IBR: {missing[:6]}")

    clim, p90, count = _monthly_stats(sst, years, MHW_BASELINE)
    slope = _linear_trend(sst, years)
    t_ref = 0.5 * (MHW_BASELINE[0] + MHW_BASELINE[1] + 1)  # baseline midpoint (decimal year)
    sst -= slope[None, None] * (_decimal_years(years) - t_ref)  # in place: detrended from here on
    clim_d, p90_d, _ = _monthly_stats(sst, years, MHW_BASELINE)
    path = os.path.join(OUT, "data", "sst_climatology.npz")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    np.savez_compressed(path, clim=clim, p90=p90, count=count, baseline=np.array(MHW_BASELINE, dtype=np.int16),
                        clim_detrended=clim_d, p90_detrended=p90_d, trend_per_year=slope,
                        trend_ref_year=np.array([t_ref], dtype=np.float32))
    trend_dec = float(np.nanmedian(slope) * 10)
    log(f"[MHW] SST climatology {MHW_BASELINE} (+ detrended) -> {rel(path)}; median trend {trend_dec:.3f} degC/decade")

    cclim, cp90, ccount = _monthly_stats(chl, years, CHL_BASELINE)
    cpath = os.path.join(OUT, "data", "chl_climatology.npz")
    np.savez_compressed(cpath, clim=cclim, p90=cp90, count=ccount, baseline=np.array(CHL_BASELINE, dtype=np.int16),
                        floor_mg_m3=np.array([CHL_FLOOR_MG_M3], dtype=np.float32))
    log(f"[CHL] log10(CHL) climatology {CHL_BASELINE} -> {rel(cpath)}")
    del sst, chl
    meta = {
        "sst": {"file": rel(path), "baseline": list(MHW_BASELINE), "source": src_name,
                "percentile_method": "numpy nanpercentile (linear interpolation) over the 30 baseline years",
                "window": "calendar month (no day-of-year smoothing; monthly data)",
                "detrended": {"method": "per-cell least-squares linear trend of the deseasonalised "
                                        f"{years[0]}-{years[-1]} monthly SST removed relative to the baseline "
                                        f"midpoint {t_ref:.1f}; mean and p90 then recomputed over the baseline",
                              "reference": "Jacox et al. (2020), Nature 584, 82-86 (shifting baseline)",
                              "median_trend_degC_per_decade": round(trend_dec, 4)}},
        "chl": {"file": rel(cpath), "baseline": list(CHL_BASELINE), "source": src_name,
                "transform": f"log10(max(CHL mg/m3, {CHL_FLOOR_MG_M3}))",
                "percentile_method": "numpy nanpercentile (linear interpolation) over the 30 baseline years"},
    }
    return display, meta


def build_armor_derived():
    """Full-resolution ARMOR3D geostrophic u, v and relative vorticity tiles."""
    ae = _engine()
    ds = nc.Dataset(ARMOR_PATH)
    lat = ds["latitude"][:].astype(float)
    lon = ds["longitude"][:].astype(float)
    la = np.where((lat > GRID["bbox"][1]) & (lat < GRID["bbox"][3]))[0]
    lo = np.where((lon > GRID["bbox"][0]) & (lon < GRID["bbox"][2]))[0]
    assert len(la) == GRID["height"] and len(lo) == GRID["width"], "ARMOR3D subset does not match served grid"
    u = np.ma.filled(ds["ugo"][0, 0][la][:, lo].astype(float), np.nan)
    v = np.ma.filled(ds["vgo"][0, 0][la][:, lo].astype(float), np.nan)
    tt = ds["time"]
    armor_date = nc.num2date(tt[0], tt.units, getattr(tt, "calendar", "standard")).strftime("%Y-%m-%d")
    ds.close()
    zeta = ae.relative_vorticity(u, v, TGT_LATS, TGT_LONS)
    write_tile("current_u", armor_date, u.astype(np.float32))
    write_tile("current_v", armor_date, v.astype(np.float32))
    write_tile("vorticity", armor_date, zeta)
    log(f"[Hazards] ARMOR3D {armor_date}: u/v/vorticity tiles, zeta range "
        f"{np.nanmin(zeta):.2e} .. {np.nanmax(zeta):.2e} s^-1")
    return armor_date, zeta


def build_hazard_layers(ibr_year):
    """Write derived tiles + climatologies; return the catalog 'derived' section."""
    ae = _engine()
    armor_date, zeta = build_armor_derived()
    display, clim_meta = build_ibr_climatologies(ibr_year)
    sclim = dict(np.load(os.path.join(OUT, "data", "sst_climatology.npz")))
    cclim = dict(np.load(os.path.join(OUT, "data", "chl_climatology.npz")))
    dates = sorted(display)
    for d in dates:
        m = int(d[5:7]) - 1
        sst, chl = display[d]["sst"], display[d]["chl"]
        write_tile("mhw_intensity", d, ae.mhw_intensity(sst, sclim["clim"][m], sclim["p90"][m]))
        write_tile("mhw_detrended", d, ae.mhw_detrended(sst, d, sclim))
        write_tile("chl_bloom", d, ae.mhw_intensity(chl, cclim["clim"][m], cclim["p90"][m]))
        ind, ref = ae.eddy_convergence_indicator(sst, zeta, TGT_LATS)
        write_tile("eddy_convergence", d, ind)
    log(f"[Hazards] MHW (fixed + detrended), chlorophyll bloom and eddy-convergence tiles for "
        f"{len(dates)} months of {ibr_year}")
    cats = {"1": "Moderate", "2": "Strong", "3": "Severe", "4": "Extreme"}
    ibr_layers = {
        "mhw_intensity": {
            "var_code": VAR_CODES["mhw_intensity"], "units": "ratio", "source_id": "ibr",
            "long_name": "Monthly-mean marine heatwave intensity ratio (SST - clim) / (p90 - clim), "
                         f"fixed {MHW_BASELINE[0]}-{MHW_BASELINE[1]} baseline",
            "static_timesteps": dates, "on_demand": "any IBR timestep (derived from its SST tile)",
            "categories": cats, "climatology": clim_meta["sst"], "caveat": ae.MHW_CAVEAT,
        },
        "mhw_detrended": {
            "var_code": VAR_CODES["mhw_detrended"], "units": "ratio", "source_id": "ibr",
            "long_name": "Monthly-mean marine heatwave intensity ratio on linearly detrended SST",
            "static_timesteps": dates, "on_demand": "any IBR timestep (derived from its SST tile)",
            "categories": cats, "climatology": clim_meta["sst"], "caveat": ae.MHW_DETRENDED_CAVEAT,
        },
        "chl_bloom": {
            "var_code": VAR_CODES["chl_bloom"], "units": "ratio", "source_id": "ibr",
            "long_name": "Chlorophyll bloom anomaly index (log10 CHL - clim) / (p90 - clim)",
            "static_timesteps": dates, "on_demand": "any IBR timestep (derived from its chlorophyll tile)",
            "categories": {"1": "Elevated", "2": "High", "3": "Very high", "4": "Extreme"},
            "climatology": clim_meta["chl"], "caveat": ae.CHL_BLOOM_CAVEAT,
        },
    }
    fixed = {"fixed_date": armor_date, "source_id": "armor3d", "depths": [SURFACE_DEPTH]}
    return {
        **ibr_layers,
        "current_u": {**fixed, "var_code": VAR_CODES["current_u"], "units": "m/s",
                      "long_name": "Eastward surface geostrophic velocity (ugo)", "caveat": ae.GEOSTROPHIC_CAVEATS[0]},
        "current_v": {**fixed, "var_code": VAR_CODES["current_v"], "units": "m/s",
                      "long_name": "Northward surface geostrophic velocity (vgo)", "caveat": ae.GEOSTROPHIC_CAVEATS[0]},
        "vorticity": {**fixed, "var_code": VAR_CODES["vorticity"], "units": "s-1",
                      "long_name": "Relative vorticity of the surface geostrophic flow",
                      "method": "(1/(R cos phi)) (dv/dlambda - d(u cos phi)/dphi), central differences, R = 6371 km",
                      "caveat": ae.GEOSTROPHIC_CAVEATS[0]},
        "eddy_convergence": {
            "var_code": VAR_CODES["eddy_convergence"], "units": "0-100 indicator", "source_id": "ibr+armor3d",
            "long_name": "Warm-water & eddy convergence indicator (not a cyclone forecast)",
            "static_timesteps": dates, "on_demand": "any IBR timestep (SST) with the fixed ARMOR3D vorticity",
            "currents_date": armor_date, "caveat": ae.EDDY_CAVEAT,
        },
    }


def update_catalog_with_hazards(derived):
    path = os.path.join(OUT, "api", "catalog.json")
    with open(path, encoding="utf-8") as f:
        catalog = json.load(f)
    catalog["derived"] = derived
    catalog.setdefault("tile_format", {})["var_codes"] = VAR_CODES
    catalog["hazards_generated_at"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    write_json(path, catalog)
    log(f"[Hazards] catalog.json updated with {len(derived)} derived layers")


# --------------------------------------------------------------------------- catalog/static API

def write_static_api(catalog, instrument_ids):
    api = os.path.join(OUT, "api")
    write_json(os.path.join(api, "catalog.json"), catalog)
    clean_dir(os.path.join(api, "manifest"))
    variables = []
    for var, meta in catalog["variables"].items():
        manifest = {
            "variable": var,
            "units": meta["units"],
            "source_id": meta["source_id"],
            "source": catalog["sources"][meta["source_id"]]["title"],
            "bbox": GRID["bbox"],
            "grid": {k: GRID[k] for k in ("width", "height", "lon0", "lat0", "dlon", "dlat", "registration",
                                          "row_order")},
            "depth_levels": meta["depths"],
            "timesteps": meta["timesteps"],
            "value_range": meta["value_range"],
            "display_range": meta["display_range"],
        }
        write_json(os.path.join(api, "manifest", f"{var}.json"), manifest)
        variables.append({"id": var, "name": meta["long_name"], "units": meta["units"],
                          "standard_name": meta["standard_name"], "source_id": meta["source_id"],
                          "min_value": meta["value_range"][0], "max_value": meta["value_range"][1],
                          "display_range": meta["display_range"], "depths": meta["depths"],
                          "timesteps": meta["timesteps"]})
    write_json(os.path.join(api, "variables.json"), variables)

    # Precomputed comparison + profile analysis for static hosting, produced by the
    # SAME engine the FastAPI service runs (single source of truth).
    sys.path.insert(0, os.path.join(REPO, "data-service"))
    os.environ.setdefault("IBR_LIVE_TILES", "0")  # precompute from the static export only
    from app import analytics_engine as ae  # noqa: E402
    ae.set_data_root(OUT)
    comp_dir = os.path.join(api, "comparison")
    clean_dir(comp_dir)
    for iid in instrument_ids:
        for var in ("temperature", "salinity"):
            write_json(os.path.join(comp_dir, f"{iid}__{var}.json"), ae.compute_model_vs_obs(iid, var))
        prof_path = os.path.join(api, "profiles", f"{iid}.json")
        with open(prof_path, encoding="utf-8") as f:
            prof = json.load(f)
        prof["analysis"] = ae.compute_observed_profile_analysis(prof)
        write_json(prof_path, prof)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ibr-year", type=int, default=2019, help="IBR year exported as display tiles")
    ap.add_argument("--hazards-only", action="store_true",
                    help="only (re)build the derived hazard layers into the existing catalog; needs datasets/cmems.nc, "
                         "reads IBR SST from datasets/model/ or, if absent, from Hugging Face via the data-service")
    args = ap.parse_args()

    if args.hazards_only:
        if not os.path.exists(os.path.join(OUT, "api", "catalog.json")):
            raise SystemExit("No existing catalog; run the full build first.")
        if not os.path.exists(ARMOR_PATH):
            raise SystemExit(f"Missing authentic source file: {ARMOR_PATH} "
                             f"(python scripts/fetch_hf_datasets.py --only cmems.nc)")
        update_catalog_with_hazards(build_hazard_layers(args.ibr_year))
        return

    for p in (IBR_PATH, ARMOR_PATH):
        if not os.path.exists(p):
            raise SystemExit(f"Missing authentic source file: {p}")

    clean_dir(os.path.join(OUT, "tiles"))
    catalog_vars, sources = build_model_tiles(args.ibr_year)

    collocator = IBRCollocator(IBR_PATH)
    instrument_ids = build_argo(collocator)
    collocator.close()
    sources["argo"] = {
        "title": "Argo profiling floats (GDAC NetCDF)",
        "type": "in_situ_observation",
        "institution": "Argo GDAC (Coriolis / FR GDAC); per-float data centre recorded in profile metadata",
        "reference": "Argo (2000). Argo float data and metadata from Global Data Assembly Centre (Argo GDAC). "
                     "SEANOE. https://doi.org/10.17882/42182",
        "files": "datasets/coriolis/<WMO>/profiles/S*.nc, datasets/argo/incois_<WMO>_prof.nc",
    }

    catalog = {
        "schema": "incois-ocean-catalog/1",
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generator": "scripts/build_authentic_dataset.py",
        "grid": GRID,
        "tile_format": {
            "header": "32 bytes little-endian: magic 'INCO', u16 version, u16 var_code, u16 width, u16 height, "
                      "u16 depth_count, u16 data_type(1=float32), f32 min, f32 max, 8 reserved",
            "payload": "float32 little-endian, row-major, row 0 = southernmost latitude; NaN = no data",
            "path": "tiles/{variable}/{YYYY-MM-DD}/{depth:.1f}.bin",
            "var_codes": VAR_CODES,
        },
        "variables": catalog_vars,
        "sources": sources,
        "instruments": instrument_ids,
    }
    write_static_api(catalog, instrument_ids)
    update_catalog_with_hazards(build_hazard_layers(args.ibr_year))
    log(f"[Done] catalog with {len(catalog_vars)} variables, {len(instrument_ids)} Argo floats -> {rel(OUT)}")


if __name__ == "__main__":
    main()
