"""
Authoritative data build for the INCOIS 3D Ocean platform.

Reads ONLY authentic source files and writes every served artefact under
``frontend/public`` (static hosting) which the FastAPI data-service also reads.

Sources (all verified by file metadata, see catalog.json "sources"):
  * INCOIS Bio-ROMS (IBR) surface fields, DOI 10.5281/zenodo.13802393
      datasets/model/INCOIS-BIO-ROMS.nc  (monthly, 1980-01 .. 2019-12, surface only)
  * CMEMS ARMOR3D MULTIOBS_GLO_PHY_TSUV_3D_MYNRT_015_012 (CLS), 2024-12-31, surface
      datasets/cmems.nc                  (observation-based analysis, geostrophic u/v)
  * Argo float list for static hosting: datasets/argo_platforms.json
      (scripts/build_argo_index.py, from the uploaded GDAC archives). Profiles and
      model matchups are served on demand by the data-service (app/argo_store.py).

Rules enforced here:
  * No synthetic values. Missing / flagged / land values stay NaN in tiles and
    null in JSON. Nothing is filled, extrapolated or invented.
  * Argo QC, depth from pressure and model collocation rules live in
    data-service/app/argo_qc.py and app/analytics_engine.py (one implementation).

Usage:  python scripts/build_authentic_dataset.py [--ibr-year 2019]
"""
import argparse
import datetime as dt
import json
import os
import shutil
import struct
import sys
import time

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


def depth_key(depth):
    return f"{float(depth):.1f}"


# --------------------------------------------------------------------------- tiles

# Codes 1-5 are the original served fields; 6-10 are derived hazard layers (catalog["derived"]).
# Mirrored in frontend/src/api/client.ts VAR_CODES. Never renumber existing codes.
VAR_CODES = {"temperature": 1, "salinity": 2, "currents": 3, "chlorophyll": 4, "mld": 5,
             "mhw_intensity": 6, "current_u": 7, "current_v": 8, "vorticity": 9, "eddy_convergence": 10}


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

def build_argo_catalog():
    """Static api/instruments.json with every float of the uploaded GDAC archives
    (datasets/argo_platforms.json). No float is selected or hard-coded here."""
    sys.path.insert(0, os.path.join(REPO, "data-service"))
    from app import argo_store  # noqa: E402
    path = os.path.join(DATASETS, "argo_platforms.json")
    if not os.path.exists(path):
        raise SystemExit(f"Missing {rel(path)}: run scripts/build_argo_index.py first")
    with open(path, encoding="utf-8") as f:
        plats = json.load(f)["platforms"]
    features = [argo_store.feature(p) for p in plats]
    for stale in ("profiles", "matchups", "comparison"):
        shutil.rmtree(os.path.join(OUT, "api", stale), ignore_errors=True)
    write_json(os.path.join(OUT, "api", "instruments.json"), {"type": "FeatureCollection", "features": features})
    log(f"[Argo] {len(features)} floats -> api/instruments.json")
    return len(features)


def build_cyclones_static():
    """Static api/cyclones.json: every named IBTrACS landfall (data-service app/cyclones.py)."""
    sys.path.insert(0, os.path.join(REPO, "data-service"))
    from app import cyclones  # noqa: E402
    doc = cyclones.landfalls()
    if not doc["available"]:
        raise SystemExit(doc["reason"])
    write_json(os.path.join(OUT, "api", "cyclones.json"), doc)
    log(f"[Cyclones] {len(doc['cyclones'])} IBTrACS landfalls -> api/cyclones.json")


# --------------------------------------------------------------------------- hazard layers
#
# Derived artefacts for the Disaster Early Warning panel. The science lives in
# data-service/app/analytics_engine.py (mhw_intensity, relative_vorticity,
# eddy_convergence_indicator) so the service and this build share one implementation.

MHW_BASELINE = (1982, 2011)  # 30-year baseline recommended by Hobday et al. (2016)


