"""
Model NetCDF store: finds the authentic model files and reads sub-volumes from them.

Resolution order for a filename (first hit wins):
  1. A local copy:  $MODEL_NETCDF_DIR, datasets/model/, datasets/
     (populate with `python scripts/fetch_hf_datasets.py`).
  2. The Hugging Face dataset repo  $HF_DATASET_REPO  (default ScaryCobra/incois),
     read lazily with HTTP byte ranges. Only the header and the requested
     slabs are transferred; the 9.2 GB INCOIS-BIO-ROMS.nc is never downloaded whole.

Both NetCDF-4/HDF5 (via h5netcdf) and NetCDF-3 classic / 64-bit offset / CDF-5
(via the range reader below) are supported remotely. Local files use netCDF4.

All readers return RAW stored values; `decode()` applies _FillValue /
missing_value -> NaN and scale_factor / add_offset uniformly.
"""
from __future__ import annotations

import os
import struct
import threading
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

HF_REPO = os.getenv("HF_DATASET_REPO", "ScaryCobra/incois")
HF_REVISION = os.getenv("HF_DATASET_REVISION", "main")
HF_BLOCK_SIZE = int(os.getenv("HF_BLOCK_SIZE", str(4 * 1024 * 1024)))


def _local_dirs() -> List[str]:
    dirs = []
    env = os.getenv("MODEL_NETCDF_DIR")
    if env:
        dirs.append(os.path.abspath(env))
    dirs += [
        os.path.join(REPO_ROOT, "datasets", "model"),
        os.path.join(REPO_ROOT, "datasets"),
        "/app/datasets/model",
        "/app/datasets",
    ]
    return dirs


class StoreError(Exception):
    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.status = status


# --------------------------------------------------------------------------- common interface

class VarInfo:
    __slots__ = ("name", "dims", "shape", "attrs", "dtype")

    def __init__(self, name, dims, shape, attrs, dtype):
        self.name = name
        self.dims = tuple(dims)
        self.shape = tuple(int(s) for s in shape)
        self.attrs = dict(attrs)
        self.dtype = np.dtype(dtype)


class Reader:
    source: str  # "local" | "huggingface"
    fmt: str
    variables: Dict[str, VarInfo]

    def read(self, name: str, key: Tuple) -> np.ndarray:  # raw values
        raise NotImplementedError

    def close(self) -> None:
        pass


def _clean_attr(v: Any) -> Any:
    if isinstance(v, bytes):
        return v.decode("utf-8", "ignore")
    if isinstance(v, np.ndarray):
        if v.dtype.kind in "SU":
            return "".join(x.decode() if isinstance(x, bytes) else str(x) for x in v.ravel())
        return v.item() if v.size == 1 else v.tolist()
    if isinstance(v, np.generic):
        return v.item()
    return v


class LocalNetCDF4Reader(Reader):
    def __init__(self, path: str):
        import netCDF4
        self.ds = netCDF4.Dataset(path, "r")
        self.ds.set_auto_maskandscale(False)
        self.source = "local"
        self.fmt = self.ds.data_model
        self.variables = {
            n: VarInfo(n, v.dimensions, v.shape, {k: _clean_attr(v.getncattr(k)) for k in v.ncattrs()}, v.dtype)
            for n, v in self.ds.variables.items()
            if v.dtype is not str
        }

    def read(self, name, key):
        return np.asarray(self.ds.variables[name][key])

    def close(self):
        self.ds.close()


class H5Reader(Reader):
    """NetCDF-4 (HDF5) over any seekable file object."""

    def __init__(self, fobj, source: str):
        import h5netcdf
        self.f = fobj
        self.ds = h5netcdf.File(fobj, "r", decode_vlen_strings=False)
        self.source = source
        self.fmt = "NETCDF4"
        self.variables = {}
        for n, v in self.ds.variables.items():
            try:
                self.variables[n] = VarInfo(n, v.dimensions, v.shape,
                                            {k: _clean_attr(a) for k, a in v.attrs.items()}, v.dtype)
            except Exception:
                continue  # string / compound variables are irrelevant here

    def read(self, name, key):
        return np.asarray(self.ds.variables[name][key])

    def chunks(self, name):
        try:
            return self.ds.variables[name].chunks
        except Exception:
            return None

    def storage(self, name) -> Dict[str, Any]:
        """HDF5 layout of a variable (chunk shape, filters) - decides how much a slab read costs."""
        try:
            h5 = self.ds.variables[name]._h5ds
            return {"chunks": h5.chunks, "compression": h5.compression, "compression_opts": h5.compression_opts,
                    "shuffle": h5.shuffle, "dtype": str(h5.dtype), "stored_bytes": int(h5.id.get_storage_size())}
        except Exception as exc:
            return {"error": str(exc)}

    def close(self):
        try:
            self.ds.close()
        finally:
            self.f.close()


# ---- NetCDF-3 classic / 64-bit offset / CDF-5 range reader --------------------------------

