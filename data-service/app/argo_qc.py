"""
Argo GDAC profile NetCDF -> QC-filtered profile records.

Shared by the data-service (on-demand profiles for every float in the archive) and the
offline build scripts, so both apply the same rules:
  * only QC flags 1 (good) and 2 (probably good) are kept;
  * *_ADJUSTED values are used when the parameter data mode is A or D;
  * JULD_QC and POSITION_QC must be 1 or 2;
  * depth from pressure with TEOS-10 gsw.z_from_p(pressure, latitude).
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Dict, Iterator, Optional, Tuple

import numpy as np

GOOD_QC = (b"1", b"2")
MAX_CORE_LEVELS = 200
MAX_BGC_LEVELS = 150
MATCHUP_MAX_DT_DAYS = 15.0
MATCHUP_MAX_DEPTH_M = 10.0
JULD_EPOCH = dt.datetime(1950, 1, 1, tzinfo=dt.timezone.utc)

# Argo data-centre codes (Argo User's Manual, reference table 4).
DATA_CENTRES = {
    "IN": "INCOIS (India)", "IF": "Coriolis / Ifremer (France)", "AO": "AOML (USA)",
    "BO": "BODC (UK)", "CS": "CSIRO (Australia)", "HZ": "CSIO (China)", "JA": "JMA (Japan)",
    "ME": "MEDS (Canada)", "KO": "KORDI (Korea)",
}

QC_POLICY = ("Argo QC flags 1 (good) and 2 (probably good) only; *_ADJUSTED used for A/D modes; "
             "JULD_QC and POSITION_QC must be 1 or 2")
UNITS = {"temperature": "°C (ITS-90)", "salinity": "PSU (PSS-78)", "oxygen": "µmol/kg",
         "chlorophyll": "mg/m³", "pressure": "dbar", "depth": "m (positive down)"}


def chars(arr) -> str:
    """Decode a netCDF char array (possibly masked) to a stripped str."""
    a = np.ma.filled(arr, b" ")
    return b"".join(np.atleast_1d(a).tolist()).decode("utf-8", "ignore").strip()


def qc_bytes(arr) -> np.ndarray:
    return np.ma.filled(arr, b" ").astype("S1")


def _depth(pres, lat):
    import gsw
    return -gsw.z_from_p(pres, lat)


def param_modes(ds, prof) -> Dict[str, str]:
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


def profile_header(ds, prof) -> Optional[Dict[str, Any]]:
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


def iter_profiles(ds) -> Iterator[Tuple[int, Dict[str, Any]]]:
    """(profile index, header) for every profile with good time and position QC."""
    ds.set_auto_mask(True)
    for prof in range(ds.dimensions["N_PROF"].size):
        hdr = profile_header(ds, prof)
        if hdr is not None:
            yield prof, hdr


def stride_pick(indices, max_n):
    indices = np.asarray(indices)
    if len(indices) <= max_n:
        return indices
    step = int(np.ceil(len(indices) / max_n))
    picked = indices[::step]
    if picked[-1] != indices[-1]:
        picked = np.append(picked, indices[-1])  # keep deepest real level
    return picked


def extract_profile(ds, prof, hdr) -> Optional[Dict[str, Any]]:
    modes = param_modes(ds, prof)
    pres, pres_good, pres_field = param_values(ds, prof, "PRES", modes.get("PRES", "R"))
    if pres is None:
        return None
    fields = {}
    used = {"PRES": pres_field}
    for name in ("TEMP", "PSAL", "DOXY", "CHLA"):
        if name in modes or name in ds.variables:
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

        def val(name, nd):
            if name not in fields:
                return None
            v, g = fields[name]
            return round(float(v[i]), nd) if g[i] else None

        m = {
            "pressure": round(p, 2),
            "depth": round(float(_depth(p, lat)), 2),
            "temperature": val("TEMP", 4),
            "salinity": val("PSAL", 4),
            "oxygen": val("DOXY", 2),
            "chlorophyll": val("CHLA", 4),
        }
        if any(m[k] is not None for k in ("temperature", "salinity", "oxygen", "chlorophyll")):
            out.append(m)
    return {
        "measurements": out,
        "levels_good_pressure": int(np.sum(pres_good)),
        "levels_served": len(out),
        "parameter_modes": {k: modes.get(k) for k in used},
        "fields_used": used,
    }


def float_metadata(ds, prof, wmo, source_file) -> Dict[str, Any]:
    dc = chars(ds["DATA_CENTRE"][prof]) if "DATA_CENTRE" in ds.variables else ""
    return {
        "wmo": wmo,
        "data_centre": dc,
        "institution": DATA_CENTRES.get(dc, dc or "unknown"),
        "project_name": chars(ds["PROJECT_NAME"][prof]) if "PROJECT_NAME" in ds.variables else None,
        "pi_name": chars(ds["PI_NAME"][prof]) if "PI_NAME" in ds.variables else None,
        "float_platform_type": chars(ds["PLATFORM_TYPE"][prof]) if "PLATFORM_TYPE" in ds.variables else None,
        "source_file": source_file,
    }


def near_surface(ds, prof, hdr) -> Dict[str, Any]:
    """Shallowest QC-good temperature/salinity within MATCHUP_MAX_DEPTH_M (model matchups)."""
    modes = param_modes(ds, prof)
    pres, pres_good, _ = param_values(ds, prof, "PRES", modes.get("PRES", "R"))
    out: Dict[str, Any] = {}
    if pres is None:
        return out
    depth = _depth(np.where(np.isfinite(pres), pres, 0.0), hdr["lat"])
    for var, name in (("temperature", "TEMP"), ("salinity", "PSAL")):
        vals, good, _ = param_values(ds, prof, name, modes.get(name, "R"))
        if vals is None:
            continue
        ok = np.where(good & pres_good & (depth <= MATCHUP_MAX_DEPTH_M))[0]
        if len(ok):
            s = ok[np.argmin(depth[ok])]
            out[var] = {"obs": round(float(vals[s]), 4), "obs_depth": round(float(depth[s]), 2),
                        "obs_pressure": round(float(pres[s]), 2)}
    return out
