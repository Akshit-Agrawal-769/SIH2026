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

import itertools
import logging
import os
import struct
import threading
import time
import zlib
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

HF_REPO = os.getenv("HF_DATASET_REPO", "ScaryCobra/incois")
HF_REVISION = os.getenv("HF_DATASET_REVISION", "main")
# h5py's file object only reads metadata (headers, chunk B-trees): chunk data is fetched by
# fetch_plan with exact ranges. Small read-ahead keeps scattered B-tree reads cheap.
HF_BLOCK_SIZE = int(os.getenv("HF_BLOCK_SIZE", str(512 * 1024)))
HF_PARALLEL = int(os.getenv("HF_PARALLEL", "16"))  # concurrent chunk range requests
CACHE_DIR = os.getenv("VOLUME_CACHE_DIR", os.path.join(__import__("tempfile").gettempdir(), "incois_volume_cache"))

log = logging.getLogger("model_store")


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

    def __init__(self, fobj, source: str, remote_path: Optional[str] = None):
        import h5netcdf
        self.f = fobj
        self.remote_path = remote_path  # HfFileSystem path, enables parallel chunk fetches
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

    # ---- parallel chunk fetch -------------------------------------------------------------
    # h5py holds a global lock for every HDF5 call, including the Python file-object reads,
    # so reading a slab through h5py issues its range requests one at a time. Here h5py is
    # only asked WHERE the needed chunks are (small, cached index reads); the chunk bytes are
    # then fetched concurrently and decoded in numpy. Supported filters: deflate, shuffle,
    # fletcher32. Anything else returns None and the caller uses the ordinary h5py read.

    def layout(self, name: str) -> Optional[Dict[str, Any]]:
        """Chunk shape / filters / dtype of a variable, or None if the fast path can't handle it."""
        if self.remote_path is None:
            return None
        d = self.ds.variables[name]._h5ds
        if d.chunks is None:
            return None
        dcpl = d.id.get_create_plist()
        filters = []
        for i in range(dcpl.get_nfilters()):
            code = dcpl.get_filter(i)[0]
            if code not in (1, 2, 3):
                return None
            filters.append(code)
        fill = d.fillvalue
        return {"shape": tuple(d.shape), "chunk_shape": tuple(d.chunks), "dtype": d.dtype,
                "filters": filters, "fill": 0 if fill is None else fill}

    def build_chunk_index(self, name: str) -> Dict[Tuple[int, ...], Tuple[int, int, int]]:
        """Every stored chunk of a variable: chunk offset -> (byte offset, size, filter mask).

        Uses H5Dchunk_iter (one pass) when h5py/HDF5 provide it. Otherwise looks each chunk up by
        its coordinate (a B-tree search each) - NOT get_chunk_info(i), which rescans the index from
        the start on every call and is quadratic in the number of chunks.
        """
        h5 = self.ds.variables[name]._h5ds
        dsid = h5.id
        idx: Dict[Tuple[int, ...], Tuple[int, int, int]] = {}

        def add(si):
            if si.byte_offset is not None and si.size:
                idx[tuple(int(x) for x in si.chunk_offset)] = (int(si.byte_offset), int(si.size), int(si.filter_mask))

        if hasattr(dsid, "chunk_iter"):
            try:
                dsid.chunk_iter(add)
                return idx
            except Exception:
                idx.clear()
        grids = [range(0, n, c) for n, c in zip(h5.shape, h5.chunks)]
        total = int(np.prod([len(g) for g in grids]))
        t0, step = time.time(), max(1, total // 20)
        for k, off in enumerate(itertools.product(*grids)):
            si = dsid.get_chunk_info_by_coord(off)
            if si.byte_offset is not None and si.size:
                idx[off] = (int(si.byte_offset), int(si.size), int(si.filter_mask))
            if (k + 1) % step == 0:
                print(f"[model_store] chunk index {name}: {k + 1}/{total} chunks ({time.time() - t0:.0f}s)", flush=True)
        return idx

    def plan_chunks(self, name: str, key: Tuple) -> Optional[Dict[str, Any]]:
        lay = self.layout(name)
        if lay is None:
            return None
        return _plan(lay, key, None, self.ds.variables[name]._h5ds)

    def fetch_plan(self, plan: Dict[str, Any]) -> np.ndarray:
        return _fetch_plan(self.remote_path, plan)

    def close(self):
        try:
            self.ds.close()
        finally:
            self.f.close()


def _plan(lay: Dict[str, Any], key: Tuple, index: Optional[Dict[Tuple[int, ...], Tuple[int, int, int]]],
          h5ds=None) -> Optional[Dict[str, Any]]:
    """Chunks needed for name[key]; looked up in `index` when given, else via h5py per chunk."""
    shape, ch = lay["shape"], lay["chunk_shape"]
    if not isinstance(key, tuple):
        key = (key,)
    key = key + (slice(None),) * (len(shape) - len(key))
    sel = []
    for k, n in zip(key, shape):
        if isinstance(k, (int, np.integer)):
            k = int(k) + (n if k < 0 else 0)
            sel.append((k, k + 1, 1, True))
        elif isinstance(k, slice):
            a, b, s = k.indices(n)
            if s < 1:
                return None
            sel.append((a, b, s, False))
        else:
            return None
    lo = [a for a, _, _, _ in sel]
    hi = [b for _, b, _, _ in sel]
    if any(b <= a for a, b in zip(lo, hi)):
        return None
    grids = [range(l // c, (h - 1) // c + 1) for l, h, c in zip(lo, hi, ch)]
    chunks = []
    for coord in itertools.product(*grids):
        off = tuple(g * c for g, c in zip(coord, ch))
        if index is not None:
            chunks.append((off, index.get(off)))
            continue
        si = h5ds.id.get_chunk_info_by_coord(off)
        if si.byte_offset is None or not si.size:
            chunks.append((off, None))
        else:
            chunks.append((off, (int(si.byte_offset), int(si.size), int(si.filter_mask))))
    return {"sel": sel, "lo": lo, "hi": hi, "chunks": chunks, "chunk_shape": tuple(ch),
            "dtype": lay["dtype"], "filters": lay["filters"], "fill": lay["fill"]}



# ---- exact byte-range HTTP for chunk data ---------------------------------------------------
# HfFileSystem.cat_file() opens a buffered file per call whose read-ahead fetches megabytes, so
# ~55 KB chunks cost ~100x their size. Chunks are fetched here with plain Range requests on a
# pooled connection, and chunks that sit next to each other in the file share one request.

HF_ENDPOINT = os.getenv("HF_ENDPOINT", "https://huggingface.co").rstrip("/")
RANGE_MERGE_GAP = int(os.getenv("HF_RANGE_MERGE_GAP", str(256 * 1024)))   # merge ranges closer than this
RANGE_MAX_BYTES = int(os.getenv("HF_RANGE_MAX_BYTES", str(16 * 1024 * 1024)))
HTTP_TIMEOUT_S = float(os.getenv("HF_HTTP_TIMEOUT", "60"))
HTTP_RETRIES = 3

_http = {"client": None, "resolved": {}}
_http_lock = threading.Lock()


def _http_client():
    with _http_lock:
        if _http["client"] is None:
            import httpx
            headers = {"User-Agent": "incois-data-service"}
            token = os.getenv("HF_TOKEN")
            if token:
                headers["Authorization"] = f"Bearer {token}"
            _http["client"] = httpx.Client(
                headers=headers, timeout=HTTP_TIMEOUT_S, follow_redirects=False,
                limits=httpx.Limits(max_connections=HF_PARALLEL * 2, max_keepalive_connections=HF_PARALLEL * 2))
        return _http["client"]


def _resolve_url(remote_path: str, refresh: bool = False) -> str:
    """Final (CDN) URL of a HF file; the /resolve/ redirect is followed once and reused for 10 min."""
    hit = _http["resolved"].get(remote_path)
    if hit and not refresh and time.time() - hit[1] < 600:
        return hit[0]
    repo_rev, fname = remote_path[len("datasets/"):].rsplit("/", 1)
    repo, _, rev = repo_rev.partition("@")
    url = f"{HF_ENDPOINT}/datasets/{repo}/resolve/{rev or 'main'}/{fname}"
    client = _http_client()
    for _ in range(5):
        r = client.get(url, headers={"Range": "bytes=0-0"})
        if r.status_code in (301, 302, 303, 307, 308):
            loc = r.headers["location"]
            url = loc if loc.startswith("http") else HF_ENDPOINT + loc
            continue
        if r.status_code not in (200, 206):
            raise StoreError(f"Hugging Face returned HTTP {r.status_code} resolving {fname}", 502)
        break
    _http["resolved"][remote_path] = (url, time.time())
    return url


def _get_range(remote_path: str, start: int, end: int) -> bytes:
    """Bytes [start, end) with retries; re-resolves the CDN URL if a signed URL expired."""
    client = _http_client()
    last = None
    for attempt in range(HTTP_RETRIES):
        url = _resolve_url(remote_path, refresh=attempt > 0)  # signed CDN URLs can expire
        try:
            r = client.get(url, headers={"Range": f"bytes={start}-{end - 1}"})
            if r.status_code == 206 and len(r.content) == end - start:
                return r.content
            if r.status_code == 200 and len(r.content) >= end:   # server ignored Range (small file)
                return r.content[start:end]
            last = f"HTTP {r.status_code}, {len(r.content)} bytes"
        except Exception as exc:  # timeouts / connection resets
            last = str(exc)
        time.sleep(0.5 * (attempt + 1))
    raise StoreError(f"Range {start}-{end} of {remote_path} failed after {HTTP_RETRIES} tries: {last}", 502)


def _coalesce(items):
    """Group (offset, (byte_off, size, mask)) chunks into contiguous-ish byte ranges."""
    stored = sorted((it for it in items if it[1] is not None), key=lambda it: it[1][0])
    groups, cur, cs, ce = [], [], None, None
    for it in stored:
        bo, size, _ = it[1]
        if cur and bo - ce <= RANGE_MERGE_GAP and (max(ce, bo + size) - cs) <= RANGE_MAX_BYTES:
            cur.append(it)
            ce = max(ce, bo + size)
        else:
            if cur:
                groups.append((cs, ce, cur))
            cur, cs, ce = [it], bo, bo + size
    if cur:
        groups.append((cs, ce, cur))
    return groups


def _fetch_plan(remote_path: str, plan: Dict[str, Any]) -> np.ndarray:
    dt, ch, lo, hi = plan["dtype"], plan["chunk_shape"], plan["lo"], plan["hi"]
    box = np.full([h - l for l, h in zip(lo, hi)], plan["fill"], dtype=dt)
    groups = _coalesce(plan["chunks"])

    def get(group):
        gs, ge, members = group
        blob = _get_range(remote_path, gs, ge)
        return [(off, blob[bo - gs:bo - gs + size], mask) for off, (bo, size, mask) in members]

    t0 = time.time()
    nbytes = sum(ge - gs for gs, ge, _ in groups)
    with ThreadPoolExecutor(max_workers=max(1, min(HF_PARALLEL, len(groups) or 1))) as ex:
        for results in ex.map(get, groups):
            for off, raw, mask in results:
                arr = _decode_chunk(raw, plan["filters"], mask, dt, ch)
                src, dst = [], []
                for o, c, l, h in zip(off, ch, lo, hi):
                    a, b = max(o, l), min(o + c, h)
                    src.append(slice(a - o, b - o))
                    dst.append(slice(a - l, b - l))
                box[tuple(dst)] = arr[tuple(src)]
    log.info("fetched %d chunks in %d requests, %.1f MB, %.1fs", len(plan["chunks"]), len(groups),
             nbytes / 1e6, time.time() - t0)
    return box[tuple(0 if sq else slice(None, None, s) for _, _, s, sq in plan["sel"])]


def _decode_chunk(buf: bytes, filters: List[int], mask: int, dtype: np.dtype, chunk_shape: Tuple) -> np.ndarray:
    """Undo the HDF5 filter pipeline (applied in order on write, so undone in reverse)."""
    b = buf
    for i in reversed(range(len(filters))):
        if mask & (1 << i):
            continue  # filter was skipped for this chunk
        code = filters[i]
        if code == 3:      # fletcher32: 4-byte checksum appended
            b = b[:-4]
        elif code == 1:    # deflate
            b = zlib.decompress(b)
        elif code == 2:    # shuffle: byte k of every element stored contiguously
            n = len(b) // dtype.itemsize
            b = np.frombuffer(b, np.uint8).reshape(dtype.itemsize, n).T.tobytes()
    return np.frombuffer(b, dtype).reshape(chunk_shape)


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
        return H5Reader(f, "huggingface", remote_path=path)
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


def read_array(filename: str, name: str, key: Tuple, engine: str = "auto") -> Tuple[np.ndarray, str]:
    """Raw values of name[key]. The file lock is held only for h5py work; remote chunk bytes
    are fetched in parallel outside it. Returns (array, engine actually used)."""
    t0 = time.time()
    with file_lock(filename):
        r = open_reader(filename)
        lay = None
        if engine != "direct" and isinstance(r, H5Reader):
            try:
                lay = r.layout(name)
            except Exception as exc:
                log.warning("chunk layout failed for %s:%s (%s); using h5py", filename, name, exc)
        if lay is None:
            return np.asarray(r.read(name, key)), "direct"
    try:
        plan = _plan(lay, key, chunk_index(filename, name))
    except Exception as exc:
        log.warning("chunk index unavailable for %s:%s (%s); using h5py", filename, name, exc)
        with file_lock(filename):
            return np.asarray(r.read(name, key)), "direct-fallback"
    if plan is None:
        with file_lock(filename):
            return np.asarray(r.read(name, key)), "direct"
    try:
        out = r.fetch_plan(plan)
        log.info("%s:%s %d chunks in %.1fs (parallel)", filename, name, len(plan["chunks"]), time.time() - t0)
        return out, f"parallel:{len(plan['chunks'])}"
    except Exception as exc:
        log.warning("parallel fetch failed for %s:%s (%s); falling back to h5py", filename, name, exc)
        with file_lock(filename):
            return np.asarray(r.read(name, key)), "direct-fallback"


_index_mem: Dict[str, Dict[Tuple[int, ...], Tuple[int, int, int]]] = {}
_index_locks: Dict[str, threading.Lock] = {}


def chunk_index(filename: str, name: str) -> Dict[Tuple[int, ...], Tuple[int, int, int]]:
    """Complete chunk index of a remote HDF5 variable. Built once with a dedicated file handle
    (so other requests are not blocked behind it) and persisted under CACHE_DIR."""
    import hashlib
    if local_path(filename):
        raise StoreError("local copy present; chunk index is only used for remote reads", 409)
    key = f"{filename}|{name}|{source_fingerprint(filename)}"
    if key in _index_mem:
        return _index_mem[key]
    with _open_lock:
        lock = _index_locks.setdefault(key, threading.Lock())
    with lock:
        if key in _index_mem:
            return _index_mem[key]
        path = os.path.join(CACHE_DIR, "chunk_index", hashlib.sha1(key.encode()).hexdigest() + ".npz")
        if os.path.isfile(path):
            try:
                z = np.load(path)
                idx = {tuple(int(x) for x in o): (int(b), int(s), int(m))
                       for o, b, s, m in zip(z["offsets"], z["byte"], z["size"], z["mask"])}
                _index_mem[key] = idx
                return idx
            except Exception:
                pass
        t0 = time.time()
        print(f"[model_store] building chunk index {filename}:{name} (one-time, cached under {CACHE_DIR})", flush=True)
        r = _open_remote(filename)
        try:
            if not isinstance(r, H5Reader):
                raise StoreError("chunk index only applies to HDF5 files", 415)
            idx = r.build_chunk_index(name)
        finally:
            r.close()
        log.info("chunk index %s:%s: %d chunks in %.1fs", filename, name, len(idx), time.time() - t0)
        print(f"[model_store] chunk index {filename}:{name}: {len(idx)} chunks in {time.time() - t0:.1f}s", flush=True)
        if idx:
            try:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                items = list(idx.items())
                tmp = f"{path}.{os.getpid()}.tmp.npz"
                np.savez(tmp, offsets=np.array([o for o, _ in items], dtype=np.int64),
                         byte=np.array([v[0] for _, v in items], dtype=np.int64),
                         size=np.array([v[1] for _, v in items], dtype=np.int64),
                         mask=np.array([v[2] for _, v in items], dtype=np.int64))
                os.replace(tmp, path)
            except OSError:
                pass
        _index_mem[key] = idx
        return idx


def source_fingerprint(filename: str) -> str:
    lp = local_path(filename)
    if lp:
        st = os.stat(lp)
        return f"local-{st.st_size}-{int(st.st_mtime)}"
    if _listing is None:
        try:
            hf_listing()
        except StoreError:
            pass
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
