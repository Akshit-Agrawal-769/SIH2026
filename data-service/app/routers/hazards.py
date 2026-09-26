"""
/api/hazards/* - Disaster Early Warning layers. Thin HTTP wrappers around analytics_engine (IBR monthly
layers) and ext_hazards (OISST / HYCOM / GFS / NCEP / IBTrACS / GDP products); every response carries the
same available/reason convention and the layer's caveats.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from app import analytics_engine as ae
from app import ext_hazards as xh

router = APIRouter(prefix="/hazards", tags=["hazards"])

LAT = Query(..., ge=-90.0, le=90.0)
LON = Query(..., ge=-180.0, le=180.0)
IBR_TILE_LAYERS = ("mhw_intensity", "mhw_detrended", "chl_bloom", "eddy_convergence", "vorticity", "current_u",
                   "current_v")
RATIO_LAYER = Query("mhw_intensity", pattern="^(mhw_intensity|mhw_detrended|chl_bloom)$")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/layers")
def hazard_layers():
    """Derived-layer catalog: IBR monthly layers (catalog 'derived') and external daily / NRT layers."""
    cat = ae.get_catalog() or {}
    derived = cat.get("derived") or {}
    ext = xh.ext_catalog()
    if not derived and not any(v["available"] for v in ext.values()):
        return {"available": False, "layers": {}, "ext_layers": ext,
                "reason": "No derived hazard layers. Run `python scripts/build_authentic_dataset.py --hazards-only` "
                          "and `python scripts/build_ext_products.py all`."}
    return {"available": True, "layers": derived, "ext_layers": ext}


def _tile_response(layer: str, body: bytes, d: Optional[str]) -> Response:
    return Response(content=body, media_type="application/octet-stream", headers={
        "Content-Disposition": f'inline; filename="{layer}_{d}.bin"',
        "Cache-Control": "public, max-age=3600",
        "X-Data-Date": d or "",
        "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
    })


@router.get("/tiles/{layer}/{date}")
def hazard_tile(layer: str, date: str):
    """INCO-format tile for a derived layer (IBR monthly layers derived on demand; external layers from products)."""
    if layer in IBR_TILE_LAYERS:
        body, reason, d = ae.derived_tile_bytes(layer, date)
        if body is None:
            raise HTTPException(404, reason)
        return _tile_response(layer, body, d)
    if layer in xh.EXT_LAYERS:
        field, reason, d = xh.layer_field(layer, None if date == "latest" else date)
        if field is None:
            raise HTTPException(404, reason)
        return _tile_response(layer, ae.pack_tile(xh.VAR_CODES[layer], field), d)
    raise HTTPException(404, f"Unknown hazard layer '{layer}'. Available: "
                             f"{', '.join(IBR_TILE_LAYERS + tuple(xh.EXT_LAYERS))}")


# ---- monthly IBR ratio indices (fixed / detrended MHW, chlorophyll bloom)

@router.get("/mhw")
def mhw_summary(date: Optional[str] = None, layer: str = RATIO_LAYER):
    return ae.compute_mhw_summary(date, layer)


@router.get("/mhw/point")
def mhw_point(lat: float = LAT, lon: float = LON, date: Optional[str] = None, layer: str = RATIO_LAYER):
    return ae.compute_mhw_point(lat, lon, date, layer)


@router.get("/eddy-convergence")
def eddy_convergence(date: Optional[str] = None):
    return ae.compute_eddy_convergence_summary(date)


# ---- daily / near-real-time layers

@router.get("/mhw-daily")
def mhw_daily(date: Optional[str] = None):
    return xh.compute_mhw_daily_summary(date)


@router.get("/mhw-daily/point")
def mhw_daily_point(lat: float = LAT, lon: float = LON, date: Optional[str] = None,
                    days: int = Query(120, ge=1, le=400)):
    return xh.compute_mhw_daily_point(lat, lon, date, days)


@router.get("/dhw")
def dhw(date: Optional[str] = None):
    return xh.compute_dhw_summary(date)


@router.get("/tchp")
def tchp(date: Optional[str] = None):
    return xh.compute_tchp_summary(date)


@router.get("/gpi")
def gpi(date: Optional[str] = None):
    return xh.compute_gpi_summary(date)


@router.get("/cyclones")
def cyclones(season: Optional[int] = Query(None, ge=1980, le=2100), basin: Optional[str] = Query(None, pattern="^(NI|SI|ni|si)$"),
             sid: Optional[str] = None, min_wind_kt: Optional[float] = Query(None, ge=0, le=250),
             limit: int = Query(400, ge=1, le=1000)):
    return xh.cyclone_tracks(season, basin, sid, min_wind_kt, limit)


@router.get("/cyclones/compact")
def cyclones_compact():
    """Every track in the compact form the globe layer uses (same as the static cyclone_tracks.json)."""
    return xh.cyclone_tracks_compact()


@router.get("/validation")
def validation():
    doc, reason = xh.load_json_product("validation.json")
    return {"available": False, "reason": reason} if doc is None else {"available": True, **doc}


# ---- drift

@router.get("/drift")
def drift(lat: float = LAT, lon: float = LON, mode: str = "forward",
          hours: float = Query(48.0, gt=0, le=240),
          engine: str = Query("ensemble", pattern="^(ensemble|geostrophic)$"),
          start: Optional[str] = None,
          windage: str = Query("oil", pattern="^(none|low|oil)$"),
          diffusivity: Optional[float] = Query(None, ge=0, le=1000),
          members: int = Query(50, ge=1, le=200),
          position_sigma_km: Optional[float] = Query(None, ge=0, le=100),
          step_minutes: float = Query(30.0, ge=5, le=360)):
    """Ensemble drift through time-varying HYCOM currents + windage (default), or the previous single-line
    geostrophic run (engine=geostrophic)."""
    if engine == "geostrophic":
        return {**ae.compute_drift(lat, lon, mode, hours, max(step_minutes, 5.0)), "engine": "geostrophic"}
    return xh.compute_drift_ensemble(lat, lon, mode, hours, start, windage, diffusivity, members,
                                     position_sigma_km, "ops", step_minutes)


@router.get("/drift/window")
def drift_window():
    try:
        f = xh.DriftFields(xh.DRIFT_PRODUCTS["ops"])
    except LookupError as exc:
        return {"available": False, "reason": str(exc)}
    return {"available": True, "start": f"{f.t0:%Y-%m-%dT%H:%MZ}", "end": f"{f.t1:%Y-%m-%dT%H:%MZ}",
            "currents": getattr(f.ds, "currents_source", ""), "wind": getattr(f.ds, "wind_source", ""),
            "windage_presets": {k: {"coefficient": v[0], "note": v[1]} for k, v in xh.WINDAGE_PRESETS.items()},
            "default_diffusivity_m2s": xh.DEFAULT_DIFFUSIVITY_M2S,
            "default_position_sigma_km": xh.DEFAULT_POSITION_SIGMA_KM}


@router.get("/drift/skill")
def drift_skill(segments: bool = False):
    doc, reason = xh.load_json_product("drift_skill.json")
    if doc is None:
        return {"available": False, "reason": reason}
    return {"available": True, **({k: v for k, v in doc.items() if k != "segments"} if not segments else doc)}


# ---- advisories + standard export

def _all_advisories(date: Optional[str]):
    monthly = ae.compute_advisories(date)
    daily = xh.compute_ext_advisories(None)
    items = [{**a, "severity": {"moderate": 1, "strong": 2, "severe": 3, "extreme": 4}.get(a["level"], 1),
              "source": "INCOIS Bio-ROMS (monthly)"} for a in monthly["advisories"]] + daily["advisories"]
    unavailable = {**monthly.get("unavailable", {}), **daily.get("unavailable", {})}
    return items, unavailable, monthly


@router.get("/advisories")
def advisories(date: Optional[str] = None):
    items, unavailable, monthly = _all_advisories(date)
    return {"available": bool(items) or not unavailable, "date": monthly.get("date"), "advisories": items,
            "unavailable": unavailable, "generated": _now(),
            "exports": {"geojson": "/api/hazards/advisories.geojson", "cap": "/api/hazards/advisories.cap.xml"},
            "note": "Advisories are descriptive summaries of the layers; none is a forecast."}


@router.get("/advisories.geojson")
def advisories_geojson(date: Optional[str] = None):
    items, _, _ = _all_advisories(date)
    return Response(content=__import__("json").dumps(xh.advisories_geojson(items, _now())),
                    media_type="application/geo+json",
                    headers={"Content-Disposition": 'attachment; filename="incois_advisories.geojson"'})


@router.get("/advisories.cap.xml")
def advisories_cap(date: Optional[str] = None):
    items, _, _ = _all_advisories(date)
    return Response(content=xh.advisories_cap(items, _now()), media_type="application/cap+xml",
                    headers={"Content-Disposition": 'attachment; filename="incois_advisories.cap.xml"'})
