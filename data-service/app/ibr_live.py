"""
On-demand INCOIS Bio-ROMS (IBR) display tiles for EVERY monthly timestep in the source file.

scripts/build_authentic_dataset.py exports one year (--ibr-year, default 2019) as static
tiles. This module serves the rest of the record (1980-01 .. 2019-12, 480 steps) from the
same source file, located by app.model_store (local datasets/ copy, else Hugging Face
byte-range reads), using the identical regridding: bilinear from the native grid to the
served 0.125 deg cell-centre grid, NaN wherever any corner is NaN (no extrapolation).

Generated tiles are written once to $VOLUME_CACHE_DIR/ibr_tiles/<var>/<date>/0.0.bin in
the standard 32-byte INCO format and reused afterwards.

Disable with IBR_LIVE_TILES=0 (the catalog then falls back to the static export only).
"""
from __future__ import annotations

import logging
import os
import struct
import tempfile
import threading
import time
from typing import Any, Callable, Dict, List, Optional

import numpy as np

from app import model_store as ms

log = logging.getLogger("ibr_live")

IBR_FILE = os.getenv("IBR_FILENAME", "INCOIS-BIO-ROMS.nc")
ENABLED = os.getenv("IBR_LIVE_TILES", "1") != "0"
TILE_DIR = os.path.join(
    os.getenv("VOLUME_CACHE_DIR", os.path.join(tempfile.gettempdir(), "incois_volume_cache")), "ibr_tiles")
RETRY_AFTER_S = 300

_lock = threading.Lock()
_state: Dict[str, Any] = {"times": None, "error": None, "failed_at": 0.0}
_regrid: Dict[str, Callable[[np.ndarray], np.ndarray]] = {}


def _decode_times(r: ms.Reader) -> Dict[str, int]:
    tv = r.variables.get("TIME")
    if tv is None:
        raise ms.StoreError(f"{IBR_FILE} has no TIME variable", 500)
    import cftime
    vals = ms.decode(np.asarray(r.read("TIME", (slice(None),))), tv.attrs).astype(np.float64)
    dates = cftime.num2date(vals, str(tv.attrs["units"]), calendar=str(tv.attrs.get("calendar", "standard")))
    return {d.strftime("%Y-%m-%d"): i for i, d in enumerate(np.atleast_1d(dates))}


def timesteps() -> Optional[Dict[str, int]]:
    """{'YYYY-MM-DD': time index} for the whole source record, or None when the file is unreachable."""
    if not ENABLED:
        return None
    with _lock:
        if _state["times"] is not None:
            return _state["times"]
        if _state["error"] and time.time() - _state["failed_at"] < RETRY_AFTER_S:
            return None
    try:
        with ms.file_lock(IBR_FILE):
            times = _decode_times(ms.open_reader(IBR_FILE))
    except Exception as exc:  # network, missing file, missing dependency
        log.warning("IBR full record unavailable, serving the static export only: %s", exc)
        with _lock:
            _state.update(error=str(exc), failed_at=time.time())
        return None
    with _lock:
        _state.update(times=times, error=None)
    log.info("IBR full record: %d timesteps %s .. %s", len(times), min(times), max(times))
    return times


def status() -> Dict[str, Any]:
    t = _state["times"]
    return {"enabled": ENABLED, "file": IBR_FILE, "timesteps": len(t) if t else 0, "error": _state["error"]}


