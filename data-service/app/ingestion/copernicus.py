import os
import json
from datetime import datetime
from typing import Dict, Any, List

from app import analytics_engine as ae
from app.ingestion.base import IngestionAdapter
from app.processing.pack_texture import (
    upload_tile_to_minio,
    upload_manifest_to_minio
)


class CopernicusIngestionAdapter(IngestionAdapter):
    """
    Gridded-field adapter. Gridded tiles are produced offline by
    scripts/build_authentic_dataset.py; this adapter only mirrors the catalogued
    tiles into MinIO (optional object storage). It never generates field values.
    """

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
        """Upload every catalogued tile (and a manifest per variable) to MinIO."""
        catalog = ae.get_catalog(live=False)  # mirror the static export, not the on-demand record
        if not catalog:
            print("[Model Ingestion] No data catalog found; run scripts/build_authentic_dataset.py first.")
            return {}
        stats: Dict[str, int] = {}
        for var, meta in catalog["variables"].items():
            if variables and var not in variables:
                continue
            count = 0
            for date_str in meta["timesteps"]:
                for depth in meta["depths"]:
                    path = ae.tile_path(var, date_str, depth)
                    if not path:
                        continue
                    with open(path, "rb") as f:
                        upload_tile_to_minio(var, date_str, depth, f.read())
                    count += 1
            manifest_path = os.path.join(ae.get_data_root(), "api", "manifest", f"{var}.json")
            if os.path.isfile(manifest_path):
                with open(manifest_path, encoding="utf-8") as f:
                    upload_manifest_to_minio(var, json.load(f))
            stats[var] = count
            print(f"[Model Ingestion] Uploaded {count} catalogued tiles for '{var}' to MinIO.")
        return stats
