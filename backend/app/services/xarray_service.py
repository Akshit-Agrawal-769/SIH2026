"""
xarray Scientific Data Service
Parses NetCDF ocean datasets, handles coordinate transformations, and extracts Float32 binary slices.
"""

import os
import glob
from typing import List, Dict, Any, Optional
import numpy as np
import xarray as xr
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

    def list_available_argo_datasets(self) -> List[str]:
        argo_dir = os.path.join(self.datasets_dir, "argo")
        if not os.path.exists(argo_dir):
            return []
        files = glob.glob(os.path.join(argo_dir, "*.nc"))
        return [os.path.basename(f) for f in files]

    def get_model_dataset_path(self, filename: str) -> Optional[str]:
        path = os.path.join(self.datasets_dir, "model", filename)
        return path if os.path.exists(path) else None

    def extract_2d_slice_buffer(self, filename: str, variable: str, time_idx: int = 0, depth_idx: int = 0) -> Optional[bytes]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None
            
        try:
            ds = xr.open_dataset(filepath, engine="h5netcdf" if filepath.endswith(".nc4") else "netcdf4")
            if variable not in ds:
                ds.close()
                return None
                
            var_array = ds[variable]
            # Handle 4D (time, depth, lat, lon) or 3D slices
            if len(var_array.shape) == 4:
                slice_data = var_array.isel(time=time_idx, s_rho=depth_idx if "s_rho" in ds.dims else 0).values
            elif len(var_array.shape) == 3:
                slice_data = var_array.isel(time=time_idx).values
            else:
                slice_data = var_array.values

            slice_f32 = np.nan_to_num(slice_data, nan=-9999.0).astype(np.float32)
            buffer = slice_f32.tobytes()
            ds.close()
            return buffer
        except Exception as e:
            print(f"Error extracting slice buffer: {e}")
            return None

xarray_service = XarrayDataService()
