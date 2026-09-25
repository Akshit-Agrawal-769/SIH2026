"""
/api/v1/model/* — gridded model volumes for the Volumetric Studio.

  GET /api/v1/model/datasets
  GET /api/v1/model/metadata?filename=INCOIS-BIO-ROMS.nc
  GET /api/v1/model/volume3d?filename=INCOIS-BIO-ROMS.nc&variable=temp[&stride&z_start&z_count&time_index]

The volume is little-endian Float32, C-order (z, lat, lon) — lon varies fastest —
NaN where the source is fill / land. Its shape is exactly metadata.dims for the same
sampling parameters and is echoed in the X-Volume-Shape header.

Z axis: the variable's depth dimension when it has more than one level; otherwise
its time dimension (a lon x lat x time cube). INCOIS-BIO-ROMS.nc is surface-only
(TIME x LAT x LON), so it is served as a monthly space-time cube. The axis in use is
reported as `z_axis`; nothing is interpolated or invented.
"""
from __future__ import annotations

import glob
import hashlib
import math
import os
import tempfile
import threading
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response

from app import model_store as ms

router = APIRouter(prefix="/v1/model", tags=["model-volume"])

MAX_SLAB_VOXELS = int(os.getenv("VOLUME_MAX_SLAB_VOXELS", "120000"))  # per z level, after stride
MAX_TOTAL_VOXELS = int(os.getenv("VOLUME_MAX_TOTAL_VOXELS", "16000000"))
DEFAULT_TIME_COUNT = int(os.getenv("VOLUME_DEFAULT_TIME_COUNT", "24"))
MAX_Z = 256
CACHE_DIR = os.getenv("VOLUME_CACHE_DIR", os.path.join(tempfile.gettempdir(), "incois_volume_cache"))

LON = {"lon", "longitude", "x", "xi_rho", "xi_u", "xi_v", "nav_lon", "xt_ocean", "xu_ocean", "nlon"}
LAT = {"lat", "latitude", "y", "eta_rho", "eta_u", "eta_v", "nav_lat", "yt_ocean", "yu_ocean", "nlat"}
DEPTH = {"depth", "deptht", "depthu", "depthv", "lev", "level", "z", "s_rho", "s_w", "st_ocean", "sw_ocean", "zt", "zlev"}
TIME = {"time", "t", "ocean_time", "time_counter", "mt"}


def _err(exc: ms.StoreError):
    return HTTPException(status_code=exc.status, detail=str(exc))


# --------------------------------------------------------------------------- axis inspection

def _axis_of(dim: str, r: ms.Reader) -> Optional[str]:
    n = dim.lower()
    if n in LON:
        return "lon"
    if n in LAT:
        return "lat"
    if n in DEPTH:
        return "depth"
    if n in TIME:
        return "time"
    cv = r.variables.get(dim)
    if cv is None:
        return None
    a = cv.attrs
    axis = str(a.get("axis", "")).upper()
    units = str(a.get("units", "")).lower()
    std = str(a.get("standard_name", "")).lower()
    if axis == "X" or units in ("degrees_east", "degree_east", "degrees_e") or std == "longitude":
        return "lon"
    if axis == "Y" or units in ("degrees_north", "degree_north", "degrees_n") or std == "latitude":
        return "lat"
    if axis == "T" or " since " in units or std == "time":
        return "time"
    if axis == "Z" or "positive" in a or std in ("depth", "ocean_s_coordinate_g2"):
        return "depth"
    return None


def _signature(v: ms.VarInfo, r: ms.Reader) -> Optional[Tuple[str, ...]]:
    """Axis names per dim if the variable is volumetric (…, lat, lon with a >1 depth or time axis)."""
    if len(v.dims) < 3 or v.dtype.kind not in "iuf":
        return None
    axes = tuple(_axis_of(d, r) for d in v.dims)
    if axes[-2:] != ("lat", "lon") or any(a is None for a in axes[:-2]):
        return None
    lead = dict(zip(axes[:-2], v.shape[:-2]))
    if len(lead) != len(axes) - 2:
        return None  # duplicated axis kinds
    if lead.get("depth", 1) > 1 or lead.get("time", 1) > 1:
        return axes
    return None