def _engine():
    sys.path.insert(0, os.path.join(REPO, "data-service"))
    os.environ.setdefault("IBR_LIVE_TILES", "0")
    from app import analytics_engine as ae  # noqa: E402
    ae.set_data_root(OUT)
    return ae


class IBRSST:
    """Monthly IBR SST on its native grid: local netCDF4 file, else the data-service HF reader."""

    def __init__(self):
        if os.path.exists(IBR_PATH):
            self.ds = nc.Dataset(IBR_PATH)
            t = self.ds["TIME"]
            self.times = nc.num2date(t[:], t.units, t.calendar)
            self.lat = np.ma.filled(self.ds["LAT"][:].astype(float), np.nan)
            self.lon = np.ma.filled(self.ds["LON"][:].astype(float), np.nan)
            self.source = rel(IBR_PATH)
            self._read = lambda k0, k1: np.ma.filled(self.ds["SST"][k0:k1, :, :].astype(float), np.nan)
        else:
            sys.path.insert(0, os.path.join(REPO, "data-service"))
            from app import model_store as ms  # noqa: E402
            fn = os.path.basename(IBR_PATH)
            log(f"[MHW] {rel(IBR_PATH)} not found locally; reading SST from Hugging Face {ms.HF_REPO} "
                f"(~1 GB over 480 months; first run also builds the SST chunk index)")
            r = ms.open_reader(fn)
            dec = lambda name: ms.decode(np.asarray(r.read(name, (slice(None),))), r.variables[name].attrs)
            tv = r.variables["TIME"]
            self.times = nc.num2date(dec("TIME").astype(float), tv.attrs["units"], tv.attrs.get("calendar", "standard"))
            self.lat, self.lon = dec("LAT").astype(float), dec("LON").astype(float)
            self.source = f"huggingface:{ms.HF_REPO}/{fn}"
            attrs = r.variables["SST"].attrs
            self._read = lambda k0, k1: ms.decode(ms.read_array(fn, "SST", (slice(k0, k1),))[0], attrs).astype(float)
            self.ds = None

    def months(self, batch=12):
        """Yield (index, cftime date, native field) for every timestep."""
        t0 = time.time()
        for k0 in range(0, len(self.times), batch):
            k1 = min(len(self.times), k0 + batch)
            block = self._read(k0, k1)
            log(f"[MHW] SST {self.times[k0].strftime('%Y-%m')}..{self.times[k1 - 1].strftime('%Y-%m')} "
                f"({k1}/{len(self.times)}, {time.time() - t0:.0f}s)")
            for i in range(k1 - k0):
                yield k0 + i, self.times[k0 + i], block[i]

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


