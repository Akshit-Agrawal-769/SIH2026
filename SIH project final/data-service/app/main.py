import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import variables, manifest, instruments, tiles, wms, export
from app.db.session import engine
from sqlalchemy import text

app = FastAPI(
    title="INCOIS 3D Ocean Data Service",
    description="Backend data science service for numerical ocean model outputs and in-situ observations.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with and without /api prefix for proxy resilience
app.include_router(variables.router, prefix="/api")
app.include_router(manifest.router, prefix="/api")
app.include_router(instruments.router, prefix="/api")
app.include_router(tiles.router, prefix="/api")
app.include_router(wms.router, prefix="/api")
app.include_router(export.router, prefix="/api")

app.include_router(variables.router)
app.include_router(manifest.router)
app.include_router(instruments.router)
app.include_router(tiles.router)
app.include_router(wms.router)
app.include_router(export.router)

start_time = time.time()

@app.get("/health")
def health_check():
    """System health check verifying database and service availability."""
    db_status = "unknown"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as e:
        db_status = f"unreachable: {str(e)[:50]}"

    return {
        "status": "healthy",
        "service": "data-service",
        "database": db_status,
        "uptime_seconds": round(time.time() - start_time, 2)
    }

@app.get("/")
def root():
    return {
        "message": "INCOIS 3D Ocean Data Service",
        "docs": "/docs",
        "health": "/health"
    }
