from fastapi import APIRouter, HTTPException

from app import analytics_engine as ae

router = APIRouter(prefix="/manifest", tags=["manifest"])


@router.get("/{variable}")
def get_manifest(variable: str):
    """
    Grid, depth levels and the exact list of available timesteps for a variable,
    read from the data catalog generated from the source NetCDF files.
    """
    catalog = ae.get_catalog()
    if not catalog:
        raise HTTPException(status_code=503, detail="Data catalog missing; run scripts/build_authentic_dataset.py.")
    meta = catalog["variables"].get(variable)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Unknown variable '{variable}'.")
    g = catalog["grid"]
    src = catalog["sources"].get(meta["source_id"], {})
    return {
        "variable": variable,
        "units": meta["units"],
        "long_name": meta["long_name"],
        "source_id": meta["source_id"],
        "source": src.get("title"),
        "source_type": src.get("type"),
        "bbox": g["bbox"],
        "grid": {k: g[k] for k in ("width", "height", "lon0", "lat0", "dlon", "dlat", "registration", "row_order")},
        "depth_levels": meta["depths"],
        "vertical_coverage": meta.get("vertical_coverage"),
        "timesteps": meta["timesteps"],
        "value_range": meta["value_range"],
        "display_range": meta["display_range"],
    }
