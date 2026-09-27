"""
Build the Disaster Early Warning products that come from external (non-INCOIS) datasets.

Inputs are the raw downloads in datasets/ext/ (scripts/download_external.py). Outputs:
  * datasets/ext_products/*    compact products the data-service reads (also uploaded to Hugging Face
                               under ext_products/ and fetched from there on Render)
  * frontend/public/...        static copies of the latest fields so static hosting shows them too

    python scripts/build_ext_products.py ibtracs
    python scripts/build_ext_products.py oisst      # daily MHW (Hobday 2016) + Degree Heating Weeks
    python scripts/build_ext_products.py currents   # HYCOM surface currents + GFS/NCEP winds for drift
    python scripts/build_ext_products.py skill      # drift skill against Global Drifter Program tracks
    python scripts/build_ext_products.py tchp       # Tropical Cyclone Heat Potential (HYCOM 3-D temperature)
    python scripts/build_ext_products.py gpi        # Emanuel & Nolan (2004) Genesis Potential Index (NCEP R1)
    python scripts/build_ext_products.py validate   # layers vs IBTrACS storms
    python scripts/build_ext_products.py all

Nothing is gap-filled or synthesised: missing inputs stay NaN / null and are reported.
"""
import argparse
import datetime as dt
import glob
import json
import os
import sys
import time

import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(REPO, "datasets", "ext")
PROD = os.path.join(REPO, "datasets", "ext_products")
OUT = os.path.join(REPO, "frontend", "public")

sys.path.insert(0, os.path.join(REPO, "data-service"))
os.environ.setdefault("IBR_LIVE_TILES", "0")
from app import analytics_engine as ae  # noqa: E402
from app import ext_hazards as xh  # noqa: E402

ae.set_data_root(OUT)
G = xh.GRID
TGT_LATS, TGT_LONS = xh.grid_axes()


def log(msg):
    print(msg, flush=True)


def rel(p):
    return os.path.relpath(p, REPO).replace("\\", "/")


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def write_static_tile(layer, date, field):
    path = os.path.join(OUT, "tiles", layer, date, "0.0.bin")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(ae.pack_tile(xh.VAR_CODES[layer], field))


# --------------------------------------------------------------------------- IBTrACS

def _num(x):
    x = (x or "").strip()
    try:
        return float(x)
    except ValueError:
        return None


def load_ibtracs():
    import csv
    storms = {}
    for basin in ("NI", "SI"):
        path = os.path.join(EXT, "ibtracs", f"ibtracs.{basin}.list.v04r01.csv")
        with open(path, encoding="utf-8", newline="") as f:
            rd = csv.reader(f)
            head = next(rd)
            next(rd)  # units row
            ix = {k: i for i, k in enumerate(head)}
            for row in rd:
                if row[ix["TRACK_TYPE"]] != "main":
                    continue
                season = int(row[ix["SEASON"]])
                if season < 1980:
                    continue
                sid = row[ix["SID"]]
                lat, lon = float(row[ix["LAT"]]), float(row[ix["LON"]])
                # Intensity: WMO-agency value (IMD for NI, RSMC La Reunion/BoM for SI), else JTWC (USA_WIND).
                wmo = _num(row[ix["WMO_WIND"]])
                usa = _num(row[ix["USA_WIND"]])
                st = storms.setdefault(sid, {
                    "sid": sid, "name": row[ix["NAME"]].strip(), "season": season, "basin": row[ix["BASIN"]],
                    "subbasin": row[ix["SUBBASIN"]], "points": []})
                st["points"].append({
                    "t": row[ix["ISO_TIME"]][:16].replace(" ", "T") + "Z",
                    "lat": round(lat, 2), "lon": round(lon, 2),
                    "wmo_wind_kt": wmo, "usa_wind_kt": usa,
                    "pres_mb": _num(row[ix["WMO_PRES"]]),
                    "imd_grade": row[ix["NEWDELHI_GRADE"]].strip() or None,
                    "nature": row[ix["NATURE"]].strip(),
                    "dist2land_km": _num(row[ix["DIST2LAND"]]),
                })
    return storms


IMD_GRADES = {  # IMD classification by maximum sustained 3-min wind (kt)
    "D": "Depression", "DD": "Deep Depression", "CS": "Cyclonic Storm", "SCS": "Severe Cyclonic Storm",
    "VSCS": "Very Severe Cyclonic Storm", "ESCS": "Extremely Severe Cyclonic Storm",
    "SUCS": "Super Cyclonic Storm", "SuCS": "Super Cyclonic Storm", "SCS(H)": "Severe Cyclonic Storm (hurricane)",
}


def build_ibtracs():
    storms = load_ibtracs()
    w, s, e, n = G["bbox"]
    out = []
    for st in storms.values():
        pts = st["points"]
        if not any(w <= p["lon"] <= e and s <= p["lat"] <= n for p in pts):
            continue
        winds = [p["wmo_wind_kt"] if p["wmo_wind_kt"] is not None else p["usa_wind_kt"] for p in pts]
        valid = [x for x in winds if x is not None]
        st["max_wind_kt"] = max(valid) if valid else None
        st["start"], st["end"] = pts[0]["t"], pts[-1]["t"]
        genesis = pts[0]
        st["genesis"] = {"t": genesis["t"], "lat": genesis["lat"], "lon": genesis["lon"]}
        # Landfall = a fix on land (DIST2LAND 0) whose previous fix was over water.
        falls = [b for a, b in zip(pts, pts[1:]) if b["dist2land_km"] == 0 and (a["dist2land_km"] or 0) > 0]
        st["landfalls"] = [{"t": b["t"], "lat": b["lat"], "lon": b["lon"], "wind_kt": b["wmo_wind_kt"]} for b in falls]
        st["landfall"] = st["landfalls"][0] if falls else None
        out.append(st)
    out.sort(key=lambda x: x["start"])
    doc = {
        "source": "IBTrACS v04r01 (Knapp et al. 2010, BAMS 91, 363-376; doi:10.25921/82ty-9e16), NOAA NCEI",
        "files": ["ibtracs.NI.list.v04r01.csv", "ibtracs.SI.list.v04r01.csv"],
        "filter": f"main tracks, seasons >= 1980, at least one fix inside {G['bbox']}",
        "wind_note": "wmo_wind_kt is the WMO-designated agency value (IMD 3-min for NI); usa_wind_kt is JTWC 1-min.",
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "storms": out,
    }
    os.makedirs(PROD, exist_ok=True)
    write_json(os.path.join(PROD, "ibtracs_tracks.json"), doc)
    # Static copy with trimmed fields for the globe layer (same shape as /api/hazards/cyclones/compact).
    write_json(os.path.join(OUT, "api", "cyclone_tracks.json"), xh.compact_tracks(doc))
    log(f"[IBTrACS] {len(out)} storms -> {rel(os.path.join(PROD, 'ibtracs_tracks.json'))} "
        f"+ {rel(os.path.join(OUT, 'api', 'cyclone_tracks.json'))}")
    source_markers(out)
    return out


