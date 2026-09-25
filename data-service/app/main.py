import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import analytics_engine as ae
from app.routers import variables, manifest, instruments, tiles, wms, export, comparison, analytics
from app.db.session import engine

app = FastAPI(
    title="INCOIS 3D Ocean Data Service",
    description="Scientific data service for INCOIS Bio-ROMS / CMEMS ARMOR3D gridded fields and Argo observations.",
    version="1.1.0"
)

# CORS: the scientific API is public and read-only, so credentials are never allowed.
cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Admin-Token"],
    expose_headers=["X-Data-Source", "X-Data-Policy"],
)

ROUTERS = (variables, manifest, instruments, tiles, wms, export, comparison, analytics)
for r in ROUTERS:
    app.include_router(r.router, prefix="/api")
# Un-prefixed aliases kept for deployments that proxy without the /api prefix.
for r in ROUTERS:
    app.include_router(r.router, include_in_schema=False)

start_time = time.time()


def _health():
    db_status = "not_configured" if engine is None else "unknown"
    if engine is not None:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                db_status = "connected"
        except Exception as e:
            db_status = f"unreachable: {str(e)[:60]}"
    data = ae.health()
    return {
        "status": "healthy" if data["catalog"] else "degraded",
        "service": "data-service",
        "database": db_status,
        "data": data,
        "uptime_seconds": round(time.time() - start_time, 2),
    }


@app.get("/health")
def health_check():
    """Liveness plus data-catalog and (optional) database status."""
    return _health()


@app.get("/api/health")
def api_health_check():
    return _health()


@app.get("/api/catalog")
def data_catalog():
    """Full data catalog: grid, variables with real timesteps/depths, and source provenance."""
    cat = ae.get_catalog()
    if not cat:
        raise HTTPException(status_code=503, detail="Data catalog missing; run scripts/build_authentic_dataset.py.")
    return cat


@app.get("/")
def root():
    return {"message": "INCOIS 3D Ocean Data Service", "docs": "/docs", "health": "/health"}
