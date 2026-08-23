"""
xarray Scientific Data Service
Extracts 3D volumetric Float32 buffers, 2D horizontal/vertical slices, and point vertical profiles.
"""

import os
import glob
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import xarray as xr
from scipy.interpolate import RegularGridInterpolator
from app.core.config import settings
from ingestion.adapters.roms_adapter import ROMSModelAdapter


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
        path = self.get_model_dataset_path(filename)
        if not path:
            return None
        adapter = ROMSModelAdapter(path)
        return adapter.extract_metadata()

    def extract_3d_volume_buffer(
        self,
        filename: str,
        variable: str = "temp",
        time_idx: int = 0,
        target_shape: Tuple[int, int, int] = (64, 64, 32)
    ) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        """
        Extracts 3D volumetric array, regularizes to target_shape (nx, ny, nz),
        normalizes data to [0.0, 1.0] for WebGL2 Data3DTexture rendering,
        and returns the raw Float32 byte buffer along with min/max and dimensions.
        """
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None

        try:
            with xr.open_dataset(filepath) as ds:
                if variable not in ds:
                    return None

                da = ds[variable]
                
                # Squeeze time dimension
                if "time" in da.dims:
                    t_len = da.sizes["time"]
                    da_3d = da.isel(time=min(time_idx, t_len - 1))
                else:
                    da_3d = da

                raw_data = da_3d.values.astype(np.float32)
                raw_data = np.nan_to_num(raw_data, nan=np.nan)

                # Reshape/Interpolate to target 3D texture shape (Z, Y, X)
                nx_tgt, ny_tgt, nz_tgt = target_shape[0], target_shape[1], target_shape[2]
                
                shape = raw_data.shape
                if len(shape) == 3:
                    # Current shape is (depth/nz, lat/ny, lon/nx)
                    nz_curr, ny_curr, nx_curr = shape
                    z_in = np.linspace(0, 1, nz_curr)
                    y_in = np.linspace(0, 1, ny_curr)
                    x_in = np.linspace(0, 1, nx_curr)
                    
                    mean_val = float(np.nanmean(raw_data)) if not np.isnan(np.nanmean(raw_data)) else 0.0
                    interp = RegularGridInterpolator((z_in, y_in, x_in), raw_data, bounds_error=False, fill_value=mean_val)
                    
                    # Create target regular grid for WebGL volume (nz, ny, nx)
                    z_out = np.linspace(0, 1, nz_tgt)
                    y_out = np.linspace(0, 1, ny_tgt)
                    x_out = np.linspace(0, 1, nx_tgt)
                    
                    grid_z, grid_y, grid_x = np.meshgrid(z_out, y_out, x_out, indexing="ij")
                    vol_interp = interp((grid_z, grid_y, grid_x)).astype(np.float32)
                else:
                    vol_interp = np.zeros((nz_tgt, ny_tgt, nx_tgt), dtype=np.float32)

                valid_mask = ~np.isnan(vol_interp)
                min_val = float(np.min(vol_interp[valid_mask])) if np.any(valid_mask) else 0.0
                max_val = float(np.max(vol_interp[valid_mask])) if np.any(valid_mask) else 1.0

                if max_val == min_val:
                    max_val += 1e-5

                # Normalize to [0.0, 1.0] for WebGL 3D texture rendering
                vol_norm = np.clip((vol_interp - min_val) / (max_val - min_val), 0.0, 1.0).astype(np.float32)
                vol_norm = np.nan_to_num(vol_norm, nan=0.0)

                # Return raw Float32 byte buffer
                buffer = vol_norm.tobytes()

                metadata = {
                    "min_val": min_val,
                    "max_val": max_val,
                    "dim_x": nx_tgt,
                    "dim_y": ny_tgt,
                    "dim_z": nz_tgt,
                    "variable": variable,
                    "units": da.attrs.get("units", ""),
                    "long_name": da.attrs.get("long_name", variable),
                }

                return buffer, metadata

        except Exception as e:
            print(f"Error extracting 3D volume buffer: {e}")
            return None

    def extract_2d_slice_buffer(
        self,
        filename: str,
        variable: str,
        time_idx: int = 0,
        depth_idx: int = 0
    ) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None
            
        try:
            with xr.open_dataset(filepath) as ds:
                if variable not in ds:
                    return None
                    
                da = ds[variable]
                isel_dict = {}
                if "time" in da.dims:
                    isel_dict["time"] = min(time_idx, da.sizes["time"] - 1)
                if "depth" in da.dims:
                    isel_dict["depth"] = min(depth_idx, da.sizes["depth"] - 1)
                elif "s_rho" in da.dims:
                    isel_dict["s_rho"] = min(depth_idx, da.sizes["s_rho"] - 1)

                slice_data = da.isel(**isel_dict).values
                slice_f32 = np.nan_to_num(slice_data, nan=-9999.0).astype(np.float32)
                min_val = float(np.nanmin(slice_data))
                max_val = float(np.nanmax(slice_data))

                meta = {
                    "shape": list(slice_f32.shape),
                    "min_val": min_val,
                    "max_val": max_val,
                    "variable": variable,
                }
                return slice_f32.tobytes(), meta
        except Exception as e:
            print(f"Error extracting 2D slice buffer: {e}")
            return None

    def interpolate_profile_at_point(
        self,
        filename: str,
        variable: str,
        lat: float,
        lon: float,
        time_idx: int = 0,
        query_depths: Optional[List[float]] = None
    ) -> Optional[Tuple[List[float], List[float]]]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None

        try:
            with xr.open_dataset(filepath) as ds:
                if variable not in ds:
                    return None

                da = ds[variable]
                if "time" in da.dims:
                    da = da.isel(time=min(time_idx, da.sizes["time"] - 1))

                lat_key = next((k for k in ["lat", "latitude", "lat_rho", "y"] if k in da.coords or k in da.dims), None)
                lon_key = next((k for k in ["lon", "longitude", "lon_rho", "x"] if k in da.coords or k in da.dims), None)
                depth_key = next((k for k in ["depth", "s_rho", "lev", "level", "z"] if k in da.coords or k in da.dims), None)

                point_da = da.interp({lat_key: lat, lon_key: lon}, method="linear")
                model_depths = ds[depth_key].values.flatten().tolist() if depth_key else [0.0, 50.0, 100.0, 500.0, 1000.0, 2000.0]
                model_values = point_da.values.flatten().tolist()

                if query_depths is not None:
                    valid_idx = [i for i, v in enumerate(model_values) if not np.isnan(v)]
                    if len(valid_idx) < 2:
                        return None
                    clean_d = [model_depths[i] for i in valid_idx]
                    clean_v = [model_values[i] for i in valid_idx]
                    interp_v = np.interp(query_depths, clean_d, clean_v)
                    return query_depths, [float(round(v, 3)) for v in interp_v]

                return model_depths, [float(round(v, 3)) if not np.isnan(v) else 0.0 for v in model_values]

        except Exception as e:
            print(f"Error interpolating profile: {e}")
            return None

xarray_service = XarrayDataService()
