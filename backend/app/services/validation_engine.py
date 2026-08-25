"""
Validation Engine Deep Module
Performs 4D spatio-temporal colocation of gridded ocean numerical models onto in-situ observations,
computes depth-resolved residuals, and evaluates quantitative statistical error metrics (Bias, MAE, RMSE, Pearson r).
"""

from typing import Dict, Any, Optional, List, Tuple, Sequence
import numpy as np
from app.services.ocean_model import OceanModel, ocean_model_registry
from app.services.insitu_store import InSituStore, insitu_store


class ValidationEngine:
    """Deep module for 4D model-vs-observation colocation and statistical error scorecard computation."""

    def __init__(
        self,
        model_registry: Optional[Any] = None,
        obs_store: Optional[InSituStore] = None
    ):
        self.registry = model_registry or ocean_model_registry
        self.store = obs_store or insitu_store

    def compute_metrics(
        self,
        obs_values: Sequence[Optional[float]],
        model_values: Sequence[Optional[float]]
    ) -> Tuple[Optional[Dict[str, Any]], List[Optional[float]]]:
        """
        Computes statistical error metrics and depth-resolved residuals.
        Preserves mathematical invariants (zero-variance Pearson r = None, sample count >= 1).
        """
        obs_arr = np.array([v if (v is not None and not np.isnan(v)) else np.nan for v in obs_values], dtype=np.float64)
        mod_arr = np.array([v if (v is not None and not np.isnan(v)) else np.nan for v in model_values], dtype=np.float64)

        valid_mask = ~np.isnan(obs_arr) & ~np.isnan(mod_arr)
        if not np.any(valid_mask):
            return None, [None] * len(obs_values)

        obs_clean = obs_arr[valid_mask]
        mod_clean = mod_arr[valid_mask]

        residuals = mod_clean - obs_clean
        bias = float(np.mean(residuals))
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))

        r_val = None
        if len(obs_clean) > 1 and np.std(obs_clean) > 1e-7 and np.std(mod_clean) > 1e-7:
            corr_matrix = np.corrcoef(obs_clean, mod_clean)
            if not np.isnan(corr_matrix[0, 1]):
                r_val = float(round(corr_matrix[0, 1], 4))

        full_residuals = [
            round(float(m - o), 3) if (o is not None and m is not None and not np.isnan(o) and not np.isnan(m)) else None
            for m, o in zip(model_values, obs_values)
        ]

        metrics = {
            "bias": round(bias, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "pearson_r": r_val,
            "sample_count": int(np.sum(valid_mask)),
        }

        return metrics, full_residuals

    def validate_profile(
        self,
        observation: Dict[str, Any],
        model: OceanModel,
        variable: str = "temp"
    ) -> Optional[Dict[str, Any]]:
        """
        Colocates an in-situ observation profile with an OceanModel in 4D space-time
        and generates a depth-resolved validation scorecard.
        """
        lat = observation.get("latitude")
        lon = observation.get("longitude")
        timestamp = observation.get("timestamp")
        obs_depths = observation.get("depths", [])

        if lat is None or lon is None or not timestamp or not obs_depths:
            return None

        # Select requested observation variable
        if variable == "temp":
            obs_vals = observation.get("temperature", [])
        elif variable == "salt":
            obs_vals = observation.get("salinity", [])
        else:
            return None

        if not obs_vals or len(obs_vals) == 0:
            return None

        # Perform 4D spatio-temporal colocation onto observation depth levels
        interp_result = model.sample_profile(
            variable=variable,
            lat=float(lat),
            lon=float(lon),
            target_timestamp=timestamp,
            query_depths=obs_depths
        )

        if not interp_result:
            return None

        depths, model_vals = interp_result

        metrics, full_residuals = self.compute_metrics(obs_vals, model_vals)
        if not metrics:
            return None

        return {
            "platform_number": str(observation.get("platform_number", "UNKNOWN")),
            "cycle_number": int(observation.get("cycle_number", 0)),
            "timestamp": timestamp,
            "latitude": round(float(lat), 4),
            "longitude": round(float(lon), 4),
            "depths": depths,
            "obs_values": [float(v) if (v is not None and not np.isnan(v)) else None for v in obs_vals],
            "model_interpolated_values": [float(v) if (v is not None and not np.isnan(v)) else None for v in model_vals],
            "residuals": full_residuals,
            "variable": variable,
            "metrics": metrics,
        }

    def validate_float(
        self,
        platform_number: str,
        cycle_number: Optional[int] = None,
        variable: str = "temp",
        model_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Convenience method resolving in-situ observation and model from stores."""
        argo_profile = self.store.get_profile(platform_number, cycle_number)
        if not argo_profile:
            return None

        models = self.registry.list_available_models()
        if not models:
            return None

        target_model_name = model_name if (model_name and model_name in models) else models[0]
        model = self.registry.get_model(target_model_name)
        if not model:
            return None

        return self.validate_profile(argo_profile, model, variable=variable)


validation_engine = ValidationEngine()
