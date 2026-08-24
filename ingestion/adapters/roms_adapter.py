"""
INCOIS ROMS / Ocean Numerical Model NetCDF Adapter
Native support for:
1. Terrain-following s-coordinates (s_rho, Cs_r, h, hc, zeta, Vtransform=1, 2)
2. Curvilinear orthogonal Arakawa-C grids (lon_rho, lat_rho, mask_rho)
3. Standard CF-1.6 vertical depth coordinates (depth, lev, z)
"""

import os
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import xarray as xr
from ingestion.adapters.base_adapter import BaseOceanAdapter


def calculate_roms_vertical_depths(
    s_rho: np.ndarray,
    Cs_r: np.ndarray,
    h: np.ndarray,
    hc: float,
    zeta: Optional[np.ndarray] = None,
    Vtransform: int = 2
) -> np.ndarray:
    """
    Computes true physical vertical depths z (meters, negative below surface)
    for ROMS terrain-following vertical s-coordinates.
    
    Vtransform = 1 (ROMS original):
        S(x,y,s) = hc * s + (h(x,y) - hc) * C(s)
        z(x,y,s,t) = S(x,y,s) + zeta(x,y,t) * (1 + S(x,y,s) / h(x,y))
        
    Vtransform = 2 (ROMS modern default):
        S(x,y,s) = (hc * s + h(x,y) * C(s)) / (hc + h(x,y))
        z(x,y,s,t) = zeta(x,y,t) + (zeta(x,y,t) + h(x,y)) * S(x,y,s)
    """
    h_arr = np.asarray(h, dtype=np.float64)
    s_arr = np.asarray(s_rho, dtype=np.float64)
    Cs_arr = np.asarray(Cs_r, dtype=np.float64)
    
    if zeta is None:
        zeta_arr = np.zeros_like(h_arr, dtype=np.float64)
    else:
        zeta_arr = np.asarray(zeta, dtype=np.float64)

    # Reshape s and Cs for broadcasting with (ny, nx)
    # s is shape (N,), h is shape (ny, nx) -> target shape (N, ny, nx)
    s_3d = s_arr[:, np.newaxis, np.newaxis] if h_arr.ndim == 2 else s_arr
    Cs_3d = Cs_arr[:, np.newaxis, np.newaxis] if h_arr.ndim == 2 else Cs_arr
    h_3d = h_arr[np.newaxis, :, :] if h_arr.ndim == 2 else h_arr
    zeta_3d = zeta_arr[np.newaxis, :, :] if zeta_arr.ndim == 2 else zeta_arr

    if Vtransform == 1:
        S = hc * s_3d + (h_3d - hc) * Cs_3d
        z = S + zeta_3d * (1.0 + S / np.maximum(h_3d, 1e-4))
    else:  # Vtransform == 2
        S = (hc * s_3d + h_3d * Cs_3d) / (hc + h_3d)
        z = zeta_3d + (zeta_3d + h_3d) * S

    return z.astype(np.float32)


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

    def is_curvilinear(self, ds: xr.Dataset) -> bool:
        """Returns True if model grid coordinates are 2D curvilinear (lon_rho, lat_rho)."""
        for k in ["lon_rho", "lat_rho", "nav_lon", "nav_lat"]:
            if k in ds and ds[k].ndim == 2:
                return True
        return False

    def has_native_s_coordinates(self, ds: xr.Dataset) -> bool:
        """Returns True if model uses native terrain-following s-coordinates."""
        return "s_rho" in ds.dims or "s_rho" in ds.coords or "Cs_r" in ds

    def extract_metadata(self, file_path_or_url: Optional[str] = None) -> Dict[str, Any]:
        path = file_path_or_url or self.file_path
        with xr.open_dataset(path) as ds:
            # 1. Resolve Coordinate Keys
            lon_key = next((k for k in ["lon", "longitude", "lon_rho", "x", "nav_lon"] if k in ds.coords or k in ds.data_vars), None)
            lat_key = next((k for k in ["lat", "latitude", "lat_rho", "y", "nav_lat"] if k in ds.coords or k in ds.data_vars), None)
            time_key = next((k for k in ["time", "ocean_time", "time_counter"] if k in ds.coords or k in ds.data_vars), None)
            depth_key = next((k for k in ["depth", "lev", "level", "z", "deptht", "s_rho"] if k in ds.coords or k in ds.dims), None)

            if not lon_key or not lat_key:
                raise ValueError("MODEL_SPATIAL_COORDINATE_MISSING: Model NetCDF lacks spatial coordinates (longitude/latitude).")

            lon_vals = ds[lon_key].values
            lat_vals = ds[lat_key].values

            bounds = {
                "min_lon": float(np.nanmin(lon_vals)),
                "max_lon": float(np.nanmax(lon_vals)),
                "min_lat": float(np.nanmin(lat_vals)),
                "max_lat": float(np.nanmax(lat_vals)),
            }

            # 2. Resolve Vertical Depths (Standard vs Native s_rho)
            depth_levels: List[float] = []
            if self.has_native_s_coordinates(ds) and "Cs_r" in ds and "h" in ds:
                s_rho = ds["s_rho"].values if "s_rho" in ds else np.linspace(-1, 0, len(ds["Cs_r"]))
                Cs_r = ds["Cs_r"].values
                hc = float(ds["hc"].values) if "hc" in ds else 10.0
                h_mean = float(np.nanmean(ds["h"].values))
                Vtransform = int(ds["Vtransform"].values) if "Vtransform" in ds else 2
                
                # Representative 1D depth levels from mean bathymetry
                z_rep = calculate_roms_vertical_depths(s_rho, Cs_r, np.array([h_mean]), hc, Vtransform=Vtransform)
                depth_levels = sorted([round(float(-z), 2) for z in z_rep.flatten() if not np.isnan(z)])
            elif depth_key and depth_key in ds:
                raw_depths = ds[depth_key].values.flatten().tolist()
                depth_levels = sorted([abs(float(d)) for d in raw_depths if not np.isnan(d)])
            else:
                raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Model NetCDF lacks vertical depth coordinates.")

            # 3. Resolve Time Series
            time_range: List[str] = []
            if time_key and time_key in ds:
                time_vals = ds[time_key].values
                time_range = [
                    str(np.datetime_as_string(t, unit="s")) if isinstance(t, np.datetime64) else str(t)
                    for t in time_vals
                ]
            else:
                raise ValueError("MODEL_TIME_COORDINATE_MISSING: Model NetCDF lacks time coordinate.")

            # 4. Resolve Variables
            variables = []
            var_info = {}
            for name, da in ds.data_vars.items():
                if len(da.shape) >= 2 and name not in ["lon_rho", "lat_rho", "mask_rho", "h", "Cs_r", "Cs_w"]:
                    variables.append(name)
                    var_info[name] = {
                        "long_name": da.attrs.get("long_name", name),
                        "units": da.attrs.get("units", "unitless"),
                        "shape": list(da.shape),
                    }

            grid_type = "curvilinear" if self.is_curvilinear(ds) else "rectilinear"

            return {
                "filename": os.path.basename(path),
                "title": ds.attrs.get("title", "ROMS/INDOFOS Indian Ocean Model Output"),
                "source": ds.attrs.get("source", "INCOIS Ocean Modeling Framework"),
                "grid_type": grid_type,
                "is_native_s_coord": self.has_native_s_coordinates(ds),
                "bounds": bounds,
                "depth_levels": depth_levels,
                "time_range": time_range,
                "variables": variables,
                "variable_info": var_info,
                "dimensions": {str(k): int(v) for k, v in ds.sizes.items()},
            }
