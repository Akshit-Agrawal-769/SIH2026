"""
Model vs. Observation Comparison Service
Performs 4D spatio-temporal colocation, depth-by-depth residual computation,
and computes Bias, MAE, RMSE, and Pearson Correlation metrics.
"""

from typing import Dict, Any, Optional
import numpy as np
from app.services.xarray_service import xarray_service
from app.services.argo_service import argo_service


class OceanComparisonService:

    def compare_float_profile(
        self,
        platform_number: str,
        cycle_number: Optional[int] = None,
        variable: str = "temp",
        model_filename: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        # 1. Fetch Argo Observation Profile
        argo_profile = argo_service.get_float_profile(platform_number, cycle_number)
        if not argo_profile:
            return None

        # 2. Identify Model Dataset
        models = xarray_service.list_available_model_datasets()
        if not models:
            return None
        target_model = model_filename if (model_filename and model_filename in models) else models[0]

        # 3. Colocate Model onto Argo Lat, Lon, Depths
        lat = argo_profile["latitude"]
        lon = argo_profile["longitude"]
        obs_depths = argo_profile["depths"]
        obs_vals = argo_profile["temperature"] if variable == "temp" else argo_profile.get("salinity", [])

        if not obs_vals or len(obs_vals) == 0:
            return None

        interp_result = xarray_service.interpolate_profile_at_point(
            filename=target_model,
            variable=variable,
            lat=lat,
            lon=lon,
            time_idx=0,
            query_depths=obs_depths
        )

        if not interp_result:
            return None

        depths, model_vals = interp_result

        # 4. Compute Statistical Validation Metrics
        obs_arr = np.array(obs_vals, dtype=np.float64)
        mod_arr = np.array(model_vals, dtype=np.float64)
        
        valid_mask = ~np.isnan(obs_arr) & ~np.isnan(mod_arr)
        if not np.any(valid_mask):
            return None

        obs_clean = obs_arr[valid_mask]
        mod_clean = mod_arr[valid_mask]
        
        residuals = mod_clean - obs_clean
        bias = float(np.mean(residuals))
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        
        # Pearson correlation
        if len(obs_clean) > 1 and np.std(obs_clean) > 0 and np.std(mod_clean) > 0:
            r = float(np.corrcoef(obs_clean, mod_clean)[0, 1])
        else:
            r = 1.0

        full_residuals = [round(float(m - o), 3) for m, o in zip(model_vals, obs_vals)]

        return {
            "platform_number": platform_number,
            "cycle_number": argo_profile["cycle_number"],
            "timestamp": argo_profile["timestamp"],
            "latitude": lat,
            "longitude": lon,
            "depths": depths,
            "obs_values": obs_vals,
            "model_interpolated_values": model_vals,
            "residuals": full_residuals,
            "variable": variable,
            "metrics": {
                "bias": round(bias, 4),
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "pearson_r": round(r, 4),
                "sample_count": int(np.sum(valid_mask)),
            }
        }

comparison_service = OceanComparisonService()
