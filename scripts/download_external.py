"""
Download the external (non-INCOIS) datasets used by the Disaster Early Warning layers,
cut to the project hazard box (35-100E, 10S-25N), into datasets/ext/.

    python scripts/download_external.py ibtracs     # IBTrACS v04r01 North + South Indian basins (NOAA NCEI)
    python scripts/download_external.py oisst       # NOAA OISST v2.1 daily SST 1982-present (NOAA PSL)
    python scripts/download_external.py drifters    # NOAA Global Drifter Program hourly/6-hourly (AOML ERDDAP)
    python scripts/download_external.py cmems       # CMEMS currents, Stokes drift, winds, 3-D temperature
    python scripts/download_external.py all

No source here needs a login except CMEMS, which reads COPERNICUSMARINE_SERVICE_USERNAME /
COPERNICUSMARINE_SERVICE_PASSWORD from the environment. Every file keeps the provider's
values; nothing is gap-filled or synthesised.
"""
import argparse
import datetime as dt
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(REPO_ROOT, "datasets", "ext")

# Hazard box: the Arabian Sea, Bay of Bengal and the equatorial Indian Ocean.
WEST, EAST, SOUTH, NORTH = 35.0, 100.0, -10.0, 25.0

IBTRACS_URL = ("https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/"
               "v04r01/access/csv/ibtracs.{basin}.list.v04r01.csv")
OISST_NCSS = ("https://psl.noaa.gov/thredds/ncss/grid/Datasets/noaa.oisst.v2.highres/sst.day.mean.{year}.nc"
              "?var=sst&north={n}&south={s}&west={w}&east={e}&horizStride=1"
              "&time_start={t0}T00:00:00Z&time_end={t1}T00:00:00Z&accept=netcdf4")
OISST_FIRST_YEAR = 1982


def _get(url: str, dest: str, timeout: int = 900, tries: int = 4) -> int:
    tmp = dest + ".part"
    for attempt in range(1, tries + 1):
        try:
            with requests.get(url, stream=True, timeout=timeout) as r:
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            os.replace(tmp, dest)
            return os.path.getsize(dest)
        except Exception as exc:  # network hiccups on NOAA servers are common; retry with backoff
            print(f"  retry {attempt}/{tries} {os.path.basename(dest)}: {exc}", flush=True)
            time.sleep(10 * attempt)
    raise RuntimeError(f"failed to download {url}")


def ibtracs():
    out = os.path.join(EXT, "ibtracs")
    os.makedirs(out, exist_ok=True)
    for basin in ("NI", "SI"):
        dest = os.path.join(out, f"ibtracs.{basin}.list.v04r01.csv")
        n = _get(IBTRACS_URL.format(basin=basin), dest)
        print(f"ibtracs {basin}: {n:,} bytes")


def _oisst_month(year: int, month: int, out: str, today: dt.date) -> str:
    # Whole-year requests time out at the PSL proxy (HTTP 502), so fetch one month per request.
    dest = os.path.join(out, f"oisst_{year}{month:02d}.nc")
    first = dt.date(year, month, 1)
    month_end = (first + dt.timedelta(days=32)).replace(day=1) - dt.timedelta(days=1)
    last = min(month_end, today)
    if last == month_end and os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return f"= {year}-{month:02d}"
    url = OISST_NCSS.format(year=year, n=NORTH, s=SOUTH, w=WEST, e=EAST, t0=first.isoformat(), t1=last.isoformat())
    n = _get(url, dest, timeout=900)
    return f"oisst {year}-{month:02d}: {n:,} bytes"


def oisst(years=None, workers: int = 8):
    out = os.path.join(EXT, "oisst")
    os.makedirs(out, exist_ok=True)
    today = dt.date.today()
    years = years or list(range(OISST_FIRST_YEAR, today.year + 1))
    months = [(y, m) for y in years for m in range(1, 13) if dt.date(y, m, 1) <= today]
    with ThreadPoolExecutor(workers) as pool:
        for msg in pool.map(lambda ym: _oisst_month(ym[0], ym[1], out, today), months):
            print(msg, flush=True)


# Global Drifter Program, 6-hourly interpolated, AOML ERDDAP. Near-real-time rows are
# included up to the most recent quality-controlled update.
GDP_URL = ("https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.csv"
           "?ID,time,latitude,longitude,ve,vn,drogue_lost_date"
           "&time>={t0}&time<={t1}&latitude>={s}&latitude<={n}&longitude>={w}&longitude<={e}")


