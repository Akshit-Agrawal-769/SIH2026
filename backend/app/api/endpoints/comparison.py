from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.comparison_service import comparison_service
from app.schemas.ocean import ModelVsObsComparisonResponse

router = APIRouter()

@router.get("/profile", response_model=ModelVsObsComparisonResponse)
def compare_model_vs_obs(
    platform_number: str = Query(..., description="Argo float WMO platform number"),
    cycle_number: Optional[int] = Query(None, description="Cycle number"),
    variable: str = Query("temp", description="Ocean variable to compare (temp, salt)"),
    model_filename: Optional[str] = Query(None, description="Model dataset filename")
):
    comparison = comparison_service.compare_float_profile(
        platform_number=platform_number,
        cycle_number=cycle_number,
        variable=variable,
        model_filename=model_filename
    )
    if not comparison:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Unable to compute comparison for float {platform_number}."
        )
    return comparison
