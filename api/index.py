import os
import json
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="INCOIS Ocean Data API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "api")
TILES_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "tiles")

def find_json_file(filename: str):
    for d in [DATA_DIR, PUBLIC_DATA_DIR, os.path.join(BASE_DIR, "..", "frontend", "dist", "api")]:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            with open(p, "r") as f:
                return json.load(f)
    return None

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "incois-ocean-api",
        "backend": "FastAPI (Python Serverless on Vercel)",
        "data_policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
        "supported_platforms": ["argo", "glider", "moored_buoy"],
        "supported_variables": ["temperature", "salinity", "currents", "chlorophyll", "oxygen"],
        "timeline_window": ["2024-06-01", "2024-06-05"]
    }

@app.get("/api/variables")
def get_variables():
    data = find_json_file("variables.json")
    if data:
        return data
    return []

@app.get("/api/manifest/{variable}")
def get_manifest(variable: str):
    data = find_json_file(f"manifest/{variable}.json")
    if data:
        return data
    raise HTTPException(status_code=404, detail=f"Manifest for '{variable}' not found")

@app.get("/api/instruments")
def get_instruments():
    data = find_json_file("instruments.json")
    if data:
        return data
    return {"type": "FeatureCollection", "features": []}

@app.get("/api/instruments/{instrument_id}/profile")
def get_instrument_profile(instrument_id: str):
    clean_id = instrument_id.replace("INCOIS_ARGO_", "")
    for id_val in [instrument_id, clean_id]:
        data = find_json_file(f"profiles/{id_val}.json")
        if data:
            return data
    raise HTTPException(status_code=404, detail=f"Profile for '{instrument_id}' not found")

@app.get("/api/currents/uv")
def get_currents_uv():
    data = find_json_file("currents_uv.json")
    if data:
        return data
    raise HTTPException(status_code=404, detail="Currents UV vector data not found")

@app.get("/api/tiles/{variable}/{date}/{depth}")
def get_tile(variable: str, date: str, depth: str):
    depth_str = str(depth)
    candidates = [
        f"{depth_str}.bin",
        f"{float(depth_str):.1f}.bin" if depth_str.replace(".", "", 1).isdigit() else "",
        f"{int(float(depth_str))}.bin" if depth_str.replace(".", "", 1).isdigit() else "",
        "0.5.bin" if depth_str in ("0", "0.0", "0.5") else ""
    ]

    search_dirs = [
        TILES_DIR,
        os.path.join(BASE_DIR, "tiles"),
        os.path.join(BASE_DIR, "..", "tiles"),
        os.path.join(BASE_DIR, "..", "frontend", "dist", "tiles")
    ]

    for s_dir in search_dirs:
        for c in candidates:
            if not c:
                continue
            tile_path = os.path.join(s_dir, variable, date, c)
            if os.path.exists(tile_path):
                with open(tile_path, "rb") as tf:
                    tile_bytes = tf.read()
                return Response(
                    content=tile_bytes,
                    media_type="application/octet-stream",
                    headers={
                        "Content-Disposition": f'inline; filename="{variable}_{date}_{depth}.bin"',
                        "Cache-Control": "public, max-age=86400",
                        "X-Data-Source": "Authentic-NetCDF",
                        "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC"
                    }
                )

    raise HTTPException(
        status_code=404,
        detail=f"No authentic oceanographic tile available for variable '{variable}' at date '{date}', depth {depth}m."
    )
