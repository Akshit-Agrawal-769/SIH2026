from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from app.services.xarray_service import xarray_service
from app.schemas.ocean import DatasetMetadataResponse

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

@router.get("/metadata", response_model=DatasetMetadataResponse)
def get_model_metadata(filename: str = Query(..., description="Name of NetCDF file in datasets/model/")):
    meta = xarray_service.get_metadata(filename)
    if not meta:
        raise HTTPException(
            status_code=404, 
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' unavailable at source."
        )
    return meta

@router.get("/slice2d")
def get_model_slice_2d(
    filename: str = Query(..., description="Name of NetCDF file in datasets/model/"),
    variable: str = Query("temp", description="Variable name (e.g., temp, salt, u, v, chl)"),
    time_idx: int = Query(0, description="Time index"),
    depth_idx: int = Query(0, description="Depth level index")
):
    result = xarray_service.extract_2d_slice_buffer(filename, variable, time_idx, depth_idx)
    if not result:
        raise HTTPException(
            status_code=404, 
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' or variable '{variable}' unavailable at source."
        )
    buffer, meta = result
    headers = {
        "X-Data-Min": str(meta["min_val"]),
        "X-Data-Max": str(meta["max_val"]),
        "X-Units": str(meta["units"])
    }
    return Response(content=buffer, media_type="application/octet-stream", headers=headers)

@router.get("/volume3d")
def get_model_volume_3d(
    filename: str = Query(..., description="Name of NetCDF file in datasets/model/"),
    variable: str = Query("temp", description="Variable name (e.g., temp, salt, u, v, chl)"),
    time_idx: int = Query(0, description="Time index"),
    dim_x: int = Query(64, description="Target volume dimension X"),
    dim_y: int = Query(64, description="Target volume dimension Y"),
    dim_z: int = Query(32, description="Target volume dimension Z")
):
    result = xarray_service.extract_3d_volume_buffer(filename, variable, time_idx, (dim_x, dim_y, dim_z))
    if not result:
        raise HTTPException(
            status_code=404, 
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' or variable '{variable}' unavailable at source."
        )
    buffer, meta = result
    headers = {
        "X-Data-Min": str(meta["min_val"]),
        "X-Data-Max": str(meta["max_val"]),
        "X-Dim-X": str(meta["dim_x"]),
        "X-Dim-Y": str(meta["dim_y"]),
        "X-Dim-Z": str(meta["dim_z"]),
        "X-Units": str(meta["units"])
    }
    return Response(content=buffer, media_type="application/octet-stream", headers=headers)
