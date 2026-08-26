from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.validation_engine import validation_engine
from app.schemas.ocean import ModelVsObsComparisonResponse

router = APIRouter()

@router.get("/profile", response_model=ModelVsObsComparisonResponse)
def compare_model_vs_obs(
    platform_number: str = Query(..., pattern="^[a-zA-Z0-9_.-]+$", description="Argo float WMO platform number"),
    cycle_number: Optional[int] = Query(None, ge=0, description="Cycle number"),
    variable: str = Query("temp", description="Ocean variable to compare (temp, salt)"),
    model_filename: Optional[str] = Query(None, pattern="^[a-zA-Z0-9_.-]+$", description="Model dataset filename")
):
    if variable not in ["temp", "salt"]:
        raise HTTPException(status_code=400, detail=f"Invalid comparison variable '{variable}'. Supported: 'temp', 'salt'.")

    comparison = validation_engine.validate_float(
        platform_number=platform_number,
        cycle_number=cycle_number,
        variable=variable,
        model_name=model_filename
    )
    if not comparison:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Unable to compute 4D comparison for float {platform_number}."
        )
    return comparison
