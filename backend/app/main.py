import sys
import os
import signal
import logging

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core.metrics import get_instrumentator, update_system_info
from app.services.ocean_model import ocean_model_registry
from app.services.insitu_store import insitu_store

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="INCOIS Web-Based 3D Ocean Data Visualization System Scientific Gateway API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

# Configure Prometheus metrics
instrumentator = get_instrumentator()
instrumentator.instrument(app).expose(app, endpoint="/metrics")

def cleanup_resources():
    """Cleanup resources on shutdown."""
    logger.info("Starting graceful shutdown - cleaning up resources...")
    
    try:
        # Close all cached OceanModel instances
        for path, model in list(ocean_model_registry._cache.items()):
            try:
                model.close()
                logger.debug(f"Closed OceanModel: {path}")
            except Exception as e:
                logger.error(f"Error closing OceanModel {path}: {e}")
        ocean_model_registry._cache.clear()
        logger.info("OceanModelRegistry cache cleared")
    except Exception as e:
        logger.error(f"Error during OceanModelRegistry cleanup: {e}")
    
    try:
        # Clear InSituStore cache
        insitu_store._lru_profile_cache.clear()
        logger.info("InSituStore cache cleared")
    except Exception as e:
        logger.error(f"Error during InSituStore cleanup: {e}")
    
    logger.info("Graceful shutdown complete")

@app.on_event("startup")
async def startup_event():
    """Initialize metrics on startup."""
    update_system_info(settings.VERSION, settings.DATASETS_DIR)
    logger.info(f"Application started: {settings.PROJECT_NAME} v{settings.VERSION}")

@app.on_event("shutdown")
async def shutdown_event():
    """Handle graceful shutdown."""
    cleanup_resources()

def handle_signal(signum, frame):
    """Handle SIGTERM and SIGINT signals."""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    cleanup_resources()
    sys.exit(0)

# Register signal handlers for graceful shutdown
signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs": "/docs",
        "metrics": "/metrics",
        "policy": "STRICT NO MOCK DATA"
    }