_NC3_TYPES = {1: ">i1", 2: "S1", 3: ">i2", 4: ">i4", 5: ">f4", 6: ">f8",
              7: ">u1", 8: ">u2", 9: ">u4", 10: ">i8", 11: ">u8"}


class NC3Reader(Reader):
    def __init__(self, fobj, source: str):
        self.f = fobj
        self.source = source
        fobj.seek(0)
        magic = fobj.read(4)
        if magic[:3] != b"CDF" or magic[3] not in (1, 2, 5):
            raise StoreError("Not a NetCDF-3 file", 415)
        self.version = magic[3]
        self.fmt = {1: "NETCDF3_CLASSIC", 2: "NETCDF3_64BIT_OFFSET", 5: "NETCDF3_64BIT_DATA"}[self.version]
        nn = ">q" if self.version == 5 else ">i"
        off = ">q" if self.version in (2, 5) else ">i"

        def rd(fmt):
            n = struct.calcsize(fmt)
            return struct.unpack(fmt, fobj.read(n))[0]

        def rname():
            n = rd(nn)
            s = fobj.read(n)
            fobj.read((-n) % 4)
            return s.decode("utf-8", "ignore")

        def ratts():
            tag, n = rd(">i"), rd(nn)
            out = {}
            if tag == 0:
                return out
            for _ in range(n):
                name = rname()
                t = rd(">i")
                cnt = rd(nn)
                dt = np.dtype(_NC3_TYPES[t])
                raw = fobj.read(cnt * dt.itemsize)
                fobj.read((-(cnt * dt.itemsize)) % 4)
                if t == 2:
                    out[name] = raw.rstrip(b"\x00").decode("utf-8", "ignore")
                else:
                    arr = np.frombuffer(raw, dt)
                    out[name] = arr[0].item() if cnt == 1 else arr.tolist()
            return out

        numrecs = rd(nn)
        tag, ndims = rd(">i"), rd(nn)
        self.dims: List[Tuple[str, int]] = []
        for _ in range(ndims if tag else 0):
            self.dims.append((rname(), rd(nn)))
        self.global_attrs = ratts()
        self.rec_dim = next((i for i, (_, s) in enumerate(self.dims) if s == 0), None)
        if numrecs in (0xFFFFFFFF, -1):
            raise StoreError("Streaming NetCDF-3 files (numrecs unknown) are not supported", 415)
        self.numrecs = numrecs

        tag, nvars = rd(">i"), rd(nn)
        self._layout: Dict[str, Tuple[int, bool, np.dtype]] = {}
        self.variables = {}
        rec_vsizes = []
        for _ in range(nvars if tag else 0):
            name = rname()
            nd = rd(nn)
            dimids = [rd(nn) for _ in range(nd)]
            atts = ratts()
            t = rd(">i")
            vsize = rd(nn)
            begin = rd(off)
            dt = np.dtype(_NC3_TYPES[t])
            dims = [self.dims[i][0] for i in dimids]
            shape = [self.numrecs if i == self.rec_dim else self.dims[i][1] for i in dimids]
            is_rec = bool(dimids) and dimids[0] == self.rec_dim
            if is_rec:
                rec_vsizes.append(vsize)
            self._layout[name] = (begin, is_rec, dt)
            if t != 2:
                self.variables[name] = VarInfo(name, dims, shape, atts, dt)
        if len(rec_vsizes) == 1:
            only = next(n for n, (_, r, _) in self._layout.items() if r)
            v = self.variables.get(only)
            self.recsize = int(np.prod(v.shape[1:], dtype=np.int64)) * v.dtype.itemsize if v else rec_vsizes[0]
        else:
            self.recsize = sum(rec_vsizes)

    def read(self, name, key):
        v = self.variables[name]
        begin, is_rec, dt = self._layout[name]
        if not isinstance(key, tuple):
            key = (key,)
        key = key + (slice(None),) * (len(v.shape) - len(key))
        if len(v.shape) == 0:
            self.f.seek(begin)
            return np.frombuffer(self.f.read(dt.itemsize), dt).copy()[0]
        inner = v.shape[1:]
        slab_bytes = int(np.prod(inner, dtype=np.int64)) * dt.itemsize
        stride0 = self.recsize if is_rec else slab_bytes
        first = key[0]
        idx = np.arange(v.shape[0])[first]
        scalar_first = np.ndim(idx) == 0
        idx = np.atleast_1d(idx)
        out = []
        for i in idx:
            self.f.seek(begin + int(i) * stride0)
            slab = np.frombuffer(self.f.read(slab_bytes), dt).reshape(inner)
            out.append(slab[key[1:]] if inner else slab)
        arr = np.stack(out) if out else np.empty((0,) + inner, dt)
        return arr[0] if scalar_first else arr

    def close(self):
        self.f.close()


# --------------------------------------------------------------------------- resolution / opening

_hf_fs = None
_hf_lock = threading.Lock()
_listing: Optional[List[Dict[str, Any]]] = None


