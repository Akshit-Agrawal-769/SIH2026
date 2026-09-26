import io
import os
import json
from typing import Dict, Any, Optional
try:
    from minio import Minio
except ImportError:
    Minio = None

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "ocean-data")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
ENABLE_MINIO = os.getenv("ENABLE_MINIO", "false").lower() == "true"

def get_minio_client():
    """Returns an authenticated MinIO S3 client."""
    if Minio is None:
        raise RuntimeError("minio package is not installed")
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

def upload_tile_to_minio(
    variable: str,
    date_str: str,
    depth: float,
    binary_data: bytes
) -> str:
    """Uploads packed binary tile to MinIO under tiles/{variable}/{date}/{depth}.bin"""
    client = get_minio_client()
    ensure_bucket_exists(client)

    object_name = f"tiles/{variable}/{date_str}/{float(depth):.1f}.bin"
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
    Retrieves a tile from MinIO S3 object storage when ENABLE_MINIO=true.
    Local tiles are resolved by app.analytics_engine.tile_path() against the data
    catalog; this function never searches ad-hoc local directories.
    """
    if ENABLE_MINIO:
        object_name = f"tiles/{variable}/{date_str}/{float(depth):.1f}.bin"
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
