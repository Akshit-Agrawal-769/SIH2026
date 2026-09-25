from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from app import analytics_engine as ae

router = APIRouter(prefix="/variables", tags=["variables"])


@router.get("", response_model=List[Dict[str, Any]])
def get_variables():
    """Variables present in the data catalog, with their real source, units, depths and timesteps."""
    catalog = ae.get_catalog()
    if not catalog:
        raise HTTPException(status_code=503, detail="Data catalog missing; run scripts/build_authentic_dataset.py.")
    out = []
    for var, meta in catalog["variables"].items():
        src = catalog["sources"].get(meta["source_id"], {})
        out.append({
            "id": var,
            "name": meta["long_name"],
            "standard_name": meta["standard_name"],
            "units": meta["units"],
            "source_id": meta["source_id"],
            "source": src.get("title"),
            "source_type": src.get("type"),
            "min_value": meta["value_range"][0],
            "max_value": meta["value_range"][1],
            "display_range": meta["display_range"],
            "depths": meta["depths"],
            "timesteps": meta["timesteps"],
        })
    return out
