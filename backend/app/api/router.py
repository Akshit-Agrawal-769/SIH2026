from fastapi import APIRouter
from app.api.endpoints import health, model, observations, comparison

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(model.router, prefix="/model", tags=["model"])
api_router.include_router(observations.router, prefix="/observations", tags=["observations"])
api_router.include_router(comparison.router, prefix="/comparison", tags=["comparison"])
