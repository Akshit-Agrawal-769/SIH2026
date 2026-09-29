"""
Every Argo float in the uploaded GDAC archives, served on demand.

Sources (dataset repo: local datasets/ copy first, else Hugging Face):
  argo_platforms.json            float list with latest position/time (scripts/build_argo_index.py)
  argo_tar_index/<provider>.json byte offset of every profile NetCDF inside raw/argo_<provider>.tar
  raw/argo_<provider>.tar        the GDAC profile files themselves

A float's profile is one HTTP range read of its NetCDF member from the tar, QC-filtered with
app.argo_qc and cached on disk. Nothing is precomputed per float and no float is hard-coded.
"""
from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

from app import argo_qc as qc
from app import model_store as ms

log = logging.getLogger("argo_store")

PLATFORMS_FILE = os.getenv("ARGO_PLATFORMS_FILE", "argo_platforms.json")
TAR_INDEX_DIR = os.getenv("ARGO_TAR_INDEX_DIR", "argo_tar_index")
CACHE_DIR = os.path.join(
    os.getenv("VOLUME_CACHE_DIR", os.path.join(tempfile.gettempdir(), "incois_volume_cache")), "argo")
RETRY_AFTER_S = 300
FETCH_PARALLEL = int(os.getenv("ARGO_FETCH_PARALLEL", "8"))
PROFILE_CANDIDATES = 8  # newest files tried before giving up on a float's latest profile
SHARD_CACHE = 2         # provider offset tables kept in memory (the largest is ~60k entries)

_FILE_RE = re.compile(r"^(?P<prefix>[A-Z]{1,2})(?P<wmo>\d+)_(?P<cycle>\d+)(?P<desc>D?)\.nc$")
# For one cycle prefer the merged S-file, then delayed-mode, then real-time core file.
_PREFIX_RANK = {"S": 0, "SD": 0, "SR": 1, "D": 2, "R": 3}

_lock = threading.Lock()
_nc_lock = threading.Lock()
_state: Dict[str, Any] = {"platforms": None, "by_wmo": None, "meta": None, "error": None, "failed_at": 0.0}
_shards: "OrderedDict[str, Dict[str, List[list]]]" = OrderedDict()


class ArgoUnavailable(Exception):
    pass


def canonical_wmo(instrument_id: str) -> Optional[str]:
    m = re.search(r"(\d{5,8})", instrument_id or "")
    return m.group(1) if m else None


# --------------------------------------------------------------------------- float list

def _load_platforms() -> None:
    with _lock:
        if _state["platforms"] is not None:
            return
        if _state["error"] and time.time() - _state["failed_at"] < RETRY_AFTER_S:
            raise ArgoUnavailable(_state["error"])
    try:
        doc = json.loads(ms.repo_file_bytes(PLATFORMS_FILE))
    except Exception as exc:
        msg = f"{PLATFORMS_FILE} unavailable: {exc}"
        log.warning(msg)
        with _lock:
            _state.update(error=msg, failed_at=time.time())
        raise ArgoUnavailable(msg) from exc
    plats = doc.get("platforms", [])
    with _lock:
        _state.update(platforms=plats, by_wmo={p["wmo"]: p for p in plats}, error=None,
                      meta={k: v for k, v in doc.items() if k != "platforms"})
    log.info("Argo: %d floats from %s", len(plats), PLATFORMS_FILE)


def platforms() -> List[Dict[str, Any]]:
    _load_platforms()
    return _state["platforms"]


def platform(wmo: str) -> Optional[Dict[str, Any]]:
    _load_platforms()
    return _state["by_wmo"].get(wmo)


def status() -> Dict[str, Any]:
    p = _state["platforms"]
    return {"file": PLATFORMS_FILE, "floats": len(p) if p else 0, "error": _state["error"]}


