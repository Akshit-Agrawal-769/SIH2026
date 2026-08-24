"""
Model vs. Observation Comparison Service
Performs 4D spatio-temporal colocation, depth-by-depth residual computation,
and calculates Bias, MAE, RMSE, and Pearson Correlation metrics with strict QC validation.
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
        # 1. Fetch Authentic Argo Observation Profile with QC Filtering
        argo_profile = argo_service.get_float_profile(platform_number, cycle_number)
        if not argo_profile:
            return None

        # 2. Identify Model Dataset from Manifest/Available Datasets
        models = xarray_service.list_available_model_datasets()
        if not models:
            return None
        target_model = model_filename if (model_filename and model_filename in models) else models[0]

        # 3. Colocate Model onto Argo (lat, lon, depth, time)
        lat = argo_profile["latitude"]
        lon = argo_profile["longitude"]
        timestamp = argo_profile["timestamp"]
        obs_depths = argo_profile["depths"]
        
        # Select observation variable and filter QC
        if variable == "temp":
            obs_vals = argo_profile.get("temperature", [])
        elif variable == "salt":
            obs_vals = [s if s is not None else np.nan for s in argo_profile.get("salinity", [])]
        else:
            return None

        if not obs_vals or len(obs_vals) == 0:
            return None

        # Perform 4D spatio-temporal interpolation with target timestamp
        interp_result = xarray_service.interpolate_profile_at_point(
            filename=target_model,
            variable=variable,
            lat=lat,
            lon=lon,
            target_timestamp=timestamp,
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
        
        # Pearson correlation (returns None if variance is zero)
        r_val = None
        if len(obs_clean) > 1 and np.std(obs_clean) > 1e-7 and np.std(mod_clean) > 1e-7:
            corr_matrix = np.corrcoef(obs_clean, mod_clean)
            if not np.isnan(corr_matrix[0, 1]):
                r_val = float(round(corr_matrix[0, 1], 4))

        full_residuals = [
            round(float(m - o), 3) if not np.isnan(o) and not np.isnan(m) else 0.0
            for m, o in zip(model_vals, obs_vals)
        ]

        return {
            "platform_number": platform_number,
            "cycle_number": argo_profile["cycle_number"],
            "timestamp": timestamp,
            "latitude": lat,
            "longitude": lon,
            "depths": depths,
            "obs_values": [float(v) if not np.isnan(v) else 0.0 for v in obs_vals],
            "model_interpolated_values": model_vals,
            "residuals": full_residuals,
            "variable": variable,
            "metrics": {
                "bias": round(bias, 4),
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "pearson_r": r_val,
                "sample_count": int(np.sum(valid_mask)),
            }
        }

comparison_service = OceanComparisonService()