def drifters(start: str, end: str):
    out = os.path.join(EXT, "drifters")
    os.makedirs(out, exist_ok=True)
    dest = os.path.join(out, f"gdp_6h_{start}_{end}.csv")
    url = GDP_URL.format(t0=start, t1=end, s=SOUTH, n=NORTH, w=WEST, e=EAST)
    n = _get(url, dest, timeout=1800)
    print(f"drifters {start}..{end}: {n:,} bytes")


# CMEMS products (Copernicus Marine, free account). Daily fields over a rolling window.
CMEMS = {
    # Global analysis & forecast, 1/12 deg: total surface currents (incl. Ekman + tides removed daily mean)
    "currents": dict(dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", variables=["uo", "vo"],
                     minimum_depth=0.0, maximum_depth=1.0),
    # Global wave analysis & forecast: surface Stokes drift
    "stokes": dict(dataset_id="cmems_mod_glo_wav_anfc_0.083deg_PT3H-i", variables=["VSDX", "VSDY"]),
    # Global ocean L4 wind (scatterometer-blended, ERA5-based), hourly 0.125 deg
    "wind": dict(dataset_id="cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H",
                 variables=["eastward_wind", "northward_wind"]),
    # Global analysis & forecast potential temperature, 0-300 m (for the 26 C isotherm / TCHP)
    "thetao": dict(dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", variables=["thetao"],
                   minimum_depth=0.0, maximum_depth=300.0),
}


