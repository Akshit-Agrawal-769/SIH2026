import struct
import io
import os
import json
import numpy as np
from typing import Dict, Any, Optional
from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ocean-data")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

def get_minio_client() -> Minio:
    """Returns an authenticated MinIO S3 client."""
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE
    )

def ensure_bucket_exists(client: Minio):
    """Ensures that the target MinIO bucket exists."""
    try:
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
    except Exception as e:
        print(f"[MinIO] Bucket check notice: {e}")

def pack_voxel_buffer(
    field_slice: np.ndarray,
    variable_code: int,
    min_val: float,
    max_val: float,
    depth_levels_count: int = 1
) -> bytes:
    """
    Packs a 2D or 3D numpy float array into the standard 32-byte header binary layout:
    Header (32 bytes):
      magic: 'INCO' (4s)
      version: 1 (H)
      var_code: 1=Temp, 2=Salin, 3=Currents, 4=Chl (H)
      width: 220 (H)
      height: 180 (H)
      depth: (H)
      data_type: 1=Float32 (H)
      min_val: (f)
      max_val: (f)
      reserved: 8 bytes (8s)
    Body:
      Continuous Float32 values.
    """
    height, width = field_slice.shape[:2]
    magic = b"INCO"
    version = 1
    data_type = 1 # Float32
    reserved = b"\x00" * 8

    header = struct.pack(
        "<4sHHHHHHff8s",
        magic,
        version,
        variable_code,
        width,
        height,
        depth_levels_count,
        data_type,
        float(min_val),
        float(max_val),
        reserved
    )

    float_data = field_slice.astype(np.float32).tobytes()
    return header + float_data

def upload_tile_to_minio(
    variable: str,
    date_str: str,
    depth: float,
    binary_data: bytes
) -> str:
    """Uploads packed binary tile to MinIO under tiles/{variable}/{date}/{depth}.bin"""
    client = get_minio_client()
    ensure_bucket_exists(client)

    object_name = f"tiles/{variable}/{date_str}/{depth}.bin"
    data_stream = io.BytesIO(binary_data)
    client.put_object(
        MINIO_BUCKET,
        object_name,
        data_stream,
        length=len(binary_data),
        content_type="application/octet-stream"
    )
    return object_name

def upload_manifest_to_minio(variable: str, manifest_data: Dict[str, Any]):
    """Uploads manifest.json for a variable to MinIO."""
    client = get_minio_client()
    ensure_bucket_exists(client)

    object_name = f"manifests/{variable}_manifest.json"
    json_bytes = json.dumps(manifest_data, indent=2).encode('utf-8')
    client.put_object(
        MINIO_BUCKET,
        object_name,
        io.BytesIO(json_bytes),
        length=len(json_bytes),
        content_type="application/json"
    )

def download_tile_from_minio(variable: str, date_str: str, depth: float) -> Optional[bytes]:
    """
    Retrieves authentic binary tile directly from the local authoritative C++ tile repository,
    or from MinIO S3 object storage if deployed.
    """
    # 1. Check local authoritative real tile repository produced by C++ ocean_core FIRST
    search_paths = [
        os.path.join(os.getcwd(), "tiles", variable, date_str, f"{depth}.bin"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "tiles", variable, date_str, f"{depth}.bin"),
        os.path.join(os.path.dirname(__file__), "..", "..", "tiles", variable, date_str, f"{depth}.bin"),
        os.path.abspath(f"tiles/{variable}/{date_str}/{depth}.bin"),
        f"D:/OneDrive/Desktop/sih/tiles/{variable}/{date_str}/{depth}.bin"
    ]
    for p in search_paths:
        if os.path.exists(p):
            try:
                with open(p, "rb") as f:
                    return f.read()
            except Exception as e:
                print(f"[TileStore] Error reading {p}: {e}")

    # 2. Try MinIO S3 object storage
    object_name = f"tiles/{variable}/{date_str}/{depth}.bin"
    try:
        client = get_minio_client()
        response = client.get_object(MINIO_BUCKET, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        if data:
            return data
    except Exception:
        pass

    return None
