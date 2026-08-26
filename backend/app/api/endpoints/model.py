import os
from fastapi import APIRouter, HTTPException, Query, Response
from app.services.ocean_model import ocean_model_registry
from app.schemas.ocean import DatasetMetadataResponse

router = APIRouter()

@router.get("/datasets")
def list_model_datasets():
    datasets = ocean_model_registry.list_available_models()
    if not datasets:
        return {
            "status": "REAL DATASET REQUIRED",
            "message": "No real ROMS model NetCDF files found in datasets/model/",
            "action": "Download real INCOIS ROMS NetCDF from https://erddap.incois.gov.in/"
        }
    return {"datasets": datasets}

@router.get("/metadata", response_model=DatasetMetadataResponse)
def get_model_metadata(filename: str = Query(..., pattern="^[a-zA-Z0-9_.-]+$", description="Name of NetCDF file in datasets/model/")):

    model = ocean_model_registry.get_model(filename)
    if not model:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' not found or invalid format."
        )
    return model.get_metadata()

@router.get("/volume3d")
def get_model_volume_3d(
    filename: str = Query(..., pattern="^[a-zA-Z0-9_.-]+$", description="Name of NetCDF file in datasets/model/"),
    variable: str = Query("temp", description="Variable name (temp, salt, u, v, chl)"),
    time_idx: int = Query(0, ge=0, description="Time step index"),
    dim_x: int = Query(64, ge=16, le=256, description="Resolution X cap"),
    dim_y: int = Query(64, ge=16, le=256, description="Resolution Y cap"),
    dim_z: int = Query(32, ge=8, le=128, description="Resolution Z cap")
):

    model = ocean_model_registry.get_model(filename)
    if not model:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' not found or invalid format."
        )

    result = model.extract_volume_buffer(variable, time_idx, (dim_x, dim_y, dim_z))
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Failed to extract 3D volume for '{filename}' and variable '{variable}'"
        )
        
    buffer, meta = result
    
    headers = {
        "X-Data-Min": str(meta["min_val"]),
        "X-Data-Max": str(meta["max_val"]),
        "X-Dim-X": str(meta["dim_x"]),
        "X-Dim-Y": str(meta["dim_y"]),
        "X-Dim-Z": str(meta["dim_z"]),
        "X-Min-Lon": str(meta["min_lon"]),
        "X-Max-Lon": str(meta["max_lon"]),
        "X-Min-Lat": str(meta["min_lat"]),
        "X-Max-Lat": str(meta["max_lat"]),
        "X-Min-Depth": str(meta["min_depth"]),
        "X-Max-Depth": str(meta["max_depth"]),
        "X-Variable": meta["variable"],
        "X-Units": meta["units"],
        "X-Has-Nan": str(meta["has_nan"]),
        "X-Nan-Value": str(meta["nan_value"]),
    }
    
    return Response(content=buffer, media_type="application/octet-stream", headers=headers)

@router.get("/slice2d")
def get_model_slice_2d(
    filename: str = Query(..., pattern="^[a-zA-Z0-9_.-]+$", description="Name of NetCDF file in datasets/model/"),
    variable: str = Query("temp", description="Variable name"),
    time_idx: int = Query(0, ge=0, description="Time index"),
    depth_idx: int = Query(0, ge=0, description="Depth level index")
):

    model = ocean_model_registry.get_model(filename)
    if not model:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' not found or invalid format."
        )

    result = model.extract_slice_buffer(variable, time_idx, depth_idx)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"REAL DATASET REQUIRED: Dataset '{filename}' or variable '{variable}' unavailable."
        )
    buffer, meta = result
    headers = {
        "X-Data-Min": str(meta["min_val"]),
        "X-Data-Max": str(meta["max_val"]),
        "X-Variable": meta["variable"],
    }
    return Response(content=buffer, media_type="application/octet-stream", headers=headers)
