"""
In-Situ Observation Store Deep Module
Loads, QC-filters, indexes, and delivers authentic in-situ ocean observation profiles
(e.g., Argo autonomous profiling floats) with in-memory caching and TEOS-10 depth calibration.
"""

import os
import glob
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import xarray as xr
import pandas as pd
import gsw
from app.core.config import settings


def decode_argo_qc_flags(qc_data: Any, length: int) -> List[int]:
    """Decodes Argo QC character/byte array into a list of integers. Missing or unparseable QC returns 0 (No QC / Unknown)."""
    if qc_data is None:
        return [0] * length
    if isinstance(qc_data, (bytes, np.bytes_)):
        return [int(chr(c)) if chr(c).isdigit() else 0 for c in qc_data]
    if isinstance(qc_data, str):
        return [int(c) if c.isdigit() else 0 for c in qc_data]
    if isinstance(qc_data, np.ndarray):
        result = []
        for val in qc_data.flatten():
            if isinstance(val, (bytes, np.bytes_)):
                char = val.decode('utf-8', errors='ignore').strip()
                result.append(int(char) if char.isdigit() else 0)
            elif isinstance(val, (int, np.integer)):
                result.append(int(val))
            elif isinstance(val, str) and val.isdigit():
                result.append(int(val))
            else:
                result.append(0)
        return result
    return [0] * length


def decode_argo_timestamp(juld_val: Any, ref_date_str: Optional[str] = "1950-01-01T00:00:00Z") -> Optional[str]:
    """Converts Argo JULD (days since reference date) into an ISO 8601 UTC string. Returns None if missing or invalid."""
    try:
        if pd.isna(juld_val) or juld_val is None:
            return None
        if isinstance(juld_val, (np.datetime64, pd.Timestamp)):
            return str(pd.to_datetime(juld_val).strftime("%Y-%m-%dT%H:%M:%SZ"))
        ref_dt = pd.to_datetime(ref_date_str if ref_date_str else "1950-01-01T00:00:00Z")
        argo_dt = ref_dt + pd.to_timedelta(float(juld_val), unit="D")
        return argo_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


