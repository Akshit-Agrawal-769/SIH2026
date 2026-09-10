from fastapi import APIRouter, Response, HTTPException
from typing import Optional
from app.processing.pack_texture import download_tile_from_minio, pack_voxel_buffer
from app.processing.voxelize import generate_synthetic_ocean_slice, STANDARD_DEPTH_LEVELS

router = APIRouter(prefix="/tiles", tags=["tiles"])

VAR_CODES = {
    "temperature": 1,
    "salinity": 2,
    "currents": 3,
    "chlorophyll": 4
}

@router.get("/{variable}/{date}/{depth}")
def get_tile(variable: str, date: str, depth: float):
    """
    Retrieve binary packed voxel depth slice from MinIO object storage.
    Layout: 32-byte header ('INCO' magic) + Float32Array payload.
    """
    # 1. Try reading from MinIO
    tile_bytes = download_tile_from_minio(variable, date, depth)

    if tile_bytes:
        return Response(
            content=tile_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'inline; filename="{variable}_{date}_{depth}.bin"',
                "Cache-Control": "public, max-age=86400",
                "X-Data-Source": "MinIO"
            }
        )

    # 2. Fallback: generate and pack on-the-fly directly in ~35ms
    depth_slice, min_val, max_val = generate_synthetic_ocean_slice(variable, float(depth), date_str=date)
    var_code = VAR_CODES.get(variable, 1)
    binary_data = pack_voxel_buffer(depth_slice, var_code, min_val, max_val, 1)

    return Response(
        content=binary_data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{variable}_{date}_{depth}.bin"',
            "Cache-Control": "public, max-age=3600",
            "X-Data-Source": "Dynamic"
        }
    )
