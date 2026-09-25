from fastapi import APIRouter, Response, HTTPException

from app import analytics_engine as ae
from app.processing.pack_texture import download_tile_from_minio

router = APIRouter(prefix="/tiles", tags=["tiles"])


@router.get("/{variable}/{date}/{depth}")
def get_tile(variable: str, date: str, depth: float):
    """
    Binary depth-slice tile: 32-byte 'INCO' header + little-endian Float32 payload
    (row 0 = southernmost latitude, NaN = no data).
    Only (variable, date, depth) combinations listed in the data catalog are served;
    anything else is an explicit 404. No synthetic fallback.
    """
    meta = ae.variable_meta(variable)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Unknown variable '{variable}'.")
    d = ae.normalize_date(date)
    if d is None:
        raise HTTPException(status_code=400, detail=f"Invalid date '{date}' (expected YYYY-MM-DD).")

    path = ae.tile_path(variable, d, depth)
    tile_bytes = None
    if path:
        with open(path, "rb") as f:
            tile_bytes = f.read()
    elif d in meta["timesteps"]:
        tile_bytes = download_tile_from_minio(variable, d, depth)

    if not tile_bytes:
        raise HTTPException(
            status_code=404,
            detail=(f"No '{variable}' data at {d}, depth {depth} m. Available depths: {meta['depths']}; "
                    f"timesteps: {meta['timesteps'][0]} .. {meta['timesteps'][-1]}."),
        )
    try:
        ae.parse_tile(tile_bytes, meta["var_code"])
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupt tile for '{variable}' {d}: {exc}")

    return Response(
        content=tile_bytes,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{variable}_{d}_{ae.depth_key(depth)}.bin"',
            "Cache-Control": "public, max-age=86400",
            "X-Data-Source": meta["source_id"],
            "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
        },
    )