def build_sst_climatology(ibr_year):
    """
    Per-cell, per-calendar-month SST mean and 90th percentile over MHW_BASELINE (served grid),
    plus the regridded SST of the display year. A cell's climatology is NaN unless every
    baseline year is finite there (no partial-record statistics).
    """
    src = IBRSST()
    regrid = _regridder_for(src.lat, src.lon)
    y0, y1 = MHW_BASELINE
    nyears = y1 - y0 + 1
    stack = np.full((12, nyears, GRID["height"], GRID["width"]), np.nan, dtype=np.float32)
    seen = set()
    display = {}
    for k, t, field in src.months():
        key = (t.year, t.month)
        if key in seen:
            raise SystemExit(f"IBR has two timesteps in {t.year}-{t.month:02d}; monthly climatology is ambiguous.")
        seen.add(key)
        if y0 <= t.year <= y1 or t.year == ibr_year:
            tile = regrid(field)
            if y0 <= t.year <= y1:
                stack[t.month - 1, t.year - y0] = tile
            if t.year == ibr_year:
                display[t.strftime("%Y-%m-%d")] = tile
    src_name = src.source
    src.close()
    missing = [(m + 1, y0 + y) for m in range(12) for y in range(nyears) if not np.isfinite(stack[m, y]).any()]
    if missing:
        raise SystemExit(f"Baseline months missing from IBR: {missing[:6]}{'...' if len(missing) > 6 else ''}")
    count = np.isfinite(stack).sum(axis=1).astype(np.int16)          # (12, H, W)
    complete = count == nyears
    import warnings
    with warnings.catch_warnings(), np.errstate(all="ignore"):
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN (land) cells; masked just below
        clim = np.nanmean(stack, axis=1).astype(np.float32)
        p90 = np.nanpercentile(stack, 90, axis=1).astype(np.float32)
    clim[~complete] = np.nan
    p90[~complete] = np.nan
    path = os.path.join(OUT, "data", "sst_climatology.npz")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    np.savez_compressed(path, clim=clim, p90=p90, count=count, baseline=np.array(MHW_BASELINE, dtype=np.int16))
    log(f"[MHW] climatology {y0}-{y1} -> {rel(path)} ({int(complete[0].sum())} complete ocean cells)")
    return display, {"file": rel(path), "baseline": list(MHW_BASELINE), "source": src_name,
                     "percentile_method": "numpy nanpercentile (linear interpolation) over the 30 baseline years",
                     "window": "calendar month (no day-of-year smoothing; monthly data)"}


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
    """Write derived tiles + climatology; return the catalog 'derived' section."""
    ae = _engine()
    armor_date, zeta = build_armor_derived()
    display, clim_meta = build_sst_climatology(ibr_year)
    with np.load(os.path.join(OUT, "data", "sst_climatology.npz")) as z:
        clim, p90 = z["clim"], z["p90"]
    dates = sorted(display)
    for d in dates:
        m = int(d[5:7]) - 1
        write_tile("mhw_intensity", d, ae.mhw_intensity(display[d], clim[m], p90[m]))
        ind, ref = ae.eddy_convergence_indicator(display[d], zeta, TGT_LATS)
        write_tile("eddy_convergence", d, ind)
    log(f"[Hazards] MHW + eddy-convergence tiles for {len(dates)} months of {ibr_year}")
    fixed = {"fixed_date": armor_date, "source_id": "armor3d", "depths": [SURFACE_DEPTH]}
    return {
        "mhw_intensity": {
            "var_code": VAR_CODES["mhw_intensity"], "units": "ratio", "source_id": "ibr",
            "long_name": "Monthly-mean marine heatwave intensity ratio (SST - clim) / (p90 - clim)",
            "static_timesteps": dates, "on_demand": "any IBR timestep (derived from its SST tile)",
            "categories": {"1": "Moderate", "2": "Strong", "3": "Severe", "4": "Extreme"},
            "climatology": clim_meta, "caveat": ae.MHW_CAVEAT,
        },
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

def write_static_api(catalog):
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



def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ibr-year", type=int, default=2019, help="IBR year exported as display tiles")
    ap.add_argument("--observations-only", action="store_true",
                    help="only rewrite api/instruments.json (Argo archive) and api/cyclones.json (IBTrACS)")
    ap.add_argument("--hazards-only", action="store_true",
                    help="only (re)build the derived hazard layers into the existing catalog; needs datasets/cmems.nc, "
                         "reads IBR SST from datasets/model/ or, if absent, from Hugging Face via the data-service")
    args = ap.parse_args()

    if args.observations_only:
        build_argo_catalog()
        build_cyclones_static()
        return

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

    n_floats = build_argo_catalog()
    build_cyclones_static()
    sources["argo"] = {
        "title": "Argo profiling floats (GDAC NetCDF)",
        "type": "in_situ_observation",
        "institution": "Argo GDAC; per-float data centre recorded in profile metadata",
        "reference": "Argo (2000). Argo float data and metadata from Global Data Assembly Centre (Argo GDAC). "
                     "SEANOE. https://doi.org/10.17882/42182",
        "files": "raw/argo_<provider>.tar (argo_platforms.json, argo_tar_index/<provider>.json)",
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
        "instrument_count": n_floats,
    }
    write_static_api(catalog)
    update_catalog_with_hazards(build_hazard_layers(args.ibr_year))
    log(f"[Done] catalog with {len(catalog_vars)} variables, {n_floats} Argo floats -> {rel(OUT)}")


if __name__ == "__main__":
    main()