def feature(p: Dict[str, Any]) -> Dict[str, Any]:
    iid = f"ARGO_{p['wmo']}"
    return {
        "type": "Feature",
        "id": iid,
        "geometry": {"type": "Point", "coordinates": [round(p["lon"], 4), round(p["lat"], 4)]},
        "properties": {
            "id": iid,
            "external_id": iid,
            "platform_type": "argo",
            "last_report": p.get("latest_timestamp"),
            "metadata": {
                "wmo": p["wmo"],
                "data_centre": p.get("dac"),
                "institution": qc.DATA_CENTRES.get(p.get("dac") or "", p.get("provider")),
                "gdac_provider": p.get("provider"),
                "latest_cycle": p.get("latest_cycle"),
                "profile_count": p.get("profiles_count"),
                "has_temperature": p.get("has_temperature"),
                "has_salinity": p.get("has_salinity"),
                "profiles_available": bool(p.get("tar")),
                "qc_policy": qc.QC_POLICY,
            },
        },
    }


def features(bbox: Optional[List[float]] = None) -> List[Dict[str, Any]]:
    out = []
    for p in platforms():
        if bbox and not (bbox[0] <= p["lon"] <= bbox[2] and bbox[1] <= p["lat"] <= bbox[3]):
            continue
        out.append(feature(p))
    return out


# --------------------------------------------------------------------------- profile files

def _shard(provider: str) -> Dict[str, List[list]]:
    with _lock:
        if provider in _shards:
            _shards.move_to_end(provider)
            return _shards[provider]
    doc = json.loads(ms.repo_file_bytes(f"{TAR_INDEX_DIR}/{provider}.json"))
    with _lock:
        _shards[provider] = doc
        while len(_shards) > SHARD_CACHE:
            _shards.popitem(last=False)
    return doc


def _ascending_files(p: Dict[str, Any]) -> List[Tuple[int, str, int, int]]:
    """[(cycle, file, offset, size)] one preferred ascending file per cycle, newest first."""
    best: Dict[int, Tuple[int, str, int, int]] = {}
    for name, off, size in _shard(p["provider"]).get(p["wmo"], []):
        m = _FILE_RE.match(name)
        if not m or m.group("desc"):
            continue  # descending profiles are secondary; B-files carry no temperature
        rank = _PREFIX_RANK.get(m.group("prefix"))
        if rank is None:
            continue
        cyc = int(m.group("cycle"))
        if cyc not in best or rank < best[cyc][0]:
            best[cyc] = (rank, name, off, size)
    return [(c, v[1], v[2], v[3]) for c, v in sorted(best.items(), reverse=True)]


def _read_member(p: Dict[str, Any], name: str, off: int, size: int) -> bytes:
    # An extracted local copy (datasets/<provider>/<wmo>/profiles/<file>) avoids the tar.
    try:
        return ms.repo_file_bytes(f"{p['provider']}/{p['wmo']}/profiles/{name}")
    except ms.StoreError:
        pass
    return ms.repo_file_range(p["tar"], off, off + size)


def _open_nc(buf: bytes, name: str):
    import netCDF4
    return netCDF4.Dataset(name, mode="r", memory=buf)


def _source_ref(p: Dict[str, Any], name: str) -> str:
    return f"{p['tar']}:{p['provider']}/{p['wmo']}/profiles/{name}"


def _cache_path(kind: str, wmo: str) -> str:
    return os.path.join(CACHE_DIR, kind, f"{wmo}.json")


def _cache_get(kind: str, wmo: str, key: str) -> Optional[Dict[str, Any]]:
    try:
        with open(_cache_path(kind, wmo), encoding="utf-8") as f:
            doc = json.load(f)
        return doc["value"] if doc.get("key") == key else None
    except (OSError, ValueError, KeyError):
        return None


def _cache_put(kind: str, wmo: str, key: str, value: Dict[str, Any]) -> None:
    path = _cache_path(kind, wmo)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"key": key, "value": value}, f)
    os.replace(tmp, path)


def _require(wmo: str) -> Dict[str, Any]:
    p = platform(wmo)
    if p is None:
        raise KeyError(f"Argo float {wmo} is not in {PLATFORMS_FILE}")
    if not p.get("tar"):
        raise KeyError(f"Argo float {wmo} has no profile files in the uploaded archives")
    return p


