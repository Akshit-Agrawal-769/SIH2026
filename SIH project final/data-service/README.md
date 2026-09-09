# INCOIS Data Service

Python 3.11 + FastAPI backend data service for numerical ocean model outputs (NetCDF via xarray) and in-situ observation streams (Argo floats via `argopy`, gliders via `erddapy`).

## Features
- Geospatial querying of observation platforms (PostGIS)
- Voxel grid interpolation and binary packed texture generation for 3D GPU ray-marching
- Celery worker for scheduled ingestion jobs
- REST endpoints:
  - `GET /health`
  - `GET /api/variables`
  - `GET /api/manifest/{variable}`
  - `GET /api/instruments`
  - `GET /api/instruments/{id}/profile`
  - `GET /api/tiles/{variable}/{date}/{depth}`

## Development

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
