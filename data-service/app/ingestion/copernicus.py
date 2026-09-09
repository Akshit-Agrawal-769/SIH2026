from datetime import datetime
from typing import Dict, Any, List
import numpy as np

from app.ingestion.base import IngestionAdapter
from app.processing.voxelize import (
    generate_synthetic_ocean_field,
    STANDARD_DEPTH_LEVELS,
    LON_MIN, LON_MAX, LAT_MIN, LAT_MAX,
    GRID_WIDTH, GRID_HEIGHT
)
from app.processing.pack_texture import (
    pack_voxel_buffer,
    upload_tile_to_minio,
    upload_manifest_to_minio
)

VAR_CODES = {
    "temperature": 1,
    "salinity": 2,
    "currents": 3,
    "chlorophyll": 4
}

UNITS = {
    "temperature": "°C",
    "salinity": "PSU",
    "currents": "m/s",
    "chlorophyll": "mg/m³"
}

SAMPLE_TIMESTEPS = [f"2024-06-{d:02d}" for d in range(1, 15)]

class CopernicusIngestionAdapter(IngestionAdapter):
    @property
    def platform_type(self) -> str:
        return "copernicus_phy"

    def fetch(self, start_date: datetime, end_date: datetime, bbox: List[float]) -> Any:
        return {}

    def normalize(self, raw_data: Any) -> List[Dict[str, Any]]:
        return []

    def store(self, normalized_data: List[Dict[str, Any]]) -> int:
        return 0

    def generate_and_store_tiles(self, variables: List[str] = None) -> Dict[str, int]:
        """
        Voxelizes 3D numerical model fields and uploads binary packed textures
        and manifests to MinIO S3 object storage across 14-day rolling window.
        """
        if variables is None:
            variables = ["temperature", "salinity", "chlorophyll", "currents"]

        stats = {}
        for var in variables:
            print(f"[Model Ingestion] Voxelizing and packing 3D field for '{var}' (14 timesteps)...")
            var_code = VAR_CODES.get(var, 1)
            global_min = float("inf")
            global_max = float("-inf")

            tile_count = 0
            for date_str in SAMPLE_TIMESTEPS:
                # Generate dynamic physical field for this specific day
                volume_field, min_val, max_val = generate_synthetic_ocean_field(var, date_str=date_str)
                global_min = min(global_min, min_val)
                global_max = max(global_max, max_val)

                # Pack each depth slice as a binary tile for rapid streaming
                for depth_idx, depth in enumerate(STANDARD_DEPTH_LEVELS):
                    depth_slice = volume_field[:, :, depth_idx]
                    binary_tile = pack_voxel_buffer(
                        depth_slice,
                        variable_code=var_code,
                        min_val=min_val,
                        max_val=max_val,
                        depth_levels_count=1
                    )
                    upload_tile_to_minio(var, date_str, depth, binary_tile)
                    tile_count += 1

            # Upload JSON manifest
            manifest = {
                "variable": var,
                "units": UNITS.get(var, ""),
                "bbox": [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX],
                "grid": {
                    "lon_min": LON_MIN,
                    "lon_max": LON_MAX,
                    "lat_min": LAT_MIN,
                    "lat_max": LAT_MAX,
                    "width": GRID_WIDTH,
                    "height": GRID_HEIGHT,
                    "depth_levels": STANDARD_DEPTH_LEVELS
                },
                "timesteps": SAMPLE_TIMESTEPS,
                "value_range": [round(global_min, 2), round(global_max, 2)]
            }
            upload_manifest_to_minio(var, manifest)
            stats[var] = tile_count
            print(f"[Model Ingestion] Uploaded {tile_count} tiles and manifest for '{var}' to MinIO!")

        return stats