def source_markers(storms):
    """Re-derive the historical cyclone markers from IBTrACS (replacing hand-entered values)."""
    path = os.path.join(REPO, "frontend", "src", "data", "cyclones.json")
    with open(path, encoding="utf-8") as f:
        markers = json.load(f)
    out = []
    for m in markers:
        # Match on the storm listed at that place and date: nearest landfall within 2 days and 300 km.
        best, best_d = None, None
        mt = dt.datetime.fromisoformat(m.get("landfall_time", m["date"])[:10])
        for st in storms:
            if st["basin"] != "NI":
                continue
            for lf in st["landfalls"]:
                lt = dt.datetime.fromisoformat(lf["t"][:10])
                if abs((lt - mt).days) > 2:
                    continue
                d = xh.haversine_km(m["lat"], m["lon"], lf["lat"], lf["lon"])
                if d <= 300 and (best_d is None or d < best_d):
                    best, best_d, best_lf = st, d, lf
        if best is None:
            log(f"[IBTrACS] marker '{m['name']}' has no IBTrACS match; dropped")
            continue
        pk = max(best["points"], key=lambda p: (p["wmo_wind_kt"] if p["wmo_wind_kt"] is not None else -1))
        lf = next(p for p in best["points"] if p["t"] == best_lf["t"])
        grade = IMD_GRADES.get(pk["imd_grade"] or "", pk["imd_grade"] or "n/a")
        peak = f"{pk['wmo_wind_kt']:.0f} kt ({pk['wmo_wind_kt'] * 1.852:.0f} km/h)" if pk["wmo_wind_kt"] else "n/a"
        lfw = f"{lf['wmo_wind_kt']:.0f} kt" if lf["wmo_wind_kt"] is not None else "n/a"
        out.append({
            "name": m["name"], "location": m["location"] if best_d <= 100 else "",
            "lat": lf["lat"], "lon": lf["lon"], "date": lf["t"][:10], "landfall_time": lf["t"],
            "intensity": f"Peak IMD grade {grade}, {peak}; {lfw} at first land contact (IMD 3-min, IBTrACS)",
            "sid": best["sid"], "ibtracs_name": best["name"], "max_wind_kt": pk["wmo_wind_kt"],
            "source": "IBTrACS v04r01 (NOAA NCEI), WMO agency IMD New Delhi",
        })
    with open(path, "w", encoding="utf-8") as f:
        f.write("[\n" + ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in out) + "\n]\n")
    log(f"[IBTrACS] {len(out)}/{len(markers)} historical markers re-sourced -> {rel(path)}")


# --------------------------------------------------------------------------- OISST: daily MHW + DHW

OISST_WINDOW_DAYS = 400      # days of daily MHW / DHW fields kept in the product
OISST_SPINUP_DAYS = 120      # extra history so events and the 84-day DHW sum are complete at the window start
OISST_BAND_ROWS = 16


def _oisst_files():
    files = sorted(glob.glob(os.path.join(EXT, "oisst", "oisst_*.nc")))
    if not files:
        raise SystemExit("No OISST files in datasets/ext/oisst (python scripts/download_external.py oisst)")
    return files


def _oisst_index(files):
    import netCDF4 as nc
    dates, owners = [], []
    with nc.Dataset(files[0]) as d0:
        lats = d0["lat"][:].astype(float)
        lons = d0["lon"][:].astype(float)
    for fi, f in enumerate(files):
        with nc.Dataset(f) as d:
            t = d["time"]
            for k, x in enumerate(nc.num2date(t[:], t.units, getattr(t, "calendar", "standard"))):
                dates.append(dt.date(x.year, x.month, x.day))
                owners.append((fi, k))
    order = np.argsort(np.array([d.toordinal() for d in dates]))
    dates = [dates[i] for i in order]
    owners = [owners[i] for i in order]
    for a, b in zip(dates, dates[1:]):
        if (b - a).days != 1:
            raise SystemExit(f"OISST record is not continuous: {a} -> {b}. Re-run the download.")
    return dates, owners, lats, lons


def _read_band(files, owners, r0, r1):
    import netCDF4 as nc
    n = len(owners)
    out = None
    by_file = {}
    for i, (fi, k) in enumerate(owners):
        by_file.setdefault(fi, []).append((i, k))
    for fi, items in by_file.items():
        with nc.Dataset(files[fi]) as d:
            v = d["sst"]
            block = np.ma.filled(v[:, r0:r1, :].astype(np.float32), np.nan)
            if out is None:
                out = np.full((n,) + block.shape[1:], np.nan, dtype=np.float32)
            for i, k in items:
                out[i] = block[k]
    return out


def build_oisst():
    """Full build: day-of-year climatology / threshold (1991-2020) and CRW MMM from the whole OISST record
    -> ext_products/oisst_clim.nc, then the recent daily MHW / DHW window -> ext_products/mhw_daily.nc."""
    import netCDF4 as nc
    import warnings
    files = _oisst_files()
    dates, owners, lats, lons = _oisst_index(files)
    ny, nx = len(lats), len(lons)
    doy = xh.leap_doy(dates)
    years = np.array([d.year for d in dates])
    months = np.array([d.month for d in dates])
    b0, b1 = xh.MHW_DAILY_BASELINE
    in_base = (years >= b0) & (years <= b1)
    if dates[0].year > b0 or dates[-1].year < b1:
        raise SystemExit(f"OISST record {dates[0]}..{dates[-1]} does not cover the {b0}-{b1} baseline")
    m0, m1 = xh.DHW_MMM_YEARS
    mmm_years = list(range(m0, m1 + 1))
    log(f"[OISST] {len(files)} files, {dates[0]}..{dates[-1]} ({len(dates)} days), grid {ny}x{nx}")
    os.makedirs(PROD, exist_ok=True)
    path = os.path.join(PROD, "oisst_clim.nc")
    tmp = path + ".tmp"
    ds = nc.Dataset(tmp, "w", format="NETCDF4")
    ds.createDimension("doy", 366)
    ds.createDimension("lat", ny)
    ds.createDimension("lon", nx)
    ds.createVariable("lat", "f4", ("lat",))[:] = lats
    ds.createVariable("lon", "f4", ("lon",))[:] = lons
    vc = ds.createVariable("clim", "f4", ("doy", "lat", "lon"), zlib=True, fill_value=np.float32(np.nan))
    vt = ds.createVariable("thresh", "f4", ("doy", "lat", "lon"), zlib=True, fill_value=np.float32(np.nan))
    vm = ds.createVariable("mmm", "f4", ("lat", "lon"), zlib=True, fill_value=np.float32(np.nan))
    vc.long_name = f"Daily SST climatology {b0}-{b1} (Hobday 2016: 11-day window, 31-day smoothing)"
    vt.long_name = f"Daily 90th-percentile SST threshold {b0}-{b1}"
    vm.long_name = f"CRW Maximum of Monthly Mean {m0}-{m1} recentred to {xh.DHW_MMM_CENTRE}"
    t0 = time.time()
    for r0 in range(0, ny, OISST_BAND_ROWS):
        r1 = min(ny, r0 + OISST_BAND_ROWS)
        sst = _read_band(files, owners, r0, r1)
        clim, thresh = xh.hobday_climatology(sst, doy, in_base)
        mm = np.full((12, len(mmm_years), r1 - r0, nx), np.nan, dtype=np.float32)
        with warnings.catch_warnings(), np.errstate(all="ignore"):
            warnings.simplefilter("ignore", RuntimeWarning)
            for yi, y in enumerate(mmm_years):
                for m in range(12):
                    block = sst[(years == y) & (months == m + 1)]
                    mm[m, yi] = np.where(np.isfinite(block).all(axis=0), np.nanmean(block, axis=0), np.nan)
        vc[:, r0:r1, :] = clim
        vt[:, r0:r1, :] = thresh
        vm[r0:r1, :] = xh.crw_mmm(mm, mmm_years)
        log(f"[OISST] climatology rows {r0}-{r1 - 1} ({time.time() - t0:.0f}s)")
        del sst, clim, thresh, mm
    ds.source = "NOAA OISST v2.1 daily, NOAA PSL THREDDS"
    ds.record = f"{dates[0]}..{dates[-1]}"
    ds.close()
    os.replace(tmp, path)
    log(f"[OISST] -> {rel(path)} ({os.path.getsize(path) / 1e6:.1f} MB)")
    build_oisst_window()


