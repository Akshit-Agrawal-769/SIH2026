"""
Argo In-Situ Observation Service
Reads NetCDF Argo profiling float datasets, extracts profiles, and converts pressure (dbar) to depth (m) via gsw TEOS-10.
"""

import os
import glob
from typing import List, Dict, Any, Optional
import numpy as np
import xarray as xr
import gsw
from app.core.config import settings

class ArgoService:
    
    def __init__(self):
        self.argo_dir = os.path.join(settings.DATASETS_DIR, "argo")

    def list_argo_files(self) -> List[str]:
        if not os.path.exists(self.argo_dir):
            return []
        return [os.path.basename(f) for f in glob.glob(os.path.join(self.argo_dir, "*.nc"))]

    def get_floats_summary(self) -> List[Dict[str, Any]]:
        files = self.list_argo_files()
        summaries = []
        
        for f in files:
            filepath = os.path.join(self.argo_dir, f)
            try:
                ds = xr.open_dataset(filepath)
                
                # Extract WMO float ID
                wmo_val = ds["PLATFORM_NUMBER"].values[0]
                wmo = wmo_val.decode("utf-8").strip() if isinstance(wmo_val, bytes) else str(wmo_val).strip()
                
                n_prof = ds.dims.get("N_PROF", 1)
                cycles = [int(c) for c in ds["CYCLE_NUMBER"].values] if "CYCLE_NUMBER" in ds else list(range(1, n_prof + 1))
                
                lats = [float(l) for l in ds["LATITUDE"].values] if "LATITUDE" in ds else [15.0]
                lons = [float(l) for l in ds["LONGITUDE"].values] if "LONGITUDE" in ds else [68.0]
                
                trajectory = []
                for i in range(len(lats)):
                    trajectory.append({
                        "cycle": cycles[i] if i < len(cycles) else i + 1,
                        "latitude": lats[i],
                        "longitude": lons[i]
                    })
                    
                summary = {
                    "platform_number": wmo,
                    "filename": f,
                    "profiles_count": n_prof,
                    "latest_position": {
                        "latitude": lats[-1],
                        "longitude": lons[-1]
                    },
                    "cycles": cycles,
                    "trajectory": trajectory
                }
                summaries.append(summary)
                ds.close()
            except Exception as e:
                print(f"Error parsing Argo file {f}: {e}")
                
        return summaries

    def get_float_profile(self, platform_number: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        files = self.list_argo_files()
        target_file = None
        
        for f in files:
            if platform_number in f:
                target_file = f
                break
                
        if not target_file and files:
            target_file = files[0]
            
        if not target_file:
            return None

        filepath = os.path.join(self.argo_dir, target_file)
        try:
            ds = xr.open_dataset(filepath)
            wmo_val = ds["PLATFORM_NUMBER"].values[0]
            wmo = wmo_val.decode("utf-8").strip() if isinstance(wmo_val, bytes) else str(wmo_val).strip()
            
            cycles = [int(c) for c in ds["CYCLE_NUMBER"].values] if "CYCLE_NUMBER" in ds else [1]
            prof_idx = 0
            if cycle_number is not None and cycle_number in cycles:
                prof_idx = cycles.index(cycle_number)

            lat = float(ds["LATITUDE"].values[prof_idx]) if "LATITUDE" in ds else 15.0
            lon = float(ds["LONGITUDE"].values[prof_idx]) if "LONGITUDE" in ds else 68.0
            
            pres = np.array(ds["PRES"].values[prof_idx], dtype=np.float64)
            temp = np.array(ds["TEMP"].values[prof_idx], dtype=np.float64)
            sal = np.array(ds["PSAL"].values[prof_idx], dtype=np.float64) if "PSAL" in ds else None
            qc = [int(q) for q in ds["TEMP_QC"].values[prof_idx]] if "TEMP_QC" in ds else [1] * len(pres)

            # Convert pressure (dbar) to depth (m) using gsw TEOS-10
            depths = np.array([-float(gsw.z_from_p(p, lat)) for p in pres])

            # Filter valid physical seawater values (-2.0 <= T <= 40.0, 0 <= P < 9000)
            valid_mask = (~np.isnan(pres)) & (~np.isnan(temp)) & (temp >= -2.0) & (temp <= 40.0) & (pres >= 0) & (pres < 9000)
            
            profile = {
                "platform_number": wmo,
                "cycle_number": cycles[prof_idx],
                "timestamp": "2026-08-20T12:00:00Z",
                "latitude": lat,
                "longitude": lon,
                "depths": [float(d) for d in depths[valid_mask]],
                "temperature": [float(t) for t in temp[valid_mask]],
                "salinity": [float(s) for s in sal[valid_mask]] if sal is not None else None,
                "qc_flags": [int(q) for q in np.array(qc)[valid_mask]]
            }
            
            ds.close()
            return profile
        except Exception as e:
            print(f"Error getting float profile: {e}")
            return None

argo_service = ArgoService()
