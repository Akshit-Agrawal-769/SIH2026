from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.comparison_service import comparison_service
from app.schemas.ocean import ModelVsObsComparisonResponse

router = APIRouter()

@router.get("/profile", response_model=ModelVsObsComparisonResponse)
def compare_model_vs_obs(
    platform_number: str = Query(..., description="Argo float WMO platform number"),
    cycle_number: Optional[int] = Query(None, description="Cycle number"),
    variable: str = Query("temp", description="Variable (temp, salt)"),
    model_filename: Optional[str] = Query(None, description="Model filename")
):
    result = comparison_service.compare_float_profile(platform_number, cycle_number, variable, model_filename)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Unable to perform model-vs-observation comparison for float {platform_number}."
        )
    return result