def build_oisst_window():
    """Daily MHW events + DHW for the most recent OISST_WINDOW_DAYS from oisst_clim.nc and the recent monthly
    OISST files only (this is what the near-real-time job runs)."""
    import netCDF4 as nc
    cpath = os.path.join(PROD, "oisst_clim.nc")
    if not os.path.isfile(cpath):
        raise SystemExit("ext_products/oisst_clim.nc missing (run build_ext_products.py oisst or fetch it from HF)")
    files = _oisst_files()
    need = OISST_WINDOW_DAYS + OISST_SPINUP_DAYS + 40
    files = files[-(need // 28 + 2):]
    dates, owners, lats, lons = _oisst_index(files)
    if len(dates) < OISST_WINDOW_DAYS + OISST_SPINUP_DAYS:
        raise SystemExit(f"Only {len(dates)} recent OISST days; need {OISST_WINDOW_DAYS + OISST_SPINUP_DAYS}")
    s0 = len(dates) - OISST_WINDOW_DAYS - OISST_SPINUP_DAYS
    dates, owners = dates[s0:], owners[s0:]
    doy = xh.leap_doy(dates)
    ny, nx = len(lats), len(lons)
    k = OISST_SPINUP_DAYS
    wdates = dates[k:]
    with nc.Dataset(cpath) as c:
        clim_all = np.ma.filled(c["clim"][:].astype(np.float32), np.nan)
        thr_all = np.ma.filled(c["thresh"][:].astype(np.float32), np.nan)
        mmm = np.ma.filled(c["mmm"][:].astype(np.float32), np.nan)
        clim_record = c.record
    sst = _read_band(files, owners, 0, ny)
    cl = clim_all[doy - 1]
    th = thr_all[doy - 1]
    del clim_all, thr_all
    with np.errstate(invalid="ignore"):
        exceed = sst > th
    ev = np.zeros(sst.shape, dtype=np.int16)
    ok = np.isfinite(th).all(axis=0) & np.isfinite(sst).all(axis=0)
    for j, i in zip(*np.nonzero(ok)):
        ev[:, j, i] = xh.detect_events(exceed[:, j, i])
    hs, dhw = xh.degree_heating_weeks(sst, mmm)

    path = os.path.join(PROD, "mhw_daily.nc")
    tmp = path + ".tmp"
    ds = nc.Dataset(tmp, "w", format="NETCDF4")
    ds.createDimension("time", len(wdates))
    ds.createDimension("lat", ny)
    ds.createDimension("lon", nx)
    tv = ds.createVariable("time", "i4", ("time",))
    tv.units = "days since 1970-01-01"
    tv.calendar = "standard"
    tv[:] = [(d - dt.date(1970, 1, 1)).days for d in wdates]
    ds.createVariable("lat", "f4", ("lat",))[:] = lats
    ds.createVariable("lon", "f4", ("lon",))[:] = lons
    b0, b1 = xh.MHW_DAILY_BASELINE
    m0, m1 = xh.DHW_MMM_YEARS

    def var(name, scale, units, long_name, data):
        v = ds.createVariable(name, "i2", ("time", "lat", "lon"), zlib=True, complevel=4, chunksizes=(8, ny, nx),
                              fill_value=-32768)
        if scale:
            v.scale_factor = scale
            v.add_offset = 0.0
        v.units, v.long_name = units, long_name
        v[:] = data

    var("sst", 0.01, "degC", "NOAA OISST v2.1 daily sea surface temperature", np.ma.masked_invalid(sst[k:]))
    var("clim", 0.01, "degC", f"Daily climatology {b0}-{b1} (11-day window, 31-day smoothing)",
        np.ma.masked_invalid(cl[k:]))
    var("thresh", 0.01, "degC", f"Daily 90th-percentile threshold {b0}-{b1}", np.ma.masked_invalid(th[k:]))
    var("event_day", None, "days", "Day number within a Hobday (2016) marine heatwave; 0 = none",
        np.ma.masked_array(ev[k:], mask=~np.isfinite(sst[k:])))
    var("hotspot", 0.01, "degC", "Coral Reef Watch HotSpot = SST - MMM", np.ma.masked_invalid(hs[k:]))
    var("dhw", 0.01, "degC-weeks", "Coral Reef Watch Degree Heating Weeks (84-day window)",
        np.ma.masked_invalid(dhw[k:]))
    vm = ds.createVariable("mmm", "f4", ("lat", "lon"), zlib=True, fill_value=np.float32(np.nan))
    vm.long_name = f"Maximum of Monthly Mean climatology {m0}-{m1} recentred to {xh.DHW_MMM_CENTRE}"
    vm[:] = mmm
    ds.title = "Daily marine heatwaves and Degree Heating Weeks from NOAA OISST v2.1"
    ds.source = ("NOAA OISST v2.1 (Huang et al. 2021, J. Climate 34, 2923-2939), NOAA PSL THREDDS, "
                 f"subset {G['bbox']}")
    ds.mhw_method = ("Hobday et al. (2016): 11-day window, 90th percentile, 31-day smoothing, baseline "
                     f"{b0}-{b1}; events >= {xh.MHW_MIN_DURATION} days, gaps <= {xh.MHW_MAX_GAP} days joined; "
                     "categories Hobday et al. (2018)")
    ds.dhw_method = ("NOAA Coral Reef Watch v3.1 (Liu et al. 2014): MMM from 1985-2012 monthly means recentred to "
                     "1988.2857; DHW = sum of HotSpots >= 1 degC over 84 days / 7")
    ds.climatology_record = clim_record
    ds.window = f"{wdates[0]}..{wdates[-1]}"
    ds.close()
    os.replace(tmp, path)
    log(f"[OISST] window {wdates[0]}..{wdates[-1]} -> {rel(path)} ({os.path.getsize(path) / 1e6:.1f} MB)")
    xh.clear_cache()
    write_latest_oisst_tiles()


def write_latest_oisst_tiles(n_days=7):
    """Static copies of the latest days for static hosting."""
    ds, reason = xh.open_nc("mhw_daily.nc")
    if ds is None:
        raise SystemExit(reason)
    dates = xh.nc_dates(ds)
    for d in dates[-n_days:]:
        for layer in ("mhw_daily", "dhw"):
            field, why = xh.oisst_layer_field(layer, d)
            if field is not None:
                write_static_tile(layer, d, field)
    log(f"[OISST] static tiles for {dates[-n_days]}..{dates[-1]}")


# --------------------------------------------------------------------------- drift forcing fields

def _hycom_series(start, end):
    """HYCOM ESPC-D-V02 surface currents (3-hourly) regridded to the served grid: (times, u, v)."""
    import netCDF4 as nc
    times, us, vs = [], [], []
    d, d1 = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    while d <= d1:
        f = os.path.join(EXT, "hycom", "currents", f"uv_{d}.nc")
        if not os.path.isfile(f):
            raise SystemExit(f"Missing HYCOM file {rel(f)} (python scripts/download_external.py hycom --start {d} --end {d})")
        with nc.Dataset(f) as ds:
            t = ds["time"]
            tt = nc.num2date(t[:], t.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True)
            lat, lon = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            for k, x in enumerate(tt):
                u = np.ma.filled(ds["ssu"][k].astype(float), np.nan)
                v = np.ma.filled(ds["ssv"][k].astype(float), np.nan)
                times.append(x.replace(tzinfo=dt.timezone.utc))
                us.append(xh.regrid_to_served(u, lat, lon))
                vs.append(xh.regrid_to_served(v, lat, lon))
        d += dt.timedelta(days=1)
    return times, np.stack(us), np.stack(vs)


def _wind_series(kind, start, end):
    """10 m wind (times, u, v) regridded to the served grid. kind: 'gfs' (daily files) or 'ncep' (R2)."""
    import netCDF4 as nc
    times, us, vs = [], [], []
    if kind == "gfs":
        files = []
        d, d1 = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
        while d <= d1:
            files.append(os.path.join(EXT, "gfs", f"gfs10m_{d}.nc"))
            d += dt.timedelta(days=1)
        for f in files:
            if not os.path.isfile(f):
                raise SystemExit(f"Missing GFS file {rel(f)}")
            with nc.Dataset(f) as ds:
                t = ds["time"]
                tt = nc.num2date(t[:], t.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True)
                lat, lon = ds["latitude"][:].astype(float), ds["longitude"][:].astype(float)
                ul = ds["u-component_of_wind_height_above_ground"]
                vl = ds["v-component_of_wind_height_above_ground"]
                o = np.argsort(lat)
                for k, x in enumerate(tt):
                    times.append(x.replace(tzinfo=dt.timezone.utc))
                    us.append(xh.regrid_to_served(np.ma.filled(ul[k, 0].astype(float), np.nan)[o], lat[o], lon))
                    vs.append(xh.regrid_to_served(np.ma.filled(vl[k, 0].astype(float), np.nan)[o], lat[o], lon))
    else:
        uf = sorted(glob.glob(os.path.join(EXT, "ncep", f"uwnd10m_{start}_*.nc")))
        vf = sorted(glob.glob(os.path.join(EXT, "ncep", f"vwnd10m_{start}_*.nc")))
        if not uf or not vf:
            raise SystemExit(f"Missing NCEP R2 wind files for {start}")
        with nc.Dataset(uf[0]) as du, nc.Dataset(vf[0]) as dv:
            t = du["time"]
            tt = nc.num2date(t[:], t.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True)
            lat, lon = du["lat"][:].astype(float), du["lon"][:].astype(float)
            o = np.argsort(lat)
            for k, x in enumerate(tt):
                times.append(x.replace(tzinfo=dt.timezone.utc))
                us.append(xh.regrid_to_served(np.ma.filled(du["uwnd"][k, 0].astype(float), np.nan)[o], lat[o], lon))
                vs.append(xh.regrid_to_served(np.ma.filled(dv["vwnd"][k, 0].astype(float), np.nan)[o], lat[o], lon))
    # de-duplicate (GFS "Best" may repeat a valid time) keeping the latest file's value
    uniq = {}
    for t_, u_, v_ in zip(times, us, vs):
        uniq[t_] = (u_, v_)
    ts = sorted(uniq)
    return ts, np.stack([uniq[t_][0] for t_ in ts]), np.stack([uniq[t_][1] for t_ in ts])


def _interp_time(src_t, src, dst_t):
    """Linear interpolation in time; NaN outside the source span (no extrapolation)."""
    s = np.array([x.timestamp() for x in src_t])
    out = np.full((len(dst_t),) + src.shape[1:], np.nan, dtype=np.float32)
    for i, x in enumerate(dst_t):
        ts = x.timestamp()
        if ts < s[0] or ts > s[-1]:
            continue
        j = int(np.searchsorted(s, ts))
        if j < len(s) and s[j] == ts:
            out[i] = src[j]
            continue
        a = (ts - s[j - 1]) / (s[j] - s[j - 1])
        out[i] = (1 - a) * src[j - 1] + a * src[j]
    return out


def write_drift_fields(name, start, end, wind_kind, wind_label):
    import netCDF4 as nc
    ct, cu, cv = _hycom_series(start, end)
    wt, wu, wv = _wind_series(wind_kind, start, end)
    wu_i, wv_i = _interp_time(wt, wu, ct), _interp_time(wt, wv, ct)
    have_wind = np.isfinite(wu_i).any(axis=(1, 2))
    path = os.path.join(PROD, f"{name}.nc")
    tmp = path + ".tmp"
    ds = nc.Dataset(tmp, "w", format="NETCDF4")
    ds.createDimension("time", len(ct))
    ds.createDimension("lat", G["height"])
    ds.createDimension("lon", G["width"])
    tv = ds.createVariable("time", "f8", ("time",))
    tv.units = "hours since 1970-01-01 00:00:00"
    tv.calendar = "standard"
    tv[:] = [x.timestamp() / 3600.0 for x in ct]
    ds.createVariable("lat", "f4", ("lat",))[:] = TGT_LATS
    ds.createVariable("lon", "f4", ("lon",))[:] = TGT_LONS
    for vname, arr, scale, ln in (("u", cu, 0.001, "HYCOM ESPC-D-V02 eastward surface current (ssu)"),
                                  ("v", cv, 0.001, "HYCOM ESPC-D-V02 northward surface current (ssv)"),
                                  ("wind_u", wu_i, 0.01, f"{wind_label} eastward 10 m wind"),
                                  ("wind_v", wv_i, 0.01, f"{wind_label} northward 10 m wind")):
        v = ds.createVariable(vname, "i2", ("time", "lat", "lon"), zlib=True, complevel=4,
                              chunksizes=(1, G["height"], G["width"]), fill_value=-32768)
        v.scale_factor, v.add_offset, v.units, v.long_name = scale, 0.0, "m/s", ln
        v[:] = np.ma.masked_invalid(np.clip(arr, -32767 * scale, 32767 * scale))
    ds.currents_source = ("HYCOM ESPC-D-V02 global 1/12 deg analysis (US Navy / FNMOC via hycom.org), hourly "
                          "surface currents subsampled 3-hourly; total currents incl. wind-driven and tidal flow")
    ds.wind_source = wind_label
    ds.wind_coverage = (f"{sum(have_wind)}/{len(ct)} current timesteps have wind "
                        f"({wt[0]:%Y-%m-%dT%H} .. {wt[-1]:%Y-%m-%dT%H}); others have no wind (NaN)")
    ds.regridding = "bilinear onto the served 0.125 deg grid, NaN wherever any source corner is land"
    ds.close()
    os.replace(tmp, path)
    log(f"[drift] {name}: {ct[0]:%Y-%m-%dT%H}..{ct[-1]:%Y-%m-%dT%H} ({len(ct)} steps), wind on "
        f"{int(have_wind.sum())} steps -> {rel(path)} ({os.path.getsize(path) / 1e6:.1f} MB)")
    return ct, cu, cv


SKILL_WINDOW = ("2025-04-01", "2025-05-31")   # months with the most GDP drifters in the box
OPS_MAX_DAYS = 7


def ops_window():
    """Latest run of consecutive days (<= OPS_MAX_DAYS) that have BOTH a complete HYCOM current file and a
    GFS wind file: the operational drift window."""
    import netCDF4 as nc

    def days(pattern, prefix):
        out = set()
        for f in glob.glob(os.path.join(EXT, pattern)):
            out.add(os.path.basename(f)[len(prefix):len(prefix) + 10])
        return out

    hy = set()
    for d in days(os.path.join("hycom", "currents", "uv_*.nc"), "uv_"):
        with nc.Dataset(os.path.join(EXT, "hycom", "currents", f"uv_{d}.nc")) as ds:
            if ds.dimensions["time"].size >= 8:
                hy.add(d)
    both = sorted(hy & days(os.path.join("gfs", "gfs10m_*.nc"), "gfs10m_"))
    if not both:
        raise SystemExit("No day with both HYCOM currents and GFS wind (download_external.py hycom / gfs)")
    end = dt.date.fromisoformat(both[-1])
    start = end
    while (start - dt.timedelta(days=1)).isoformat() in both and (end - start).days + 1 < OPS_MAX_DAYS:
        start -= dt.timedelta(days=1)
    return start.isoformat(), end.isoformat()


def build_currents():
    os.makedirs(PROD, exist_ok=True)
    start, end = ops_window()
    write_drift_fields("drift_ops", start, end, "gfs",
                       "NCEP GFS 0.25 deg (UCAR Unidata THREDDS, analyses + short forecasts)")
    # NRT eddy layer: daily-mean HYCOM vorticity with same-day OISST.
    build_eddy_nrt()


def build_eddy_nrt(days=None):
    """Warm-water & eddy convergence on SIMULTANEOUS data: daily-mean HYCOM total-current vorticity and the
    same day's OISST, for every day both exist."""
    import netCDF4 as nc
    files = sorted(glob.glob(os.path.join(EXT, "hycom", "currents", "uv_*.nc")))
    oisst_ds, reason = xh.open_nc("mhw_daily.nc")
    if oisst_ds is None:
        log(f"[eddy-nrt] skipped: {reason}")
        return
    odates = xh.nc_dates(oisst_ds)
    olat, olon = oisst_ds["lat"][:], oisst_ds["lon"][:]
    out_dates, fields, zetas = [], [], []
    for f in files:
        d = os.path.basename(f)[3:13]
        if d not in odates:
            continue
        with nc.Dataset(f) as ds:
            lat, lon = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            u = np.ma.filled(ds["ssu"][:].astype(float), np.nan)
            v = np.ma.filled(ds["ssv"][:].astype(float), np.nan)
        if u.shape[0] < 8:
            continue  # need a full day (8 x 3-hourly) for a daily mean
        um = xh.regrid_to_served(u.mean(axis=0), lat, lon)
        vm = xh.regrid_to_served(v.mean(axis=0), lat, lon)
        zeta = ae.relative_vorticity(um, vm, TGT_LATS, TGT_LONS)
        sst = xh.regrid_to_served(xh.read_field(oisst_ds, "sst", odates.index(d)), olat, olon)
        ind, _ = ae.eddy_convergence_indicator(sst, zeta, TGT_LATS)
        out_dates.append(d)
        fields.append(ind)
        zetas.append(zeta)
    if not out_dates:
        log("[eddy-nrt] no day with both HYCOM currents and OISST")
        return
    path = os.path.join(PROD, "eddy_nrt.nc")
    tmp = path + ".tmp"
    ds = nc.Dataset(tmp, "w", format="NETCDF4")
    ds.createDimension("time", len(out_dates))
    ds.createDimension("lat", G["height"])
    ds.createDimension("lon", G["width"])
    tv = ds.createVariable("time", "i4", ("time",))
    tv.units, tv.calendar = "days since 1970-01-01", "standard"
    tv[:] = [(dt.date.fromisoformat(d) - dt.date(1970, 1, 1)).days for d in out_dates]
    for name, arr, dtype in (("indicator", fields, "f4"), ("vorticity", zetas, "f4")):
        v = ds.createVariable(name, dtype, ("time", "lat", "lon"), zlib=True, complevel=4,
                              chunksizes=(1, G["height"], G["width"]), fill_value=np.nan)
        v[:] = np.stack(arr)
    ds.method = ("indicator = 100 * min(1, cyclonic zeta / zeta_ref) where OISST >= 26.5 degC and zeta*sign(lat) > 0; "
                 "zeta from the daily-mean HYCOM total surface current; same calendar day for SST and currents")
    ds.close()
    os.replace(tmp, path)
    for d, fld in list(zip(out_dates, fields))[-7:]:
        write_static_tile("eddy_convergence_nrt", d, fld)
    log(f"[eddy-nrt] {len(out_dates)} days {out_dates[0]}..{out_dates[-1]} -> {rel(path)}")


# --------------------------------------------------------------------------- drift skill vs GDP drifters

SKILL_HOURS = 72
SKILL_UNDROGUED_WINDAGE = 0.01  # assumed wind slip of an undrogued SVP drifter (assumption, reported)


def _drifter_segments():
    import pandas as pd
    files = sorted(glob.glob(os.path.join(EXT, "drifters", "gdp_6h_*.csv")))
    if not files:
        raise SystemExit("No drifter CSV (python scripts/download_external.py drifters ...)")
    df = pd.concat([pd.read_csv(f, skiprows=[1]) for f in files]).drop_duplicates(["ID", "time"])
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df["drogue_lost_date"] = pd.to_datetime(df["drogue_lost_date"], utc=True, errors="coerce")
    w0 = pd.Timestamp(SKILL_WINDOW[0], tz="UTC")
    w1 = pd.Timestamp(SKILL_WINDOW[1], tz="UTC") + pd.Timedelta(hours=21)
    df = df[(df.time >= w0) & (df.time <= w1)].sort_values(["ID", "time"])
    segs = []
    for did, g in df.groupby("ID"):
        g = g.set_index("time")
        for t0 in g.index[(g.index.hour == 0)]:
            t_end = t0 + pd.Timedelta(hours=SKILL_HOURS)
            if t_end > w1:
                continue
            sel = g.loc[t0:t_end]
            if len(sel) != SKILL_HOURS // 6 + 1:
                continue  # need every 6-hourly fix
            dl = sel["drogue_lost_date"].iloc[0]
            drogued = bool(pd.notna(dl) and dl > t_end)
            segs.append({"id": str(did), "t0": t0.to_pydatetime(), "drogued": drogued,
                         "lat": sel["latitude"].to_numpy(float), "lon": sel["longitude"].to_numpy(float)})
    return segs


def build_skill():
    """Hindcast 72-h drifter segments with three models and score them against the observed tracks."""
    import netCDF4 as nc
    write_drift_fields("drift_skill", *SKILL_WINDOW, "ncep",
                       "NCEP/DOE Reanalysis 2 (NOAA PSL), 6-hourly 10 m wind on the T62 Gaussian grid (~1.9 deg)")
    xh.clear_cache()
    fields = xh.DriftFields("drift_skill.nc")
    # previous model: CMEMS ARMOR3D geostrophic snapshot (2024-12-31) held constant
    armor = os.path.join(REPO, "datasets", "cmems.nc")
    static = None
    if os.path.isfile(armor):
        with nc.Dataset(armor) as ds:
            lat = ds["latitude"][:].astype(float)
            lon = ds["longitude"][:].astype(float)
            la = np.where((lat > G["bbox"][1]) & (lat < G["bbox"][3]))[0]
            lo = np.where((lon > G["bbox"][0]) & (lon < G["bbox"][2]))[0]
            u = np.ma.filled(ds["ugo"][0, 0][la][:, lo].astype(float), np.nan)
            v = np.ma.filled(ds["vgo"][0, 0][la][:, lo].astype(float), np.nan)
        static = xh.StaticFields(u, v, "ARMOR3D geostrophic 2024-12-31 (static)")
    segs = _drifter_segments()
    log(f"[skill] {len(segs)} complete 72-h drifter segments in {SKILL_WINDOW}")
    rng = np.random.default_rng(0)
    models = {"hycom": ("HYCOM total currents", 0.0), "hycom_wind": ("HYCOM + 1 % wind", SKILL_UNDROGUED_WINDAGE)}
    if static is not None:
        models["geostrophic_static"] = ("ARMOR3D geostrophic snapshot, static (previous model)", 0.0)
    rows = []
    for sg in segs:
        sh = sg["t0"].timestamp() / 3600.0
        if not (fields.hours[0] <= sh and sh + SKILL_HOURS <= fields.hours[-1]):
            continue
        row = {"id": sg["id"], "t0": f"{sg['t0']:%Y-%m-%dT%H:%MZ}", "drogued": sg["drogued"],
               "lat0": round(float(sg["lat"][0]), 3), "lon0": round(float(sg["lon"][0]), 3), "models": {}}
        for key, (_, wind) in models.items():
            f = static if key == "geostrophic_static" else fields
            t, pla, plo, strand, stop = xh.run_ensemble(
                f, np.array([sg["lat"][0]]), np.array([sg["lon"][0]]), sh, SKILL_HOURS, 30.0,
                np.array([wind]), 0.0, rng, False, record_every=12)  # every 6 h
            if len(t) != len(sg["lat"]) or strand[0]:
                row["models"][key] = None  # stranded / left the domain: not scored
                continue
            mla, mlo = pla[:, 0], plo[:, 0]
            sep = [xh.haversine_km(a, b, c, d) for a, b, c, d in zip(sg["lat"], sg["lon"], mla, mlo)]
            row["models"][key] = {"sep_km_24h": round(sep[4], 2), "sep_km_48h": round(sep[8], 2),
                                  "sep_km_72h": round(sep[12], 2),
                                  "skill": round(xh.liu_weisberg_skill(sg["lat"], sg["lon"], mla, mlo) or 0.0, 4)}
        rows.append(row)

    def agg(key, drogued=None):
        vals = [r["models"].get(key) for r in rows if (drogued is None or r["drogued"] == drogued)]
        vals = [v for v in vals if v]
        if not vals:
            return None
        return {"segments": len(vals),
                **{f"median_sep_km_{h}h": round(float(np.median([v[f"sep_km_{h}h"] for v in vals])), 2)
                   for h in (24, 48, 72)},
                "mean_skill": round(float(np.mean([v["skill"] for v in vals])), 4),
                "median_skill": round(float(np.median([v["skill"] for v in vals])), 4)}

    summary = {key: {"label": label, "all": agg(key), "drogued": agg(key, True), "undrogued": agg(key, False)}
               for key, (label, _) in models.items()}
    doc = {
        "title": "Drift skill against NOAA Global Drifter Program trajectories",
        "window": list(SKILL_WINDOW), "hours": SKILL_HOURS,
        "drifters": "NOAA AOML GDP 6-hour interpolated QC (drifter_6hour_qc, AOML ERDDAP)",
        "metric": ("Separation between simulated and observed positions at 24/48/72 h, and the Liu & Weisberg "
                   "(2011) skill score (n = 1): 1 = perfect, 0 = no skill."),
        "models": {k: v[0] for k, v in models.items()},
        "notes": [
            "Drogued SVP drifters follow the ~15 m current; HYCOM surface currents are compared directly.",
            f"The 'HYCOM + wind' run adds {SKILL_UNDROGUED_WINDAGE * 100:g} % of the NCEP R2 10 m wind (assumed "
            "undrogued slip); it is scored on all segments for comparison.",
            "Segments whose simulation strands on the 1/8 deg coastline or leaves the domain are not scored.",
            "The previous model uses the single ARMOR3D geostrophic field of 2024-12-31 for dates months later, "
            "which is exactly the limitation this comparison quantifies.",
        ],
        "summary": summary,
        "segments": rows,
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    write_json(os.path.join(PROD, "drift_skill.json"), doc)
    slim = {k: v for k, v in doc.items() if k != "segments"}
    write_json(os.path.join(OUT, "api", "drift_skill.json"), slim)
    for k, v in summary.items():
        log(f"[skill] {k}: {v['all']}")


# --------------------------------------------------------------------------- TCHP (HYCOM 3-D temperature)

def build_tchp():
    import netCDF4 as nc
    files = sorted(glob.glob(os.path.join(EXT, "hycom", "t3z", "t3z_*.nc")))
    if not files:
        raise SystemExit("No HYCOM 3-D temperature (python scripts/download_external.py hycom-t --start ... --end ...)")
    dates, tchps, d26s = [], [], []
    for f in files:
        with nc.Dataset(f) as ds:
            depth = ds["depth"][:].astype(float)
            lat, lon = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            T = np.ma.filled(ds["water_temp"][0].astype(float), np.nan)  # (depth, lat, lon)
            t = ds["time"]
            d = nc.num2date(t[0], t.units).strftime("%Y-%m-%d")
        tchp, d26 = xh.tchp_profile(depth, T)
        dates.append(d)
        tchps.append(xh.regrid_to_served(tchp, lat, lon))
        d26s.append(xh.regrid_to_served(d26, lat, lon))
        log(f"[TCHP] {d}: max {np.nanmax(tchp):.0f} kJ/cm2, D26 max {np.nanmax(d26):.0f} m")
    path = os.path.join(PROD, "tchp.nc")
    tmp = path + ".tmp"
    ds = nc.Dataset(tmp, "w", format="NETCDF4")
    ds.createDimension("time", len(dates))
    ds.createDimension("lat", G["height"])
    ds.createDimension("lon", G["width"])
    tv = ds.createVariable("time", "i4", ("time",))
    tv.units, tv.calendar = "days since 1970-01-01", "standard"
    tv[:] = [(dt.date.fromisoformat(d) - dt.date(1970, 1, 1)).days for d in dates]
    for name, arr, units, ln in (("tchp", tchps, "kJ cm-2", "Tropical Cyclone Heat Potential"),
                                 ("d26", d26s, "m", "Depth of the 26 degC isotherm")):
        v = ds.createVariable(name, "f4", ("time", "lat", "lon"), zlib=True, complevel=4,
                              chunksizes=(1, G["height"], G["width"]), fill_value=np.nan)
        v.units, v.long_name = units, ln
        v[:] = np.stack(arr)
    ds.source = "HYCOM ESPC-D-V02 3-D water_temp (00 UTC analyses), hycom.org NCSS"
    ds.method = ("Leipper & Volgenau (1972): rho*cp*integral((T-26) dz) from D26 to the surface; trapezoidal on the "
                 f"HYCOM z-levels with linear interpolation of the 26 degC crossing; rho={xh.TCHP_RHO}, cp={xh.TCHP_CP}")
    ds.close()
    os.replace(tmp, path)
    # latest 3-D column kept as a product for the vertical-structure fallback (analytics_engine)
    import shutil
    shutil.copyfile(files[-1], os.path.join(PROD, "hycom_t3z_latest.nc"))
    xh.clear_cache()
    for d, fld in list(zip(dates, tchps))[-7:]:
        write_static_tile("tchp", d, fld)
    log(f"[TCHP] {len(dates)} days -> {rel(path)}")


# --------------------------------------------------------------------------- GPI (NCEP R1 monthly + OISST)
#
# Emanuel & Nolan (2004): GPI = |1e5 eta|^1.5 (H/50)^3 (Vpot/70)^3 (1 + 0.1 Vshear)^-2
#   eta    absolute vorticity at 850 hPa (s-1)          H      relative humidity at 600 hPa (%)
#   Vpot   potential intensity (m/s, Bister & Emanuel 2002 via tcpyPI; Gilford 2021)
#   Vshear |V(200 hPa) - V(850 hPa)| (m/s)
# SST for the PI is the OISST monthly mean averaged onto the 2.5 deg R1 grid.

def _r1(var):
    import netCDF4 as nc
    files = sorted(glob.glob(os.path.join(EXT, "ncep", "r1mon", f"{var}_*.nc")))
    if not files:
        raise SystemExit(f"No NCEP R1 monthly '{var}' files (python scripts/download_external.py gpi ...)")
    times, data, lev = [], [], None
    for f in files:
        with nc.Dataset(f) as ds:
            t = ds["time"]
            tt = nc.num2date(t[:], t.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True)
            lat, lon = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            if "level" in ds.variables:
                lev = ds["level"][:].astype(float)
            arr = np.ma.filled(ds[var][:].astype(float), np.nan)
            times += [x.strftime("%Y-%m") for x in tt]
            data.append(arr)
    arr = np.concatenate(data)
    uniq, idx = np.unique(times, return_index=True)
    return list(uniq), arr[idx], lat, lon, lev


def _oisst_monthly_on(lats, lons, months):
    """OISST monthly means block-averaged to 2.5 deg cells centred on (lats, lons); NaN if < 50 % ocean."""
    import netCDF4 as nc
    out = np.full((len(months), len(lats), len(lons)), np.nan, dtype=np.float32)
    for mi, ym in enumerate(months):
        f = os.path.join(EXT, "oisst", f"oisst_{ym.replace('-', '')}.nc")
        if not os.path.isfile(f):
            continue
        with nc.Dataset(f) as ds:
            sla, slo = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            s = np.ma.filled(ds["sst"][:].astype(float), np.nan)
        with np.errstate(all="ignore"):
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                mean = np.nanmean(s, axis=0)
                for j, la in enumerate(lats):
                    rs = np.abs(sla - la) <= 1.25
                    for i, lo in enumerate(lons):
                        cs = np.abs(slo - lo) <= 1.25
                        blk = mean[np.ix_(rs, cs)]
                        if blk.size and np.isfinite(blk).mean() >= 0.5:
                            out[mi, j, i] = np.nanmean(blk)
    return out


def build_gpi():
    import netCDF4 as nc
    from tcpyPI import pi as tc_pi
    months, u, lat, lon, lev = _r1("uwnd")
    _, v, _, _, _ = _r1("vwnd")
    _, air, _, _, lev_t = _r1("air")
    _, shum, _, _, lev_q = _r1("shum")
    _, rhum, _, _, lev_r = _r1("rhum")
    _, slp, _, _, _ = _r1("slp")
    order = np.argsort(lat)
    lat = lat[order]
    u, v, air, shum, rhum, slp = (a[..., order, :] for a in (u, v, air, shum, rhum, slp))
    il = lambda levels, p: int(np.argmin(np.abs(levels - p)))
    # absolute vorticity at 850 hPa
    import sys as _s
    _s.path.insert(0, os.path.join(REPO, "data-service"))
    omega = 7.292e-5
    f = 2 * omega * np.sin(np.deg2rad(lat))[:, None]
    sst = _oisst_monthly_on(lat, lon, months)
    gpi = np.full((len(months), len(lat), len(lon)), np.nan, dtype=np.float32)
    vpot_all = np.full_like(gpi, np.nan)
    shear_all = np.full_like(gpi, np.nan)
    eta_all = np.full_like(gpi, np.nan)
    rh_all = np.full_like(gpi, np.nan)
    k850, k200, k600 = il(lev, 850), il(lev, 200), il(lev_r, 600)
    for mi in range(len(months)):
        zeta = ae.relative_vorticity(u[mi, k850], v[mi, k850], lat, lon).astype(float)
        eta = np.abs(zeta + f)
        shear = np.hypot(u[mi, k200] - u[mi, k850], v[mi, k200] - v[mi, k850])
        H = rhum[mi, k600]
        vp = np.full(eta.shape, np.nan)
        for j in range(len(lat)):
            for i in range(len(lon)):
                s_ = sst[mi, j, i]
                if not np.isfinite(s_):
                    continue
                T = air[mi, :, j, i]
                # mixing ratio (g/kg) from R1 specific humidity (g/kg): r = q / (1 - q/1000).
                # R1 humidity stops at 300 hPa -> treated as dry above (documented in the product).
                q = np.zeros_like(T)
                for kk, p in enumerate(lev_t):
                    kq = np.nonzero(np.abs(lev_q - p) < 1e-6)[0]
                    if kq.size:
                        sh = shum[mi, kq[0], j, i]
                        q[kk] = sh / (1.0 - sh / 1000.0)
                res = tc_pi(s_, slp[mi, j, i], lev_t, T, q, CKCD=0.9, ascent_flag=0, diss_flag=1, V_reduc=0.8,
                            ptop=50, miss_handle=1)
                vp[j, i] = res[0] if res[2] == 1 else np.nan  # (VMAX, PMIN, IFL, TO, OTL); IFL 1 = ok
        g = (np.abs(1e5 * eta) ** 1.5) * (np.clip(H, 0, None) / 50.0) ** 3 * (np.clip(vp, 0, None) / 70.0) ** 3 \
            * (1.0 + 0.1 * shear) ** -2
        gpi[mi], vpot_all[mi], shear_all[mi], eta_all[mi], rh_all[mi] = g, vp, shear, eta, H
        if mi % 60 == 0:
            log(f"[GPI] {months[mi]}: max GPI {np.nanmax(g):.2f}, max Vpot {np.nanmax(vp):.0f} m/s")
    path = os.path.join(PROD, "gpi_monthly.nc")
    tmp = path + ".tmp"
    ds = nc.Dataset(tmp, "w", format="NETCDF4")
    ds.createDimension("time", len(months))
    ds.createDimension("lat", len(lat))
    ds.createDimension("lon", len(lon))
    tv = ds.createVariable("time", "i4", ("time",))
    tv.units, tv.calendar = "days since 1970-01-01", "standard"
    tv[:] = [(dt.date(int(m[:4]), int(m[5:7]), 15) - dt.date(1970, 1, 1)).days for m in months]
    ds.createVariable("lat", "f4", ("lat",))[:] = lat
    ds.createVariable("lon", "f4", ("lon",))[:] = lon
    for name, arr, units in (("gpi", gpi, "1"), ("vpot", vpot_all, "m s-1"), ("shear", shear_all, "m s-1"),
                             ("eta850", eta_all, "s-1"), ("rh600", rh_all, "%"), ("sst", sst, "degC")):
        vv = ds.createVariable(name, "f4", ("time", "lat", "lon"), zlib=True, fill_value=np.nan)
        vv.units = units
        vv[:] = arr
    ds.source = ("NCEP/NCAR Reanalysis 1 monthly means (NOAA PSL; Kalnay et al. 1996) and NOAA OISST v2.1 "
                 "monthly-mean SST; potential intensity by tcpyPI (Gilford 2021, Bister & Emanuel 2002)")
    ds.method = "Emanuel & Nolan (2004) GPI; R1 humidity above 300 hPa treated as zero (not provided by R1)"
    ds.close()
    os.replace(tmp, path)
    xh.clear_cache()
    for m in months[-6:]:
        fld, why, d = xh.gpi_field(m + "-15")
        if fld is not None:
            write_static_tile("gpi", d, fld)
    log(f"[GPI] {len(months)} months {months[0]}..{months[-1]} -> {rel(path)}")


# --------------------------------------------------------------------------- validation against IBTrACS

def _genesis_points(min_wind_kt=34.0):
    """North Indian Ocean storms that reached tropical-storm strength (>= 34 kt, WMO agency) with the
    first fix at or above that strength as the genesis point (a common best-track genesis definition)."""
    doc = json.load(open(os.path.join(PROD, "ibtracs_tracks.json"), encoding="utf-8"))
    out = []
    for st in doc["storms"]:
        if st["basin"] != "NI":
            continue
        first = next((p for p in st["points"] if (p["wmo_wind_kt"] or 0) >= min_wind_kt), None)
        if first is None:
            continue
        w, s, e, n = G["bbox"]
        if not (w <= first["lon"] <= e and s <= first["lat"] <= n):
            continue
        out.append({"sid": st["sid"], "name": st["name"], "t": first["t"], "lat": first["lat"], "lon": first["lon"],
                    "subbasin": st["subbasin"], "max_wind_kt": st["max_wind_kt"]})
    return out


def build_validate():
    import netCDF4 as nc
    gens = _genesis_points()
    results = {"generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "storms_source": "IBTrACS v04r01 North Indian basin, first fix >= 34 kt (WMO agency) = genesis",
               "tests": []}
    lats, lons = TGT_LATS, TGT_LONS
    ocean_ni = (lats[:, None] >= 0) & (lats[:, None] <= 25) & (lons[None, :] >= 50) & (lons[None, :] <= 100)

    # 1) GPI at genesis vs all North-Indian ocean cells of the same month
    gm, _ = xh.gpi_months()
    if gm:
        vals, pct = [], []
        for g_ in gens:
            fld, why, d = xh.gpi_field(g_["t"][:10])
            if fld is None:
                continue
            v = ae.sample_grid(fld.astype(np.float64), g_["lat"], g_["lon"])
            if v is None:
                continue
            ref = fld[ocean_ni & np.isfinite(fld)]
            vals.append((v, float(np.mean(ref))))
            pct.append(float((ref < v).mean() * 100))
        if vals:
            results["tests"].append({
                "test": "gpi_at_genesis",
                "description": "GPI (Emanuel & Nolan 2004, NCEP R1 monthly) at each storm's genesis point and month, "
                               "vs all North Indian Ocean cells (0-25N, 50-100E) in that month",
                "storms": len(vals),
                "mean_gpi_at_genesis": round(float(np.mean([a for a, _ in vals])), 3),
                "mean_gpi_basin_same_months": round(float(np.mean([b for _, b in vals])), 3),
                "ratio": round(float(np.mean([a for a, _ in vals]) / np.mean([b for _, b in vals])), 2),
                "median_percentile_of_genesis_cell": round(float(np.median(pct)), 1),
                "fraction_genesis_in_top_30pct": round(float(np.mean(np.array(pct) >= 70)), 3),
                "interpretation": "Ratio > 1 and a median percentile well above 50 mean storms formed where the "
                                  "index was high, i.e. the layer carries real genesis information.",
            })

    # 2) daily OISST SST >= 26.5 degC at genesis
    ok, n = 0, 0
    sst_vals = []
    for g_ in gens:
        d = dt.date.fromisoformat(g_["t"][:10])
        f = os.path.join(EXT, "oisst", f"oisst_{d:%Y%m}.nc")
        if not os.path.isfile(f):
            continue
        with nc.Dataset(f) as ds:
            t = ds["time"]
            days = [x.day for x in nc.num2date(t[:], t.units)]
            if d.day not in days:
                continue
            k = days.index(d.day)
            la, lo = ds["lat"][:], ds["lon"][:]
            j, i = int(np.argmin(np.abs(la - g_["lat"]))), int(np.argmin(np.abs(lo - g_["lon"])))
            v = float(np.ma.filled(ds["sst"][k, j, i], np.nan))
        if np.isfinite(v):
            n += 1
            ok += v >= ae.SST_GENESIS_THRESHOLD_C
            sst_vals.append(v)
    if n:
        results["tests"].append({
            "test": "oisst_at_genesis",
            "description": "NOAA OISST daily SST at the genesis point and day vs the 26.5 °C threshold used by the "
                           "warm-water & eddy convergence layer",
            "storms": n, "fraction_sst_ge_26_5": round(ok / n, 3),
            "median_sst": round(float(np.median(sst_vals)), 2), "min_sst": round(float(np.min(sst_vals)), 2)})

    # 3) monthly IBR MHW index (fixed and detrended) at genesis, 1982-2019
    for layer in ("mhw_intensity", "mhw_detrended"):
        vals = []
        for g_ in gens:
            if not ("1990" <= g_["t"][:4] <= "2019"):
                continue
            ts = ae.timesteps("temperature")
            ym = g_["t"][:7]
            d = next((x for x in ts if x[:7] == ym), None)
            if d is None:
                continue
            arr, reason, _ = ae.load_derived(layer, d)
            if arr is None:
                continue
            v = ae.sample_grid(arr, g_["lat"], g_["lon"])
            if v is not None:
                vals.append(v)
        if vals:
            results["tests"].append({
                "test": f"{layer}_at_genesis",
                "description": f"Monthly IBR {layer} ratio at genesis points 1990-2019 (>= 1 = above the monthly "
                               "90th percentile)",
                "storms": len(vals), "fraction_ge_1": round(float(np.mean(np.array(vals) >= 1)), 3),
                "median_ratio": round(float(np.median(vals)), 3),
                "interpretation": "Expected near 0.1 if unrelated to genesis; this shows how often storms formed "
                                  "over anomalously warm months (not a skill score)."})

    # 4) storms inside the near-real-time window: TCHP and eddy indicator along the track
    doc = json.load(open(os.path.join(PROD, "ibtracs_tracks.json"), encoding="utf-8"))
    td, _ = xh.tchp_dates()
    recent = []
    for st in doc["storms"]:
        for p in st["points"]:
            d = p["t"][:10]
            if d in td:
                fld, _, _ = xh.generic_layer_field("tchp.nc", "tchp", d, "TCHP")
                v = ae.sample_grid(fld.astype(np.float64), p["lat"], p["lon"]) if fld is not None else None
                recent.append({"sid": st["sid"], "name": st["name"], "t": p["t"], "lat": p["lat"], "lon": p["lon"],
                               "wind_kt": p["wmo_wind_kt"] or p["usa_wind_kt"], "tchp": None if v is None else round(v, 1)})
    results["tests"].append({"test": "storms_in_nrt_window",
                             "description": "IBTrACS fixes inside the TCHP (HYCOM) window with the TCHP at each fix",
                             "window": [td[0], td[-1]] if td else None, "fixes": recent,
                             "note": "Empty when no storm was active in the window (IBTrACS provisional data lag "
                                     "a few days)." if not recent else ""})
    write_json(os.path.join(PROD, "validation.json"), results)
    write_json(os.path.join(OUT, "api", "hazard_validation.json"), results)
    for t in results["tests"]:
        log(f"[validate] {t['test']}: " + ", ".join(f"{k}={v}" for k, v in t.items()
                                                   if k not in ("test", "description", "interpretation", "fixes", "note")))


# --------------------------------------------------------------------------- static catalog

def build_catalog():
    """frontend/public/api/ext_catalog.json: the external layers with the dates that have STATIC tiles
    (the live service lists every product date via /api/hazards/layers)."""
    xh.clear_cache()
    live = xh.ext_catalog()
    out = {}
    for layer, meta in live.items():
        d = os.path.join(OUT, "tiles", layer)
        dates = sorted(x for x in os.listdir(d) if os.path.isfile(os.path.join(d, x, "0.0.bin"))) if os.path.isdir(d) else []
        out[layer] = {**meta, "dates": dates, "available": bool(dates),
                      "product_dates": {"first": meta["dates"][0], "last": meta["dates"][-1],
                                        "count": len(meta["dates"])} if meta["dates"] else None}
        if not dates:
            out[layer]["reason"] = "No static tiles exported for this layer."
        else:
            out[layer].pop("reason", None)
    write_json(os.path.join(OUT, "api", "ext_catalog.json"),
               {"generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "note": "Static hosting shows the dates listed here; the live data-service serves every product date.",
                "ext_layers": out})
    log("[catalog] " + ", ".join(f"{k}: {len(v['dates'])} static dates" for k, v in out.items()))


# --------------------------------------------------------------------------- CLI

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", nargs="+", choices=["ibtracs", "oisst", "currents", "skill", "tchp", "gpi", "validate",
                                                "catalog", "all"])
    args = ap.parse_args()
    todo = set(args.what)
    if "all" in todo:
        todo = {"ibtracs", "oisst", "currents", "skill", "tchp", "gpi", "validate", "catalog"}
    steps = [("ibtracs", build_ibtracs), ("oisst", build_oisst), ("currents", build_currents), ("skill", build_skill), ("tchp", build_tchp), ("gpi", build_gpi), ("validate", build_validate), ("catalog", build_catalog)]
    for name, fn in steps:
        if name in todo:
            t0 = time.time()
            fn()
            log(f"[{name}] done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