def _regridder(r: ms.Reader, grid: Dict[str, Any]):
    key = f"{grid['lon0']}|{grid['lat0']}|{grid['dlon']}|{grid['dlat']}|{grid['width']}|{grid['height']}"
    if key in _regrid:
        return _regrid[key]
    from scipy.interpolate import RegularGridInterpolator

    lat = ms.decode(np.asarray(r.read("LAT", (slice(None),))), r.variables["LAT"].attrs).astype(float)
    lon = ms.decode(np.asarray(r.read("LON", (slice(None),))), r.variables["LON"].attrs).astype(float)
    tgt_lons = grid["lon0"] + grid["dlon"] * np.arange(grid["width"])
    tgt_lats = grid["lat0"] + grid["dlat"] * np.arange(grid["height"])
    j0 = max(0, int(np.searchsorted(lat, tgt_lats[0])) - 2)
    j1 = min(len(lat), int(np.searchsorted(lat, tgt_lats[-1])) + 2)
    i0 = max(0, int(np.searchsorted(lon, tgt_lons[0])) - 2)
    i1 = min(len(lon), int(np.searchsorted(lon, tgt_lons[-1])) + 2)
    glat, glon = np.meshgrid(tgt_lats, tgt_lons, indexing="ij")
    sub_lat, sub_lon = lat[j0:j1], lon[i0:i1]

    def regrid(read_window: Callable[[slice, slice], np.ndarray]) -> np.ndarray:
        field = read_window(slice(j0, j1), slice(i0, i1))
        interp = RegularGridInterpolator((sub_lat, sub_lon), field, method="linear",
                                         bounds_error=False, fill_value=np.nan)
        return interp((glat, glon)).astype(np.float32)

    _regrid[key] = regrid
    return regrid


def _pack(var_code: int, data: np.ndarray) -> bytes:
    data = np.asarray(data, dtype="<f4")
    h, w = data.shape
    valid = data[np.isfinite(data)]
    vmin, vmax = (float(valid.min()), float(valid.max())) if valid.size else (float("nan"), float("nan"))
    header = struct.pack("<4sHHHHHHff8s", b"INCO", 1, var_code, w, h, 1, 1, vmin, vmax, b"\x00" * 8)
    return header + data.tobytes()


def _path(variable: str, date: str) -> str:
    return os.path.join(TILE_DIR, variable, date, "0.0.bin")


def cached_tile_path(variable: str, date: str) -> Optional[str]:
    p = _path(variable, date)
    return p if os.path.isfile(p) else None


def tile_path(variable: str, date: str, meta: Dict[str, Any], grid: Dict[str, Any]) -> Optional[str]:
    """Path of the surface tile for (variable, date), generating it from the source if needed.
    Raises ms.StoreError when the source cannot be read."""
    p = cached_tile_path(variable, date)
    if p:
        return p
    times = timesteps()
    if not times or date not in times:
        return None
    src = meta.get("source_variable")
    if not src:
        return None
    scale = 1.0e6 if "1e6" in str(meta.get("unit_conversion") or "") else 1.0

    with ms.file_lock(IBR_FILE):
        r = ms.open_reader(IBR_FILE)
        v = r.variables.get(src)
        if v is None:
            raise ms.StoreError(f"{IBR_FILE} has no variable '{src}'", 500)
        regrid = _regridder(r, grid)
    k = times[date]
    # read_array fetches the chunks in parallel outside the file lock (remote HDF5).
    tile = regrid(lambda js, is_: ms.decode(ms.read_array(IBR_FILE, src, (k, js, is_))[0], v.attrs).astype(float) * scale)

    out = _path(variable, date)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = f"{out}.{os.getpid()}.{threading.get_ident()}.tmp"
    with open(tmp, "wb") as f:
        f.write(_pack(int(meta["var_code"]), tile))
    os.replace(tmp, out)
    return out


WARM_VARIABLES = [v for v in os.getenv("IBR_WARM_VARIABLES", "SST,SSS,CHL,MLD").split(",") if v]


def _warm() -> None:
    if not timesteps():
        return
    # Chunk indexes make every later read of these variables pure parallel range requests.
    for name in WARM_VARIABLES:
        try:
            ms.chunk_index(IBR_FILE, name)
        except Exception as exc:  # local copy / netCDF3 / network: reads fall back to h5py
            log.info("chunk index for %s not built: %s", name, exc)


def warm_up() -> None:
    threading.Thread(target=_warm, name="ibr-warmup", daemon=True).start()
