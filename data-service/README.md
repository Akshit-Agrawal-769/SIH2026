# INCOIS Data Service

FastAPI service that serves the authentic data catalog built by
`scripts/build_authentic_dataset.py` (INCOIS Bio-ROMS surface fields, CMEMS ARMOR3D
surface currents, QC-filtered Argo profiles).

## Endpoints (all also under the un-prefixed path)

| Method | Path | Notes |
|---|---|---|
| GET | `/health`, `/api/health` | liveness + catalog status (+ DB status if `DATABASE_URL` is set) |
| GET | `/api/catalog` | grid, variables, real timesteps/depths, source provenance |
| GET | `/api/variables`, `/api/manifest/{variable}` | from the catalog |
| GET | `/api/tiles/{variable}/{YYYY-MM-DD}/{depth}` | INCO float32 tile; 404 for anything not catalogued |
| GET | `/api/instruments`, `/api/instruments/{id}/profile` | Argo floats, latest QC 1/2 profile + observed MLD |
| GET | `/api/comparison/{id}?variable=` | Argo vs Bio-ROMS surface matchups and metrics |
| GET | `/api/analytics/{timeseries,anomalies,correlation,profile}` | point analytics (lat/lon required) |
| GET | `/api/wms` | OGC WMS 1.3.0 GetCapabilities / GetMap (EPSG:4326, CRS:84) |
| GET | `/api/export/netcdf` | CF-1.8 subset of catalogued tiles |
| POST | `/api/instruments/ingest` | loads the catalog into PostGIS; needs `X-Admin-Token` = `ADMIN_API_TOKEN` |

## Configuration

See `.env.example`. `OCEAN_DATA_ROOT` defaults to `/app/data` in the container image and to
`../frontend/public` in a checkout. PostGIS (`DATABASE_URL`) and MinIO (`ENABLE_MINIO`) are optional.

## Development

```bash
pip install -r requirements.txt pytest
uvicorn app.main:app --reload --port 8000
PYTHONPATH=. pytest tests/
```

Container image (bundles the catalog): `docker build -f data-service/Dockerfile .` from the repository root.
