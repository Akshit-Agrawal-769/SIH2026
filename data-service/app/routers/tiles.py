from fastapi import APIRouter, Response, HTTPException
from typing import Optional
from app.processing.pack_texture import download_tile_from_minio

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
    Retrieve authentic binary packed voxel depth slice from authoritative C++ pipeline.
    Layout: 32-byte header ('INCO' magic) + Float32Array payload.
    STRICT REAL DATA POLICY: Returns HTTP 404 if no real data is available. ZERO synthetic generation.
    """
    if variable not in VAR_CODES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported variable '{variable}'. Authentic variables supported: temperature, salinity, currents, chlorophyll."
        )

    # 1. Retrieve authentic packed tile from C++ tile store or MinIO
    tile_bytes = download_tile_from_minio(variable, date, depth)

    if tile_bytes:
        return Response(
            content=tile_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'inline; filename="{variable}_{date}_{depth}.bin"',
                "Cache-Control": "public, max-age=86400",
                "X-Data-Source": "Authentic-NetCDF",
                "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC"
            }
        )

    # 2. Strict policy: NO synthetic fallback. Return explicit HTTP 404
    raise HTTPException(
        status_code=404,
        detail=f"No authentic oceanographic tile available for variable '{variable}' at date '{date}', depth {depth}m. Strictly NO synthetic/mock data permitted per project policy."
    )
