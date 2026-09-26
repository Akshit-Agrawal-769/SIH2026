"""
/api/hazards/* - Disaster Early Warning layers. Thin HTTP wrappers around analytics_engine;
every response carries the same available/reason convention and the layer's caveats.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from app import analytics_engine as ae

router = APIRouter(prefix="/hazards", tags=["hazards"])

LAT = Query(..., ge=-90.0, le=90.0)
LON = Query(..., ge=-180.0, le=180.0)
TILE_LAYERS = ("mhw_intensity", "eddy_convergence", "vorticity", "current_u", "current_v")


@router.get("/layers")
def hazard_layers():
    """Derived-layer catalog entries (dates, methods, caveats)."""
    cat = ae.get_catalog() or {}
    derived = cat.get("derived")
    if not derived:
        return {"available": False, "layers": {},
                "reason": "No derived hazard layers in the catalog. Run "
                          "`python scripts/build_authentic_dataset.py --hazards-only`."}
    return {"available": True, "layers": derived}


@router.get("/tiles/{layer}/{date}")
def hazard_tile(layer: str, date: str):
    """INCO-format tile for a derived layer (derived on demand for IBR months not exported statically)."""
    if layer not in TILE_LAYERS:
        raise HTTPException(404, f"Unknown hazard layer '{layer}'. Available: {', '.join(TILE_LAYERS)}")
    body, reason, d = ae.derived_tile_bytes(layer, date)
    if body is None:
        raise HTTPException(404, reason)
    return Response(content=body, media_type="application/octet-stream", headers={
        "Content-Disposition": f'inline; filename="{layer}_{d}.bin"',
        "Cache-Control": "public, max-age=86400",
        "X-Data-Date": d or "",
        "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
    })


@router.get("/mhw")
def mhw_summary(date: Optional[str] = None):
    return ae.compute_mhw_summary(date)


@router.get("/mhw/point")
def mhw_point(lat: float = LAT, lon: float = LON, date: Optional[str] = None):
    return ae.compute_mhw_point(lat, lon, date)


@router.get("/eddy-convergence")
def eddy_convergence(date: Optional[str] = None):
    return ae.compute_eddy_convergence_summary(date)


@router.get("/drift")
def drift(lat: float = LAT, lon: float = LON, mode: str = "forward",
          hours: float = Query(48.0, gt=0, le=240), step_minutes: float = Query(60.0, ge=5, le=360)):
    return ae.compute_drift(lat, lon, mode, hours, step_minutes)


@router.get("/advisories")
def advisories(date: Optional[str] = None):
    return ae.compute_advisories(date)
