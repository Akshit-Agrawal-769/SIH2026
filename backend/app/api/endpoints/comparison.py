from fastapi import APIRouter

router = APIRouter()

@router.get("/profile")
def compare_model_vs_obs(platform_number: str = "", cycle_number: int = 0):
    return {
        "status": "REAL DATASET REQUIRED",
        "message": "Model vs Observation residual calculation requires active real NetCDF model and Argo profile datasets.",
        "platform_number": platform_number,
        "cycle_number": cycle_number
    }