class InSituStore:
    """Deep module managing in-situ observation discovery, QC filtering, TEOS-10 conversion, and in-memory profile caching."""

    def __init__(self, argo_dir: Optional[str] = None):
        self.argo_dir = argo_dir or os.path.join(settings.DATASETS_DIR, "argo")
        self._summaries: Optional[List[Dict[str, Any]]] = None
        self._profiles_by_wmo_cycle: Dict[str, Dict[int, Dict[str, Any]]] = {}
        self._profiles_by_wmo: Dict[str, List[Dict[str, Any]]] = {}
        self._is_indexed = False

    def list_available_files(self) -> List[str]:
        if not os.path.exists(self.argo_dir):
            return []
        files = glob.glob(os.path.join(self.argo_dir, "*.nc"))
        return sorted([os.path.basename(f) for f in files])

    def parse_single_file(self, file_path: str, filter_qc: bool = True) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Parses an authentic Argo NetCDF file:
        - Extracts metadata bounds, variables, and profile counts.
        - Prioritizes adjusted variables (TEMP_ADJUSTED, PRES_ADJUSTED, PSAL_ADJUSTED).
        - Computes TEOS-10 depth: z = -gsw.z_from_p(pressure, latitude).
        - Filters QC flags: accepts QC in {1, 2}, rejects QC in {3, 4, 9, 0}.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"REAL DATASET REQUIRED: Argo profile file not found at '{file_path}'")

        with xr.open_dataset(file_path) as ds:
            wmo = ""
            if "PLATFORM_NUMBER" in ds:
                raw_wmo = ds["PLATFORM_NUMBER"].values
                if len(raw_wmo.shape) > 0 and isinstance(raw_wmo[0], (bytes, np.bytes_)):
                    wmo = raw_wmo[0].decode("utf-8").strip()
                else:
                    wmo = str(raw_wmo).strip(" []'")
            else:
                wmo = os.path.basename(file_path).split("_")[0]

            n_prof = ds.sizes.get("N_PROF", 1)
            n_levels = ds.sizes.get("N_LEVELS", 0)

            if "LATITUDE" not in ds or "LONGITUDE" not in ds:
                raise ValueError("ARGO_COORDINATE_MISSING: Dataset lacks required LATITUDE or LONGITUDE variable.")

            lats_raw = ds["LATITUDE"].values
            lons_raw = ds["LONGITUDE"].values

            meta = {
                "platform_number": wmo,
                "filename": os.path.basename(file_path),
                "profiles_count": int(n_prof),
                "levels_per_profile": int(n_levels),
                "latitude_range": [float(np.nanmin(lats_raw)), float(np.nanmax(lats_raw))],
                "longitude_range": [float(np.nanmin(lons_raw)), float(np.nanmax(lons_raw))],
                "has_salinity": "PSAL" in ds or "PSAL_ADJUSTED" in ds,
                "has_chlorophyll": "CHLA" in ds or "CHLA_ADJUSTED" in ds,
                "qc_policy": "Strict QC filtering: QC=1 (Good) and QC=2 (Probably Good) retained. QC=3, 4 rejected.",
            }

            ref_date = "1950-01-01T00:00:00Z"
            if "REFERENCE_DATE_TIME" in ds.attrs:
                ref_date = str(ds.attrs["REFERENCE_DATE_TIME"]).strip()

            has_pres_adj = "PRES_ADJUSTED" in ds and not np.isnan(ds["PRES_ADJUSTED"].values).all()
            has_temp_adj = "TEMP_ADJUSTED" in ds and not np.isnan(ds["TEMP_ADJUSTED"].values).all()
            has_psal_adj = "PSAL_ADJUSTED" in ds and not np.isnan(ds["PSAL_ADJUSTED"].values).all()

            pres_var = "PRES_ADJUSTED" if has_pres_adj else "PRES"
            pres_qc_var = f"{pres_var}_QC"

            temp_var = "TEMP_ADJUSTED" if has_temp_adj else "TEMP"
            temp_qc_var = f"{temp_var}_QC"

            psal_var = "PSAL_ADJUSTED" if has_psal_adj else ("PSAL" if "PSAL" in ds else None)
            psal_qc_var = f"{psal_var}_QC" if psal_var else None

            profiles = []

            for prof_idx in range(n_prof):
                try:
                    lat_val = ds["LATITUDE"].values[prof_idx]
                    lon_val = ds["LONGITUDE"].values[prof_idx]
                    if np.isnan(lat_val) or np.isnan(lon_val):
                        continue
                    lat = float(lat_val)
                    lon = float(lon_val)

                    cycle = int(ds["CYCLE_NUMBER"].values[prof_idx]) if "CYCLE_NUMBER" in ds else prof_idx

                    juld_val = ds["JULD"].values[prof_idx] if "JULD" in ds else None
                    time_str = decode_argo_timestamp(juld_val, ref_date)

                    raw_pres = ds[pres_var].values[prof_idx]
                    raw_temp = ds[temp_var].values[prof_idx]
                    raw_psal = ds[psal_var].values[prof_idx] if psal_var else None

                    temp_qc = decode_argo_qc_flags(ds[temp_qc_var].values[prof_idx] if temp_qc_var in ds else None, len(raw_pres))
                    pres_qc = decode_argo_qc_flags(ds[pres_qc_var].values[prof_idx] if pres_qc_var in ds else None, len(raw_pres))
                    psal_qc = decode_argo_qc_flags(ds[psal_qc_var].values[prof_idx] if psal_qc_var in ds else None, len(raw_pres))

                    depths = []
                    temps = []
                    psals = []
                    valid_qc = []

                    for i in range(len(raw_pres)):
                        p = raw_pres[i]
                        t = raw_temp[i]
                        p_qc = pres_qc[i]
                        t_qc = temp_qc[i]

                        if not np.isnan(p) and not np.isnan(t) and p >= 0:
                            if filter_qc and (p_qc not in [1, 2] or t_qc not in [1, 2]):
                                continue

                            z = -float(gsw.z_from_p(p, lat))
                            if z < 0:
                                continue

                            depths.append(round(z, 2))
                            temps.append(round(float(t), 3))

                            if raw_psal is not None and not np.isnan(raw_psal[i]):
                                s_val = float(raw_psal[i])
                                s_qc = psal_qc[i]
                                if not filter_qc or s_qc in [1, 2]:
                                    psals.append(round(s_val, 3))
                                else:
                                    psals.append(None)
                            else:
                                psals.append(None)

                            valid_qc.append(t_qc)

                    if len(depths) > 0:
                        profiles.append({
                            "platform_number": wmo,
                            "cycle_number": cycle,
                            "timestamp": time_str,
                            "latitude": round(lat, 4),
                            "longitude": round(lon, 4),
                            "depths": depths,
                            "temperature": temps,
                            "salinity": psals if any(s is not None for s in psals) else None,
                            "qc_flags": valid_qc,
                        })
                except Exception as e:
                    print(f"Warning: error parsing profile index {prof_idx} in {file_path}: {e}")
                    continue

        return meta, profiles

    def _ensure_indexed(self):
        if self._is_indexed:
            return

        summaries = []
        self._profiles_by_wmo_cycle.clear()
        self._profiles_by_wmo.clear()

        files = self.list_available_files()
        for f in files:
            file_path = os.path.join(self.argo_dir, f)
            try:
                meta, profiles = self.parse_single_file(file_path, filter_qc=True)
                if not profiles:
                    continue

                wmo = str(meta["platform_number"])
                self._profiles_by_wmo[wmo] = profiles
                if wmo not in self._profiles_by_wmo_cycle:
                    self._profiles_by_wmo_cycle[wmo] = {}

                for p in profiles:
                    cycle = p["cycle_number"]
                    self._profiles_by_wmo_cycle[wmo][cycle] = p

                latest = profiles[-1]
                trajectory = [
                    {
                        "cycle_number": p["cycle_number"],
                        "latitude": p["latitude"],
                        "longitude": p["longitude"],
                        "timestamp": p["timestamp"],
                        "depth_max": max(p["depths"]) if p["depths"] else None
                    }
                    for p in profiles
                ]

                summaries.append({
                    "platform_number": wmo,
                    "filename": f,
                    "profiles_count": len(profiles),
                    "latest_position": {
                        "latitude": latest["latitude"],
                        "longitude": latest["longitude"],
                    },
                    "cycles": [p["cycle_number"] for p in profiles],
                    "trajectory": trajectory,
                })
            except Exception as e:
                print(f"Error indexing in-situ observation file {f}: {e}")
                continue

        self._summaries = summaries
        self._is_indexed = True

    def get_float_summaries(self) -> List[Dict[str, Any]]:
        self._ensure_indexed()
        return self._summaries or []

    def get_profile(self, platform_number: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        self._ensure_indexed()
        wmo_str = str(platform_number).strip()

        if cycle_number is not None:
            wmo_map = self._profiles_by_wmo_cycle.get(wmo_str)
            if wmo_map and cycle_number in wmo_map:
                return wmo_map[cycle_number]
            # Fallback search if float has string keys
            for w, cmap in self._profiles_by_wmo_cycle.items():
                if w == wmo_str and cycle_number in cmap:
                    return cmap[cycle_number]
            return None

        # Return latest cycle profile if cycle_number is None
        profiles = self._profiles_by_wmo.get(wmo_str)
        if profiles and len(profiles) > 0:
            return profiles[-1]

        return None

    def reload(self):
        """Forces re-indexing of all in-situ datasets from disk."""
        self._is_indexed = False
        self._ensure_indexed()


insitu_store = InSituStore()