def hf_fs():
    global _hf_fs
    with _hf_lock:
        if _hf_fs is None:
            try:
                from huggingface_hub import HfFileSystem
            except ImportError as exc:
                import sys
                raise StoreError(
                    f"huggingface_hub could not be imported by the Python running the data-service "
                    f"({sys.executable}): {exc}. Install into THAT interpreter: "
                    f'"{sys.executable}" -m pip install -r data-service/requirements.txt, then restart it.'
                ) from exc
            _hf_fs = HfFileSystem(token=os.getenv("HF_TOKEN") or None)
        return _hf_fs


def hf_path(filename: str) -> str:
    return f"datasets/{HF_REPO}@{HF_REVISION}/{filename}"


def hf_listing(refresh: bool = False) -> List[Dict[str, Any]]:
    """Flat listing of the HF dataset repo: [{'filename', 'size'}]."""
    global _listing
    if _listing is not None and not refresh:
        return _listing
    try:
        entries = hf_fs().ls(f"datasets/{HF_REPO}@{HF_REVISION}", detail=True)
    except StoreError:
        raise
    except Exception as exc:
        raise StoreError(f"Could not list Hugging Face dataset '{HF_REPO}': {exc}", 502) from exc
    _listing = [{"filename": e["name"].rsplit("/", 1)[-1], "size": e.get("size")}
                for e in entries if e.get("type") == "file"]
    return _listing


def local_path(filename: str) -> Optional[str]:
    if os.path.basename(filename) != filename or not filename:
        raise StoreError(f"Invalid filename '{filename}'", 400)
    for d in _local_dirs():
        p = os.path.join(d, filename)
        if os.path.isfile(p) and os.path.getsize(p) > 0:
            return p
    return None


def _open_remote(filename: str) -> Reader:
    fs = hf_fs()
    path = hf_path(filename)
    try:
        f = fs.open(path, "rb", block_size=HF_BLOCK_SIZE)
    except FileNotFoundError as exc:
        raise StoreError(f"'{filename}' is not in the Hugging Face dataset {HF_REPO}.", 404) from exc
    except Exception as exc:
        raise StoreError(f"Could not open {filename} on Hugging Face: {exc}", 502) from exc
    magic = f.read(8)
    f.seek(0)
    if magic.startswith(b"\x89HDF"):
        return H5Reader(f, "huggingface")
    if magic[:3] == b"CDF":
        return NC3Reader(f, "huggingface")
    f.close()
    raise StoreError(f"{filename} is not a NetCDF file (magic bytes {magic!r}).", 415)


_open: Dict[str, Reader] = {}
_file_locks: Dict[str, threading.Lock] = {}
_open_lock = threading.Lock()


def file_lock(filename: str) -> threading.Lock:
    with _open_lock:
        return _file_locks.setdefault(filename, threading.Lock())


def open_reader(filename: str) -> Reader:
    """Cached reader. Callers must hold file_lock(filename) while reading (HDF5 is not thread-safe)."""
    with _open_lock:
        r = _open.get(filename)
        if r is not None:
            return r
    lp = local_path(filename)
    if lp:
        try:
            r = LocalNetCDF4Reader(lp)
        except Exception as exc:
            raise StoreError(f"Local copy {lp} could not be opened: {exc}", 500) from exc
    else:
        r = _open_remote(filename)
    with _open_lock:
        _open[filename] = r
    return r


def source_fingerprint(filename: str) -> str:
    lp = local_path(filename)
    if lp:
        st = os.stat(lp)
        return f"local-{st.st_size}-{int(st.st_mtime)}"
    size = next((e["size"] for e in (_listing or []) if e["filename"] == filename), "na")
    return f"hf-{HF_REPO.replace('/', '_')}-{HF_REVISION}-{size}"


def decode(raw: np.ndarray, attrs: Dict[str, Any]) -> np.ndarray:
    """Raw stored values -> float32 physical values, fill/missing -> NaN."""
    out = raw.astype(np.float32, copy=True)
    for key in ("_FillValue", "missing_value"):
        fv = attrs.get(key)
        if fv is None:
            continue
        for x in np.atleast_1d(fv):
            try:
                x = float(x)
            except (TypeError, ValueError):
                continue
            if np.isnan(x):
                continue
            out[raw == np.asarray(x).astype(raw.dtype)] = np.nan
    vmin, vmax = attrs.get("valid_min"), attrs.get("valid_max")
    vr = attrs.get("valid_range")
    if isinstance(vr, (list, tuple)) and len(vr) == 2:
        vmin, vmax = vr
    if vmin is not None:
        out[raw < vmin] = np.nan
    if vmax is not None:
        out[raw > vmax] = np.nan
    sf, ao = attrs.get("scale_factor"), attrs.get("add_offset")
    if sf is not None:
        out *= np.float32(sf)
    if ao is not None:
        out += np.float32(ao)
    # Fill values that were written unpacked (e.g. 1e20 / 9.96e36) still leak through otherwise.
    out[np.abs(out) > 1e19] = np.nan
    return out
