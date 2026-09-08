from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Path, UploadFile, File
from app.services.insitu_store import insitu_store
from app.services.delimited_parser import delimited_parser
from app.services.sensors import sensor_registry
from app.schemas.ocean import ArgoFloatSummary, ArgoProfileResponse, ArgoMetadataResponse, ArgoSourceInfo

router = APIRouter()


@router.get("/sources", response_model=List[ArgoSourceInfo])
def get_observation_sources():
    """Returns available authentic observation data providers (Coriolis, INCOIS, etc.)."""
    return insitu_store.get_sources()


@router.get("/metadata", response_model=ArgoMetadataResponse)
def get_argo_metadata():
    """Returns aggregate provenance, platform statistics, and QC policy for in-situ observations."""
    return insitu_store.get_metadata()


@router.get("/argo", response_model=List[ArgoFloatSummary])
def list_argo_floats(
    source: Optional[str] = Query(None, description="Filter by data provider: 'all', 'coriolis', 'incois'"),
    min_lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Minimum latitude bounding box"),
    max_lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Maximum latitude bounding box"),
    min_lon: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Minimum longitude bounding box"),
    max_lon: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Maximum longitude bounding box"),
    start_time: Optional[str] = Query(None, description="Start timestamp (ISO 8601 UTC)"),
    end_time: Optional[str] = Query(None, description="End timestamp (ISO 8601 UTC)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000)
):
    """
    Returns lightweight Argo platform summaries matching spatial, temporal, and provider filters.
    Does NOT load heavy vertical profile arrays.
    """
    floats = insitu_store.get_float_summaries(
        source=source,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        skip=skip
    )
    return floats


@router.get("/argo/{platform_number}/profile", response_model=ArgoProfileResponse)
def get_argo_profile(
    platform_number: str = Path(..., pattern="^[a-zA-Z0-9_.-]+$"),
    cycle_number: Optional[int] = Query(None, ge=0, description="Cycle number (defaults to latest)"),
    filter_qc: bool = Query(True, description="Strict QC filter: retain only QC 1 & 2 levels")
):
    """
    Retrieves full calibrated physical vertical profile (TEOS-10 depth, temp, sal, QC) for a platform cycle.
    """
    profile = insitu_store.get_profile(platform_number, cycle_number, filter_qc=filter_qc)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Argo profile for float {platform_number} (cycle={cycle_number}) not found."
        )
    return profile


@router.post("/upload-delimited", summary="Upload and parse delimited text (CSV / TSV / ASCII) profile")
async def upload_delimited_data(file: UploadFile = File(...)):
    """
    Ingests and parses delimited text file containing in-situ vertical profile data.
    Auto-detects delimiters (comma, tab, semicolon) and column aliases.
    """
    try:
        content_bytes = await file.read()
        text_content = content_bytes.decode('utf-8', errors='replace')
        record = delimited_parser.parse_content(text_content, filename=file.filename or "upload.csv")
        return {
            "status": "success",
            "message": f"Successfully parsed {record['levels_count']} depth levels for platform '{record['platform_id']}'.",
            "data": record
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse delimited oceanographic data: {str(e)}")


@router.get("/delimited", summary="List ingested delimited in-situ profiles")
def list_delimited_profiles():
    """
    Returns list of all uploaded and parsed delimited text profiles.
    """
    return delimited_parser.get_all_profiles()


@router.get("/delimited/{platform_id}", summary="Get specific delimited in-situ profile by ID")
def get_delimited_profile(platform_id: str):
    """
    Returns vertical depth-vs-variable data for a parsed delimited profile.
    """
    profile = delimited_parser.get_profile_by_id(platform_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Delimited profile '{platform_id}' not found.")
    return profile


@router.get("/plugins", summary="List registered ocean sensor platform plugins")
def list_sensor_plugins():
    """
    Returns all registered sensor platform adapters (e.g., Argo, Gliders, Moorings, HF-Radar).
    """
    return {
        "count": len(sensor_registry.list_sensors()),
        "plugins": sensor_registry.list_sensors()
    }


@router.get("/plugins/{sensor_type}/platforms", summary="List platforms for a sensor plugin")
def get_sensor_plugin_platforms(sensor_type: str):
    """
    Returns active platforms managed by the specified sensor adapter.
    """
    adapter = sensor_registry.get(sensor_type)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Sensor plugin adapter for '{sensor_type}' not found.")
    return adapter.get_platforms()


@router.get("/plugins/{sensor_type}/{platform_id}/profile", summary="Get profile from a sensor plugin")
def get_sensor_plugin_profile(sensor_type: str, platform_id: str, cycle_number: Optional[int] = Query(None)):
    """
    Retrieves vertical physical profile from the specified sensor plugin adapter.
    """
    adapter = sensor_registry.get(sensor_type)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Sensor plugin adapter for '{sensor_type}' not found.")
    profile = adapter.get_profile(platform_id, cycle_number=cycle_number)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile for '{platform_id}' on sensor '{sensor_type}' not found.")
    return profile
