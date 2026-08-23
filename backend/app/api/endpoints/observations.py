from fastapi import APIRouter
from app.services.xarray_service import xarray_service

router = APIRouter()

@router.get("/argo")
def get_argo_observations():
    datasets = xarray_service.list_available_argo_datasets()
    if not datasets:
        return {
            "status": "REAL DATASET REQUIRED",
            "message": "No real Argo profiling float NetCDF files found in datasets/argo/",
            "action": "Download real Argo profile NetCDF files from ftp://ftp.ifremer.fr/ifremer/argo",
            "features": []
        }
    return {
        "status": "available",
        "datasets": datasets,
        "features": []
    }
