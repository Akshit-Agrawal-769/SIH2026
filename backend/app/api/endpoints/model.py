from fastapi import APIRouter, HTTPException, Query, Response
from app.services.xarray_service import xarray_service

router = APIRouter()

@router.get("/datasets")
def list_model_datasets():
    datasets = xarray_service.list_available_model_datasets()
    if not datasets:
        return {
            "status": "REAL DATASET REQUIRED",
            "message": "No real ROMS model NetCDF files found in datasets/model/",
            "action": "Download real INCOIS ROMS NetCDF from https://erddap.incois.gov.in/"
        }
    return {"datasets": datasets}

@router.get("/slice")
def get_model_slice(
    filename: str = Query(..., description="Name of NetCDF file in datasets/model/"),
    variable: str = Query("temp", description="Variable name (e.g., temp, salt, u, v)"),
    time_idx: int = Query(0, description="Time index"),
    depth_idx: int = Query(0, description="Depth/s_rho level index")
):
    buffer = xarray_service.extract_2d_slice_buffer(filename, variable, time_idx, depth_idx)
    if not buffer:
        raise HTTPException(
            status_code=404, 
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' or variable '{variable}' unavailable at source."
        )
        
    return Response(content=buffer, media_type="application/octet-stream")
