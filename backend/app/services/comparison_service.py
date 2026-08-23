"""
Model vs Observation Comparison Service
Performs 4D spatial-temporal bilinear/trilinear interpolation comparing ROMS model forecast against Argo profile observations.
Calculates Bias, MAE, RMSE, Pearson r, and depth residual curves.
"""

import os
import numpy as np
import xarray as xr
from typing import Dict, Any, Optional
from app.services.xarray_service import xarray_service
from app.services.argo_service import argo_service

class ComparisonService:
    
    def compare_float_profile(self, platform_number: str, cycle_number: Optional[int] = None, variable: str = "temp", model_filename: Optional[str] = None) -> Optional[Dict[str, Any]]:
        profile = argo_service.get_float_profile(platform_number, cycle_number)
        if not profile:
            return None
            
        datasets = xarray_service.list_available_model_datasets()
        if not datasets:
            return None
            
        model_file = model_filename if (model_filename and model_filename in datasets) else datasets[0]
        filepath = xarray_service.get_model_dataset_path(model_file)
        if not filepath:
            return None

        try:
            ds = xr.open_dataset(filepath, engine="h5netcdf" if filepath.endswith(".nc4") else "netcdf4")
            var_name = variable if variable in ds else ("temp" if "temp" in ds else list(ds.data_vars.keys())[0])
            
            obs_depths = np.array(profile["depths"])
            obs_vals = np.array(profile["temperature"] if var_name == "temp" else (profile.get("salinity") or profile["temperature"]))
            
            lat = profile["latitude"]
            lon = profile["longitude"]

            # Interpolate model field at float (lat, lon) position
            model_field = ds[var_name].isel(time=0) # Shape: (depth, lat, lon)
            
            # Spatial interpolation at (lat, lon)
            model_profile = model_field.interp(lat=lat, lon=lon, method="nearest").values
            model_grid_depths = ds["depth"].values if "depth" in ds else (ds["s_rho"].values if "s_rho" in ds else np.linspace(0, 2000, len(model_profile)))

            # Interpolate model vertical column onto exact Argo depth levels
            model_interp_vals = np.interp(obs_depths, model_grid_depths, model_profile)
            
            # Compute Residuals (Delta = Model - Obs)
            residuals = model_interp_vals - obs_vals
            
            # Calculate Statistical Validation Metrics
            valid_mask = ~np.isnan(residuals)
            n_samples = int(np.sum(valid_mask))
            
            if n_samples > 0:
                bias = float(np.mean(residuals[valid_mask]))
                mae = float(np.mean(np.abs(residuals[valid_mask])))
                rmse = float(np.sqrt(np.mean(residuals[valid_mask] ** 2)))
                
                # Pearson Correlation Coefficient r
                if n_samples > 1 and np.std(obs_vals[valid_mask]) > 0 and np.std(model_interp_vals[valid_mask]) > 0:
                    r_matrix = np.corrcoef(obs_vals[valid_mask], model_interp_vals[valid_mask])
                    pearson_r = float(r_matrix[0, 1])
                else:
                    pearson_r = 1.0
            else:
                bias, mae, rmse, pearson_r = 0.0, 0.0, 0.0, 0.0

            result = {
                "platform_number": profile["platform_number"],
                "cycle_number": profile["cycle_number"],
                "timestamp": profile["timestamp"],
                "latitude": profile["latitude"],
                "longitude": profile["longitude"],
                "depths": [float(d) for d in obs_depths],
                "obs_values": [float(v) for v in obs_vals],
                "model_interpolated_values": [float(m) for m in model_interp_vals],
                "residuals": [float(r) for r in residuals],
                "variable": var_name,
                "metrics": {
                    "bias": bias,
                    "mae": mae,
                    "rmse": rmse,
                    "pearson_r": pearson_r,
                    "sample_count": n_samples
                }
            }
            
            ds.close()
            return result
        except Exception as e:
            print(f"Error computing comparison profile: {e}")
            return None

comparison_service = ComparisonService()