def _z_axis(axes: Tuple[str, ...], shape: Tuple[int, ...]) -> str:
    lead = dict(zip(axes[:-2], shape[:-2]))
    return "depth" if lead.get("depth", 1) > 1 else "time"


def _coord(r: ms.Reader, dim: str) -> Optional[np.ndarray]:
    cv = r.variables.get(dim)
    if cv is None or len(cv.dims) != 1:
        return None
    return ms.decode(np.asarray(r.read(dim, (slice(None),))), cv.attrs).astype(np.float64)


def _time_labels(r: ms.Reader, dim: str, vals: np.ndarray) -> List[str]:
    cv = r.variables.get(dim)
    units = str(cv.attrs.get("units", "")) if cv else ""
    if " since " in units:
        try:
            import cftime
            dates = cftime.num2date(vals, units, calendar=str(cv.attrs.get("calendar", "standard")))
            return [d.isoformat()[:10] for d in np.atleast_1d(dates)]
        except Exception:
            pass
    return [f"t={v:g}" for v in vals]


# --------------------------------------------------------------------------- dataset probing

_probe_cache: Dict[str, Dict[str, Any]] = {}
_probe_lock = threading.Lock()


def _probe(filename: str) -> Dict[str, Any]:
    key = f"{filename}|{ms.source_fingerprint(filename)}"
    with _probe_lock:
        if key in _probe_cache:
            return _probe_cache[key]
    with ms.file_lock(filename):
        r = ms.open_reader(filename)
        groups: Dict[Tuple[Tuple[str, ...], Tuple[int, ...], Tuple[str, ...]], List[str]] = {}
        for name, v in r.variables.items():
            if name in v.dims:
                continue  # coordinate variable
            sig = _signature(v, r)
            if sig:
                groups.setdefault((v.dims, v.shape, sig), []).append(name)
    if not groups:
        info = {"volumetric": False, "source": r.source, "format": r.fmt,
                "reason": "no variable with lat/lon plus a depth or time axis longer than 1"}
    else:
        (dims, shape, axes), names = max(groups.items(), key=lambda kv: len(kv[1]))
        info = {"volumetric": True, "source": r.source, "format": r.fmt, "dims": dims, "shape": shape,
                "axes": axes, "variables": names, "z_axis": _z_axis(axes, shape)}
    with _probe_lock:
        _probe_cache[key] = info
    return info


def _candidate_files() -> Tuple[Dict[str, Dict[str, Any]], Optional[str]]:
    files: Dict[str, Dict[str, Any]] = {}
    for d in ms._local_dirs():
        for p in glob.glob(os.path.join(d, "*.nc")) + glob.glob(os.path.join(d, "*.nc4")):
            files.setdefault(os.path.basename(p), {"size": os.path.getsize(p), "location": "local"})
    hf_error = None
    try:
        for e in ms.hf_listing():
            if e["filename"].endswith((".nc", ".nc4")):
                files.setdefault(e["filename"], {"size": e["size"], "location": "huggingface"})
    except ms.StoreError as exc:
        hf_error = str(exc)
    return files, hf_error


# --------------------------------------------------------------------------- sampling

def _sampling(info: Dict[str, Any], stride: Optional[int], z_start: Optional[int],
              z_count: Optional[int], time_index: Optional[int]) -> Dict[str, Any]:
    shape, axes = info["shape"], info["axes"]
    ny, nx = shape[-2], shape[-1]
    lead = dict(zip(axes[:-2], shape[:-2]))
    z_axis = info["z_axis"]
    nz_native = lead[z_axis]

    if stride is None:
        stride = 1
        while math.ceil(ny / stride) * math.ceil(nx / stride) > MAX_SLAB_VOXELS:
            stride += 1
    if stride < 1:
        raise HTTPException(400, "stride must be >= 1")

    if z_axis == "time":
        count = z_count or min(DEFAULT_TIME_COUNT, nz_native)
        start = nz_native - count if z_start is None else z_start  # default: most recent window
    else:
        count = z_count or min(nz_native, MAX_Z)
        start = z_start or 0
    count = min(count, MAX_Z)
    if start < 0 or count < 1 or start + count > nz_native:
        raise HTTPException(400, f"z window [{start}, {start + count}) is outside 0..{nz_native} of the {z_axis} axis")

    ti = None
    if z_axis == "depth" and "time" in lead:
        ti = lead["time"] - 1 if time_index is None else time_index
        if not 0 <= ti < lead["time"]:
            raise HTTPException(400, f"time_index must be within 0..{lead['time'] - 1}")

    out_nx, out_ny = math.ceil(nx / stride), math.ceil(ny / stride)
    if out_nx * out_ny * count > MAX_TOTAL_VOXELS:
        raise HTTPException(413, f"{out_nx}x{out_ny}x{count} voxels exceeds the {MAX_TOTAL_VOXELS} limit; "
                                 f"raise stride or lower z_count")
    return {"stride": stride, "z_start": start, "z_count": count, "time_index": ti,
            "nx": out_nx, "ny": out_ny, "nz": count}


