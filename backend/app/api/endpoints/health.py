from fastapi import APIRouter
from app.schemas.ocean import DatasetHealthStatus
from app.services.xarray_service import xarray_service
from app.services.argo_service import argo_service

router = APIRouter()

@router.get("", response_model=DatasetHealthStatus)
def check_health():
    model_datasets = xarray_service.list_available_model_datasets()
    argo_datasets = argo_service.list_argo_files()
    
    available = model_datasets + argo_datasets
    missing = []
    
    if not model_datasets:
        missing.append("INCOIS_ROMS_MODEL_NETCDF (datasets/model/*.nc)")
    if not argo_datasets:
        missing.append("ARGO_FLOAT_PROFILES_NETCDF (datasets/argo/*.nc)")
        
    status = "healthy" if (model_datasets and argo_datasets) else "REAL DATASET REQUIRED"
    
    return DatasetHealthStatus(
        status=status,
        available_datasets=available,
        missing_datasets=missing,
        data_policy="STRICT NO MOCK DATA"
    )
