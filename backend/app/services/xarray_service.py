"""
xarray Scientific Data Service
Parses NetCDF ocean datasets, handles coordinate transformations, and extracts Float32 binary slices.
"""

import os
import glob
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import xarray as xr
from scipy.interpolate import RegularGridInterpolator
from app.core.config import settings

class XarrayDataService:
    
    def __init__(self):
        self.datasets_dir = settings.DATASETS_DIR

    def list_available_model_datasets(self) -> List[str]:
        model_dir = os.path.join(self.datasets_dir, "model")
        if not os.path.exists(model_dir):
            return []
        files = glob.glob(os.path.join(model_dir, "*.nc")) + glob.glob(os.path.join(model_dir, "*.nc4"))
        return [os.path.basename(f) for f in files]

    def get_model_dataset_path(self, filename: str) -> Optional[str]:
        path = os.path.join(self.datasets_dir, "model", filename)
        return path if os.path.exists(path) else None

    def get_metadata(self, filename: str) -> Optional[Dict[str, Any]]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None
            
        try:
            ds = xr.open_dataset(filepath, engine="h5netcdf" if filepath.endswith(".nc4") else "netcdf4")
            
            lats = ds["lat"].values if "lat" in ds else [4.0, 26.0]
            lons = ds["lon"].values if "lon" in ds else [58.0, 96.0]
            depths = ds["depth"].values if "depth" in ds else (ds["s_rho"].values if "s_rho" in ds else [0.0])
            times = [str(t) for t in ds["time"].values] if "time" in ds else ["2026-08-20T00:00:00"]
            
            vars_list = [v for v in ds.data_vars if v in ["temp", "salt", "u", "v", "w", "chl", "temperature", "salinity"]]
            
            var_info = {}
            for v in vars_list:
                var_info[v] = {
                    "units": ds[v].attrs.get("units", ""),
                    "long_name": ds[v].attrs.get("long_name", v),
                }

            meta = {
                "filename": filename,
                "title": ds.attrs.get("title", "INCOIS ROMS Ocean Forecast"),
                "source": ds.attrs.get("source", "INCOIS"),
                "bounds": {
                    "min_lon": float(np.min(lons)),
                    "max_lon": float(np.max(lons)),
                    "min_lat": float(np.min(lats)),
                    "max_lat": float(np.max(lats)),
                },
                "depth_levels": [float(d) for d in depths],
                "time_range": times,
                "variables": vars_list,
                "variable_info": var_info,
                "dimensions": {k: int(v) for k, v in ds.dims.items()},
            }
            ds.close()
            return meta
        except Exception as e:
            print(f"Error getting dataset metadata: {e}")
            return None

    def extract_2d_slice_buffer(self, filename: str, variable: str, time_idx: int = 0, depth_idx: int = 0) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None
            
        try:
            ds = xr.open_dataset(filepath, engine="h5netcdf" if filepath.endswith(".nc4") else "netcdf4")
            if variable not in ds:
                ds.close()
                return None
                
            var_array = ds[variable]
            if len(var_array.shape) == 4:
                slice_data = var_array.isel(time=time_idx, depth=depth_idx if "depth" in ds.dims else (depth_idx if "s_rho" in ds.dims else 0)).values
            elif len(var_array.shape) == 3:
                slice_data = var_array.isel(time=time_idx).values
            else:
                slice_data = var_array.values

            slice_f32 = np.nan_to_num(slice_data, nan=-9999.0).astype(np.float32)
            
            valid_vals = slice_f32[slice_f32 > -9000]
            min_val = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
            max_val = float(np.max(valid_vals)) if len(valid_vals) > 0 else 1.0
            
            meta = {
                "min_val": min_val,
                "max_val": max_val,
                "variable": variable,
                "units": var_array.attrs.get("units", "")
            }
            
            buffer = slice_f32.tobytes()
            ds.close()
            return buffer, meta
        except Exception as e:
            print(f"Error extracting slice buffer: {e}")
            return None

    def extract_3d_volume_buffer(self, filename: str, variable: str, time_idx: int = 0, target_dims: Tuple[int, int, int] = (64, 64, 32)) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None
            
        try:
            ds = xr.open_dataset(filepath, engine="h5netcdf" if filepath.endswith(".nc4") else "netcdf4")
            if variable not in ds:
                ds.close()
                return None
                
            var_array = ds[variable]
            if len(var_array.shape) == 4:
                vol_data = var_array.isel(time=time_idx).values # Shape: (nz, ny, nx)
            else:
                vol_data = var_array.values
                
            nz, ny, nx = vol_data.shape
            dim_x, dim_y, dim_z = target_dims
            
            # Resample grid to target_dims (dim_z, dim_y, dim_x)
            z_orig = np.linspace(0, 1, nz)
            y_orig = np.linspace(0, 1, ny)
            x_orig = np.linspace(0, 1, nx)
            
            interp = RegularGridInterpolator((z_orig, y_orig, x_orig), vol_data, bounds_error=False, fill_value=np.nan)
            
            z_new = np.linspace(0, 1, dim_z)
            y_new = np.linspace(0, 1, dim_y)
            x_new = np.linspace(0, 1, dim_x)
            
            grid_z, grid_y, grid_x = np.meshgrid(z_new, y_new, x_new, indexing="ij")
            points = np.stack([grid_z.ravel(), grid_y.ravel(), grid_x.ravel()], axis=-1)
            
            resampled_flat = interp(points)
            resampled_3d = resampled_flat.reshape((dim_z, dim_y, dim_x)).astype(np.float32)
            
            valid_vals = resampled_3d[~np.isnan(resampled_3d)]
            min_val = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
            max_val = float(np.max(valid_vals)) if len(valid_vals) > 0 else 1.0

            # Normalize values to [0, 1] range for WebGL 3D DataTexture sampling
            if max_val > min_val:
                norm_3d = (np.nan_to_num(resampled_3d, nan=min_val) - min_val) / (max_val - min_val)
            else:
                norm_3d = np.zeros_like(resampled_3d)

            buffer = norm_3d.astype(np.float32).tobytes()
            
            meta = {
                "min_val": min_val,
                "max_val": max_val,
                "dim_x": dim_x,
                "dim_y": dim_y,
                "dim_z": dim_z,
                "variable": variable,
                "units": var_array.attrs.get("units", "")
            }
            
            ds.close()
            return buffer, meta
        except Exception as e:
            print(f"Error extracting 3D volume buffer: {e}")
            return None

xarray_service = XarrayDataService()