def _index(info: Dict[str, Any], s: Dict[str, Any]) -> Tuple:
    key = []
    for ax in info["axes"]:
        if ax == info["z_axis"]:
            key.append(slice(s["z_start"], s["z_start"] + s["z_count"]))
        elif ax == "time":
            key.append(s["time_index"] if s["time_index"] is not None else 0)
        elif ax in ("lat", "lon"):
            key.append(slice(None, None, s["stride"]))
        else:
            key.append(0)
    return tuple(key)


# --------------------------------------------------------------------------- endpoints

@router.get("/datasets")
def list_datasets():
    """Model NetCDF files (local copies + the Hugging Face dataset) that contain a renderable volume."""
    files, hf_error = _candidate_files()
    if not files:
        raise HTTPException(503, f"No model NetCDF files found locally or on Hugging Face ({hf_error}).")
    datasets, skipped = [], []
    for fn in sorted(files, key=lambda f: (f != "INCOIS-BIO-ROMS.nc", f)):
        try:
            info = _probe(fn)
        except ms.StoreError as exc:
            skipped.append({"filename": fn, "reason": str(exc)})
            continue
        except Exception as exc:
            skipped.append({"filename": fn, "reason": f"unreadable: {exc}"})
            continue
        if info["volumetric"]:
            datasets.append({"filename": fn, "size": files[fn]["size"], "source": info["source"],
                             "format": info["format"], "z_axis": info["z_axis"], "variables": info["variables"]})
        else:
            skipped.append({"filename": fn, "reason": info["reason"]})
    return {"datasets": datasets, "skipped": skipped, "hf_repo": ms.HF_REPO, "hf_error": hf_error}