def latest_profile(instrument_id: str) -> Optional[Dict[str, Any]]:
    """Latest QC-good ascending profile of a float, or None when it has none / is unknown."""
    wmo = canonical_wmo(instrument_id)
    if not wmo:
        return None
    try:
        p = _require(wmo)
    except KeyError:
        return None
    files = _ascending_files(p)
    if not files:
        return None
    cache_key = files[0][1]
    hit = _cache_get("profiles", wmo, cache_key)
    if hit:
        return hit
    for cycle, name, off, size in files[:PROFILE_CANDIDATES]:
        buf = _read_member(p, name, off, size)
        with _nc_lock:  # the netCDF-C library is not thread-safe
            ds = _open_nc(buf, name)
            try:
                out = None
                for prof, hdr in qc.iter_profiles(ds):
                    if hdr["direction"] != "A":
                        continue
                    ex = qc.extract_profile(ds, prof, hdr)
                    if ex and ex["measurements"]:
                        out = _profile_record(p, ds, prof, hdr, ex, name)
                        break
            finally:
                ds.close()
        if out:
            _cache_put("profiles", wmo, cache_key, out)
            return out
    return None


def _profile_record(p, ds, prof, hdr, ex, name) -> Dict[str, Any]:
    iid = f"ARGO_{p['wmo']}"
    ms_ = ex["measurements"]
    meta = qc.float_metadata(ds, prof, p["wmo"], _source_ref(p, name))
    meta.update({
        "gdac_provider": p.get("provider"),
        "latest_cycle": hdr["cycle"],
        "profile_count": p.get("profiles_count"),
        "parameter_modes": ex["parameter_modes"],
        "fields_used": ex["fields_used"],
        "has_oxygen": any(m["oxygen"] is not None for m in ms_),
        "has_chlorophyll": any(m["chlorophyll"] is not None for m in ms_),
        "qc_policy": qc.QC_POLICY,
        "depth_method": "TEOS-10 gsw.z_from_p(pressure, latitude)",
        "levels_good_pressure": ex["levels_good_pressure"],
        "levels_served": ex["levels_served"],
        "units": qc.UNITS,
    })
    return {
        "instrument_id": iid,
        "external_id": iid,
        "platform_type": "argo",
        "profile_id": f"{iid}_cycle_{hdr['cycle']:03d}",
        "cycle_number": hdr["cycle"],
        "timestamp": hdr["time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latitude": round(hdr["lat"], 4),
        "longitude": round(hdr["lon"], 4),
        "metadata": meta,
        "measurements": ms_,
    }


def observation_records(instrument_id: str) -> Optional[Dict[str, Any]]:
    """Near-surface (<= 10 m) QC-good observations of every ascending profile of a float."""
    wmo = canonical_wmo(instrument_id)
    if not wmo:
        return None
    try:
        p = _require(wmo)
    except KeyError:
        return None
    files = _ascending_files(p)
    if not files:
        return None
    cache_key = f"{len(files)}:{files[0][1]}"
    hit = _cache_get("surface_obs", wmo, cache_key)
    if hit:
        return hit

    def fetch(item):
        cycle, name, off, size = item
        try:
            return name, _read_member(p, name, off, size)
        except Exception as exc:  # one unreachable file must not hide the rest
            log.warning("Argo %s %s unreadable: %s", wmo, name, exc)
            return name, None

    records = []
    # Downloads run in parallel; parsing stays on this thread (the netCDF-C library is not
    # thread-safe) and each buffer is dropped as soon as it is parsed.
    with ThreadPoolExecutor(max_workers=FETCH_PARALLEL) as ex:
        for name, buf in ex.map(fetch, files):
            if buf is None:
                continue
            with _nc_lock:
                try:
                    ds = _open_nc(buf, name)
                except Exception as exc:
                    log.warning("Argo %s %s is not valid NetCDF: %s", wmo, name, exc)
                    continue
                try:
                    for prof, hdr in qc.iter_profiles(ds):
                        if hdr["direction"] != "A":
                            continue
                        rec = {"cycle": hdr["cycle"], "time": hdr["time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                               "latitude": round(hdr["lat"], 4), "longitude": round(hdr["lon"], 4)}
                        rec.update(qc.near_surface(ds, prof, hdr))
                        records.append(rec)
                        break  # one ascending profile per cycle file
                finally:
                    ds.close()
    records.sort(key=lambda r: r["time"])
    out = {"wmo": wmo, "provider": p.get("provider"), "files_read": len(files), "records": records}
    _cache_put("surface_obs", wmo, cache_key, out)
    return out
