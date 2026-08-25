from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.insitu_store import insitu_store
from app.schemas.ocean import ArgoFloatSummary, ArgoProfileResponse

router = APIRouter()

@router.get("/argo", response_model=List[ArgoFloatSummary])
def list_argo_floats():
    floats = insitu_store.get_float_summaries()
    return floats

@router.get("/argo/{platform_number}/profile", response_model=ArgoProfileResponse)
def get_argo_profile(platform_number: str, cycle_number: Optional[int] = Query(None)):
    profile = insitu_store.get_profile(platform_number, cycle_number)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Argo profile for float {platform_number} (cycle={cycle_number}) not found."
        )
    return profile
