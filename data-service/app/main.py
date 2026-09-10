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
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with and without /api prefix for proxy resilience
for r in [variables.router, manifest.router, instruments.router, tiles.router, wms.router, export.router]:
    app.include_router(r, prefix="/api")
    app.include_router(r)

start_time = time.time()

@app.get("/health")
@app.get("/api/health")
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