def cmems(start: str, end: str, which=None):
    if not (os.getenv("COPERNICUSMARINE_SERVICE_USERNAME") and os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD")):
        sys.exit("CMEMS needs COPERNICUSMARINE_SERVICE_USERNAME and COPERNICUSMARINE_SERVICE_PASSWORD")
    import copernicusmarine as cm

    out = os.path.join(EXT, "cmems")
    os.makedirs(out, exist_ok=True)
    for name, spec in CMEMS.items():
        if which and name not in which:
            continue
        spec = dict(spec)
        fname = f"{name}_{start}_{end}.nc"
        print(f"cmems {name} -> {fname}", flush=True)
        cm.subset(minimum_longitude=WEST, maximum_longitude=EAST, minimum_latitude=SOUTH, maximum_latitude=NORTH,
                  start_datetime=f"{start}T00:00:00", end_datetime=f"{end}T23:59:59",
                  output_directory=out, output_filename=fname, overwrite=True, **spec)


# HYCOM ESPC-D-V02 (US Navy global 1/12 deg analysis, Aug 2024 - present), public NCSS, no login.
# Used in place of CMEMS when no Copernicus account is available: total surface currents
# (ssu/ssv, hourly) and 3-D temperature (water_temp, 3-hourly) for the 26 C isotherm.
HYCOM_NCSS = "https://ncss.hycom.org/thredds/ncss/ESPC-D-V02/{coll}"
HYCOM_BOX = dict(north=NORTH, south=SOUTH, west=WEST, east=EAST)


def _hycom(coll: str, variables, t0: str, t1: str, dest: str, time_stride: int = 1, horiz_stride: int = 2,
           vert=None):
    params = [("var", v) for v in variables] + [(k, v) for k, v in HYCOM_BOX.items()] + [
        ("horizStride", horiz_stride), ("timeStride", time_stride),
        ("time_start", t0), ("time_end", t1), ("accept", "netcdf4")]
    if vert is not None:
        params.append(("vertCoord", vert))
    url = HYCOM_NCSS.format(coll=coll) + "?" + "&".join(f"{k}={v}" for k, v in params)
    n = _get(url, dest, timeout=3600)
    print(f"hycom {os.path.basename(dest)}: {n:,} bytes", flush=True)


def hycom_currents(start: str, end: str, time_stride: int = 3):
    """Hourly surface currents, subsampled every `time_stride` hours, one file per day (resumable)."""
    out = os.path.join(EXT, "hycom", "currents")
    os.makedirs(out, exist_ok=True)
    d, d1 = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    days = []
    while d <= d1:
        days.append(d)
        d += dt.timedelta(days=1)

    def one(day):
        dest = os.path.join(out, f"uv_{day.isoformat()}.nc")
        if os.path.isfile(dest) and os.path.getsize(dest) > 0:
            return
        _hycom("ice", ["ssu", "ssv"], f"{day}T00:00:00Z", f"{day}T23:00:00Z", dest, time_stride=time_stride)

    with ThreadPoolExecutor(3) as pool:
        list(pool.map(one, days))


HYCOM_DAP = "https://tds.hycom.org/thredds/dodsC/ESPC-D-V02/t3z/{year}"
T3Z_MAX_DEPTH_M = 300.0


def hycom_temperature(days):
    """Daily 00Z 3-D temperature, 0-300 m, every 2nd grid point, via OPeNDAP (the NCSS 3-D endpoint times out)."""
    import netCDF4 as nc
    import numpy as np
    out = os.path.join(EXT, "hycom", "t3z")
    os.makedirs(out, exist_ok=True)
    for day in days:
        dest = os.path.join(out, f"t3z_{day}.nc")
        if os.path.isfile(dest) and os.path.getsize(dest) > 0:
            continue
        for attempt in range(1, 4):
            try:
                src = nc.Dataset(HYCOM_DAP.format(year=day[:4]))
                t = src["time"]
                tt = [x.strftime("%Y-%m-%dT%H") for x in nc.num2date(t[:], t.units)]
                if f"{day}T00" not in tt:
                    print(f"hycom t3z {day}: not in the HYCOM record", flush=True)
                    src.close()
                    break
                k = tt.index(f"{day}T00")
                lat, lon, dep = src["lat"][:], src["lon"][:], src["depth"][:]
                j = np.where((lat >= SOUTH) & (lat <= NORTH))[0]
                i = np.where((lon >= WEST) & (lon <= EAST))[0]
                kz = np.where(dep <= T3Z_MAX_DEPTH_M)[0]
                js, is_ = slice(j[0], j[-1] + 1, 2), slice(i[0], i[-1] + 1, 2)
                temp = src["water_temp"][k, kz[0]:kz[-1] + 1, js, is_]
                tmp = dest + ".part"
                with nc.Dataset(tmp, "w", format="NETCDF4") as o:
                    o.createDimension("time", 1)
                    o.createDimension("depth", len(kz))
                    o.createDimension("lat", temp.shape[1])
                    o.createDimension("lon", temp.shape[2])
                    tv = o.createVariable("time", "f8", ("time",))
                    tv.units = t.units
                    tv[:] = [t[k]]
                    o.createVariable("depth", "f4", ("depth",))[:] = dep[kz]
                    o.createVariable("lat", "f4", ("lat",))[:] = lat[js]
                    o.createVariable("lon", "f4", ("lon",))[:] = lon[is_]
                    v = o.createVariable("water_temp", "f4", ("time", "depth", "lat", "lon"), zlib=True,
                                         fill_value=np.float32(np.nan))
                    v.units = "degC"
                    v[0] = np.ma.filled(temp.astype("f4"), np.nan)
                    o.source = "HYCOM ESPC-D-V02 t3z via OPeNDAP " + HYCOM_DAP.format(year=day[:4])
                src.close()
                os.replace(tmp, dest)
                print(f"hycom t3z {day}: {os.path.getsize(dest):,} bytes", flush=True)
                break
            except Exception as exc:
                print(f"  retry {attempt}/3 t3z {day}: {exc}", flush=True)
                time.sleep(20 * attempt)


# NCEP/NCAR Reanalysis (NOAA PSL), public NCSS. R2 6-hourly 10 m wind for leeway/windage;
# R1 monthly pressure-level fields for the Emanuel & Nolan (2004) Genesis Potential Index,
# which was itself defined on NCEP R1.
PSL_NCSS = "https://psl.noaa.gov/thredds/ncss/grid/Datasets/{path}"


def _psl(path: str, var: str, t0: str, t1: str, dest: str, extra: str = ""):
    url = (PSL_NCSS.format(path=path) + f"?var={var}&north={NORTH + 5}&south={SOUTH - 5}&west={WEST - 5}"
           f"&east={EAST + 5}&horizStride=1&time_start={t0}T00:00:00Z&time_end={t1}T23:59:59Z&accept=netcdf4{extra}")
    n = _get(url, dest, timeout=1800)
    print(f"psl {os.path.basename(dest)}: {n:,} bytes", flush=True)


# NCEP GFS 0.25 deg (UCAR Unidata THREDDS "Best" time series: recent analyses + forecast to +16 d).
# NCEP R2 stopped updating in early 2026, so recent windows use GFS 10 m wind.
GFS_NCSS = ("https://thredds.ucar.edu/thredds/ncss/grid/grib/NCEP/GFS/Global_0p25deg/Best"
            "?var=u-component_of_wind_height_above_ground&var=v-component_of_wind_height_above_ground"
            "&north={n}&south={s}&west={w}&east={e}&horizStride=1&time_start={t0}&time_end={t1}"
            "&vertCoord=10&accept=netcdf4")


def gfs_winds(start: str, end: str):
    """One file per day (multi-day requests are cut off by the UCAR server)."""
    out = os.path.join(EXT, "gfs")
    os.makedirs(out, exist_ok=True)
    d, d1 = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    while d <= d1:
        dest = os.path.join(out, f"gfs10m_{d}.nc")
        if not (os.path.isfile(dest) and os.path.getsize(dest) > 0):
            url = GFS_NCSS.format(n=NORTH + 2, s=SOUTH - 2, w=WEST - 2, e=EAST + 2, t0=f"{d}T00:00:00Z",
                                  t1=f"{d}T23:59:59Z")
            try:
                n = _get(url, dest, timeout=900)
                print(f"gfs {os.path.basename(dest)}: {n:,} bytes", flush=True)
            except RuntimeError as exc:  # days past the end of the forecast are simply absent
                print(f"gfs {d}: {exc}", flush=True)
        d += dt.timedelta(days=1)


def ncep_winds(start: str, end: str):
    out = os.path.join(EXT, "ncep")
    os.makedirs(out, exist_ok=True)
    y0, y1 = int(start[:4]), int(end[:4])
    for year in range(y0, y1 + 1):
        t0 = max(start, f"{year}-01-01")
        t1 = min(end, f"{year}-12-31")
        for comp in ("uwnd", "vwnd"):
            _psl(f"ncep.reanalysis2/gaussian_grid/{comp}.10m.gauss.{year}.nc", comp, t0, t1,
                 os.path.join(out, f"{comp}10m_{t0}_{t1}.nc"))


GPI_FIELDS = {  # (path, variable) on NCEP R1 monthly means
    "uwnd": "ncep.reanalysis.derived/pressure/uwnd.mon.mean.nc",
    "vwnd": "ncep.reanalysis.derived/pressure/vwnd.mon.mean.nc",
    "air": "ncep.reanalysis.derived/pressure/air.mon.mean.nc",
    "shum": "ncep.reanalysis.derived/pressure/shum.mon.mean.nc",
    "rhum": "ncep.reanalysis.derived/pressure/rhum.mon.mean.nc",
    "slp": "ncep.reanalysis.derived/surface/slp.mon.mean.nc",
}


def ncep_gpi(start: str, end: str):
    """NCEP R1 monthly means in 10-year chunks (whole-record requests are cut off by the server)."""
    out = os.path.join(EXT, "ncep", "r1mon")
    os.makedirs(out, exist_ok=True)
    y0, y1 = int(start[:4]), int(end[:4])
    for var, path in GPI_FIELDS.items():
        for c0 in range(y0, y1 + 1, 10):
            c1 = min(y1, c0 + 9)
            dest = os.path.join(out, f"{var}_{c0}_{c1}.nc")
            if os.path.isfile(dest) and os.path.getsize(dest) > 0 and c1 < dt.date.today().year:
                continue
            _psl(path, var, f"{c0}-01-01", min(end, f"{c1}-12-31"), dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["ibtracs", "oisst", "drifters", "cmems", "hycom", "hycom-t", "winds", "gfs", "gpi",
                                     "all"])
    ap.add_argument("--years", nargs="*", type=int, help="oisst: just these years")
    ap.add_argument("--start", help="drifters/cmems window start YYYY-MM-DD")
    ap.add_argument("--end", help="drifters/cmems window end YYYY-MM-DD")
    ap.add_argument("--only", nargs="*", help="cmems: subset of " + ", ".join(CMEMS))
    args = ap.parse_args()
    today = dt.date.today()
    end = args.end or today.isoformat()
    start = args.start or (today - dt.timedelta(days=30)).isoformat()
    if args.what in ("ibtracs", "all"):
        ibtracs()
    if args.what in ("oisst", "all"):
        oisst(args.years)
    if args.what in ("drifters", "all"):
        drifters(start, end)
    if args.what in ("hycom", "all"):
        hycom_currents(start, end)
    if args.what in ("hycom-t", "all"):
        d0, d1 = dt.date.fromisoformat(args.start or end), dt.date.fromisoformat(end)
        hycom_temperature([(d0 + dt.timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1)])
    if args.what in ("winds", "all"):
        ncep_winds(start, end)
    if args.what == "gfs":
        gfs_winds(start, end)
    if args.what == "gpi":
        ncep_gpi(start, end)
    if args.what == "cmems":
        cmems(start, end, args.only)


if __name__ == "__main__":
    main()
