from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Path
from app.services.insitu_store import insitu_store
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
