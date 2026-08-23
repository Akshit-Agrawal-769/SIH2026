"""
INCOIS ROMS / Ocean Numerical Model NetCDF Adapter
Extracts 3D/4D grid coordinates (lon, lat, depth/s_rho, time), bounding boxes, and variable statistics.
"""

import os
from typing import Dict, Any, List, Optional
import numpy as np
import xarray as xr
from ingestion.adapters.base_adapter import BaseOceanAdapter


class ROMSModelAdapter(BaseOceanAdapter):
    """Adapter for reading and regularizing ROMS / INDOFOS Ocean Model NetCDF datasets."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"REAL DATASET REQUIRED: Ocean model file not found at '{file_path}'")

    def validate_schema(self, file_path_or_url: Optional[str] = None) -> bool:
        path = file_path_or_url or self.file_path
        try:
            with xr.open_dataset(path) as ds:
                has_lon = any(k in ds.coords or k in ds.data_vars for k in ["lon", "longitude", "lon_rho", "x", "nav_lon"])
                has_lat = any(k in ds.coords or k in ds.data_vars for k in ["lat", "latitude", "lat_rho", "y", "nav_lat"])
                return has_lon and has_lat
        except Exception:
            return False

    def extract_metadata(self, file_path_or_url: Optional[str] = None) -> Dict[str, Any]:
        path = file_path_or_url or self.file_path
        with xr.open_dataset(path) as ds:
            lon_key = next((k for k in ["lon", "longitude", "lon_rho", "x", "nav_lon"] if k in ds.coords or k in ds.data_vars), None)
            lat_key = next((k for k in ["lat", "latitude", "lat_rho", "y", "nav_lat"] if k in ds.coords or k in ds.data_vars), None)
            time_key = next((k for k in ["time", "ocean_time", "time_counter"] if k in ds.coords or k in ds.data_vars), None)
            depth_key = next((k for k in ["depth", "s_rho", "lev", "level", "z", "deptht"] if k in ds.coords or k in ds.dims), None)

            lon_vals = ds[lon_key].values if lon_key else np.array([60.0, 95.0])
            lat_vals = ds[lat_key].values if lat_key else np.array([5.0, 25.0])

            bounds = {
                "min_lon": float(np.nanmin(lon_vals)),
                "max_lon": float(np.nanmax(lon_vals)),
                "min_lat": float(np.nanmin(lat_vals)),
                "max_lat": float(np.nanmax(lat_vals)),
            }

            depth_levels: List[float] = []
            if depth_key and depth_key in ds:
                raw_depths = ds[depth_key].values.flatten().tolist()
                depth_levels = [float(d) for d in raw_depths if not np.isnan(d)]
            else:
                depth_levels = [0.0, 5.0, 10.0, 20.0, 50.0, 75.0, 100.0, 150.0, 200.0, 300.0, 500.0, 750.0, 1000.0, 1500.0, 2000.0]

            time_range: List[str] = []
            if time_key and time_key in ds:
                time_vals = ds[time_key].values
                time_range = [str(np.datetime_as_string(t, unit="s")) if isinstance(t, np.datetime64) else str(t) for t in time_vals]
            else:
                time_range = ["2026-08-23T00:00:00Z"]

            variables = []
            var_info = {}
            for name, da in ds.data_vars.items():
                if len(da.shape) >= 2:
                    variables.append(name)
                    var_info[name] = {
                        "long_name": da.attrs.get("long_name", name),
                        "units": da.attrs.get("units", "unitless"),
                        "shape": list(da.shape),
                    }

            return {
                "filename": os.path.basename(path),
                "title": ds.attrs.get("title", "ROMS/INDOFOS Indian Ocean Model Output"),
                "source": ds.attrs.get("source", "INCOIS Ocean Modeling Framework"),
                "bounds": bounds,
                "depth_levels": depth_levels,
                "time_range": time_range,
                "variables": variables,
                "variable_info": var_info,
                "dimensions": {str(k): int(v) for k, v in ds.sizes.items()},
            }