@router.get("/metadata")
def metadata(filename: str, stride: Optional[int] = Query(None), z_start: Optional[int] = Query(None),
             z_count: Optional[int] = Query(None), time_index: Optional[int] = Query(None)):
    try:
        info = _probe(filename)
        if not info["volumetric"]:
            raise HTTPException(422, f"{filename}: {info['reason']}")
        s = _sampling(info, stride, z_start, z_count, time_index)
        with ms.file_lock(filename):
            r = ms.open_reader(filename)
            dims = info["dims"]
            lon_c, lat_c = _coord(r, dims[-1]), _coord(r, dims[-2])
            z_dim = dims[info["axes"].index(info["z_axis"])]
            z_vals = _coord(r, z_dim)
            variables = []
            for n in info["variables"]:
                a = r.variables[n].attrs
                entry = {"name": n, "long_name": a.get("long_name", n), "units": a.get("units", ""),
                         "dims": list(r.variables[n].dims)}
                if hasattr(r, "storage"):
                    entry["storage"] = r.storage(n)
                variables.append(entry)
            time_dim = dims[info["axes"].index("time")] if "time" in info["axes"] else None
            time_all = _coord(r, time_dim) if time_dim else None
            z_window = slice(s["z_start"], s["z_start"] + s["z_count"])
            if info["z_axis"] == "time":
                z_labels = _time_labels(r, z_dim, z_vals[z_window]) if z_vals is not None else None
            else:
                z_labels = [f"{abs(v):g} m" for v in z_vals[z_window]] if z_vals is not None else None
            time_range = None
            if time_all is not None and time_all.size:
                ends = _time_labels(r, time_dim, np.array([time_all[0], time_all[-1]]))
                time_range = {"start": ends[0], "end": ends[1], "steps": int(time_all.size)}
            snapshot = None
            if s["time_index"] is not None and time_all is not None:
                snapshot = _time_labels(r, time_dim, time_all[[s["time_index"]]])[0]
    except ms.StoreError as exc:
        raise _err(exc)

    st = s["stride"]
    resp: Dict[str, Any] = {
        "filename": filename,
        "source": info["source"],
        "hf_repo": ms.HF_REPO if info["source"] == "huggingface" else None,
        "format": info["format"],
        "variables": variables,
        "dims": {"lon": s["nx"], "lat": s["ny"], "depth": s["nz"]},
        "native_dims": dict(zip(dims, info["shape"])),
        "z_axis": info["z_axis"],
        "z_labels": z_labels,
        "sampling": {k: s[k] for k in ("stride", "z_start", "z_count", "time_index") if s[k] is not None},
        "time_range": time_range,
        "snapshot_time": snapshot,
        "bounds": {},
    }
    if lon_c is not None:
        l = lon_c[::st]
        resp["bounds"]["lon"] = [float(l[0]), float(l[-1])]
    if lat_c is not None:
        l = lat_c[::st]
        resp["bounds"]["lat"] = [float(l[0]), float(l[-1])]
    if info["z_axis"] == "depth" and z_vals is not None:
        resp["depth_levels"] = [float(abs(v)) for v in z_vals[z_window]]
    return resp


@router.get("/volume3d")
def volume3d(filename: str, variable: str, stride: Optional[int] = Query(None),
             z_start: Optional[int] = Query(None), z_count: Optional[int] = Query(None),
             time_index: Optional[int] = Query(None)):
    try:
        info = _probe(filename)
        if not info["volumetric"]:
            raise HTTPException(422, f"{filename}: {info['reason']}")
        if variable not in info["variables"]:
            raise HTTPException(404, f"'{variable}' is not a volumetric variable of {filename}. "
                                     f"Available: {', '.join(info['variables'])}")
        s = _sampling(info, stride, z_start, z_count, time_index)
        shape = (s["nz"], s["ny"], s["nx"])
        tag = f"{filename}|{variable}|{ms.source_fingerprint(filename)}|{s}"
        cache_file = os.path.join(CACHE_DIR, hashlib.sha1(tag.encode()).hexdigest() + ".npy")

        data = None
        if os.path.isfile(cache_file):
            try:
                data = np.load(cache_file)
                if data.shape != shape:
                    data = None
            except Exception:
                data = None
        cached = data is not None
        if data is None:
            import time as _t
            t0 = _t.time()
            with ms.file_lock(filename):
                t1 = _t.time()
                r = ms.open_reader(filename)
                v = r.variables[variable]
                raw = np.asarray(r.read(variable, _index(info, s)))
            print(f"[volume3d] {filename}:{variable} {shape} lock-wait {t1 - t0:.1f}s read {_t.time() - t1:.1f}s "
                  f"({r.source})", flush=True)
            data = ms.decode(raw, v.attrs)
            if data.shape != shape:
                raise HTTPException(500, f"Read shape {data.shape} != expected {shape} for {variable}")
            try:
                os.makedirs(CACHE_DIR, exist_ok=True)
                tmp = cache_file + f".{os.getpid()}.tmp.npy"
                np.save(tmp, data)
                os.replace(tmp, cache_file)
            except OSError:
                pass
    except ms.StoreError as exc:
        raise _err(exc)

    body = np.ascontiguousarray(data, dtype="<f4").tobytes()
    return Response(
        content=body,
        media_type="application/octet-stream",
        headers={
            "X-Volume-Shape": ",".join(map(str, shape)),
            "X-Volume-Z-Axis": info["z_axis"],
            "X-Volume-Cache": "hit" if cached else "miss",
            "X-Data-Source": f"{info['source']}:{filename}",
            "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Expose-Headers": "X-Volume-Shape, X-Volume-Z-Axis, X-Data-Source",
        },
    )
