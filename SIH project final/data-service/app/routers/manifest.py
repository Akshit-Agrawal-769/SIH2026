from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import json
import os
from minio import Minio
from minio.error import S3Error
from app.processing.voxelize import (
    STANDARD_DEPTH_LEVELS,
    LON_MIN, LON_MAX, LAT_MIN, LAT_MAX,
    GRID_WIDTH, GRID_HEIGHT
)

router = APIRouter(prefix="/manifest", tags=["manifest"])

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ocean-data")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

VARIABLE_CONFIGS: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "units": "°C",
        "value_range": [2.5, 32.0],
        "default_palette": "turbo"
    },
    "salinity": {
        "units": "PSU",
        "value_range": [30.0, 37.5],
        "default_palette": "haline"
    },
    "currents": {
        "units": "m/s",
        "value_range": [0.0, 2.2],
        "default_palette": "viridis"
    },
    "chlorophyll": {
        "units": "mg/m³",
        "value_range": [0.02, 12.0],
        "default_palette": "algae"
    }
}

TIMESTEPS = ["2024-06-01", "2024-06-02", "2024-06-03", "2024-06-04", "2024-06-05"]

@router.get("/{variable}")
def get_manifest(variable: str):
    """Retrieve spatial grid, depth levels, and available timesteps for a variable."""
    # 1. Check MinIO for manifest
    try:
        client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE
        )
        object_name = f"manifests/{variable}_manifest.json"
        response = client.get_object(MINIO_BUCKET, object_name)
        data = json.loads(response.read().decode('utf-8'))
        response.close()
        response.release_conn()
        return data
    except Exception:
        pass

    # 2. Dynamic manifest response
    cfg = VARIABLE_CONFIGS.get(variable, {
        "units": "",
        "value_range": [0.0, 100.0],
        "default_palette": "turbo"
    })

    return {
        "variable": variable,
        "units": cfg["units"],
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
        "timesteps": TIMESTEPS,
        "value_range": cfg["value_range"]
    }
