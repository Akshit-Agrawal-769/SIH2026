# System Architecture: INCOIS 3D Ocean Data Visualization Platform

## 1. System Overview

The INCOIS 3D Ocean Data Visualization Platform is an enterprise-grade, browser-native digital twin of the ocean water column over the Indian Ocean and Exclusive Economic Zone (EEZ). It co-visualizes 4D numerical ocean model fields (temperature, salinity, currents, chlorophyll) and real-time/delayed in-situ observation platforms (Argo floats, gliders, CTDs, BGC sensors).

```
                                   ┌─────────────────────────────┐
                                   │        BROWSER CLIENT        │
                                   │  React 18 + Vite + TS       │
                                   │  CesiumJS (Resium)          │
                                   │  Zustand + TailwindCSS      │
                                   │  Three.js Ray-marching      │
                                   └───────────────┬─────────────┘
                                                   │ REST + WebSocket
                                                   ▼
                                   ┌─────────────────────────────┐
                                   │      NODE.JS API GATEWAY     │
                                   │  Express + TypeScript        │
                                   │  Auth (JWT), rate-limiting  │
                                   │  Reverse proxy, WS broadcast │
                                   └───────┬───────────────┬─────┘
                                           │               │
                     ┌─────────────────────┘               └─────────────────────┐
                     ▼                                                           ▼
     ┌───────────────────────────────┐                       ┌───────────────────────────────┐
     │   PYTHON DATA SERVICE (FastAPI)│                       │      PostgreSQL 15 + PostGIS  │
     │  xarray / netCDF4 / argopy     │◄─────reads/writes────►│  + TimescaleDB extension      │
     │  - Voxel grid resampling       │                       │  (instruments, profiles,      │
     │  - Binary texture packing      │                       │   depth measurements)         │
     │  - Argo & Glider ingestion     │                       └───────────────────────────────┘
     └───────────────┬────────────────┘
                     │ read/write raw + processed data
                     ▼
     ┌───────────────────────────────┐        ┌───────────────────────────────┐
     │     MinIO (S3-compatible)     │        │   Redis 7 (Cache + Broker)    │
     │  raw NetCDF, precomputed      │        │  Celery task queue, tile      │
     │  packed voxel textures        │        │  cache, pub/sub               │
     └───────────────────────────────┘        └───────────────────────────────┘
                     ▲
                     │ scheduled ingestion (Celery beat)
     ┌───────────────────────────────┐
     │   Ingestion Workers (Celery)   │
     │  Argo (argopy) · Glider        │
     │  Copernicus Marine / INCOIS    │
     └───────────────────────────────┘
```

---

## 2. Service Roles & Ports

| Service | Technology | Port | Responsibilities |
|---|---|---|---|
| `frontend` | React 18, Vite, CesiumJS, Resium, TailwindCSS | `3000` | Interactive 3D globe, volume ray-marching primitive, UI controls, profile charts |
| `gateway` | Node.js, Express, TypeScript | `4000` | API gateway, auth, rate limiting, request routing, WebSocket notifications |
| `data-service` | Python 3.11, FastAPI, Uvicorn, Celery | `8000` | NetCDF parsing, voxelization, binary texture generation, in-situ data ingestion |
| `postgres` | PostgreSQL 15 + PostGIS 3.3 | `5432` | Geospatial storage of platform positions (`geography(Point)`), profiles, timeseries |
| `minio` | MinIO S3-compatible object storage | `9000` (API), `9001` (Console) | Precomputed binary voxel textures and raw model NetCDF storage |
| `redis` | Redis 7 | `6379` | Celery message broker and response caching |

---

## 3. Packed Texture & Voxel Grid Specification

To enable GPU-native volume ray-marching in CesiumJS without sending heavy raw NetCDF files to the browser:

### 3.1 Voxel Grid Coordinates
- **Bounding Box (India EEZ / North Indian Ocean)**:
  - Longitude: `45.0°E` to `100.0°E`
  - Latitude: `-15.0°S` to `30.0°N`
- **Spatial Resolution**:
  - Horizontal: `0.25°` (220 lon steps × 180 lat steps)
  - Depth levels: 20-50 standard oceanographic depth levels (surface down to 2000m+)

### 3.2 Binary Packed Layout (32-byte Header + Float32Array)
- **Storage Path**: `minio://ocean-data/tiles/{variable}/{YYYY-MM-DD}/{depth}.bin`
- **Header Structure (32 bytes Little-Endian)**:
  - `[Bytes 0..3]   magic`: 4-byte ASCII identifier (`"INCO"`)
  - `[Bytes 4..5]   version`: uint16 format version (`1`)
  - `[Bytes 6..7]   var_code`: uint16 (`1` = Temp, `2` = Salinity, `3` = Currents, `4` = Chlorophyll)
  - `[Bytes 8..9]   grid_width`: uint16 longitude grid cells (`220`)
  - `[Bytes 10..11] grid_height`: uint16 latitude grid cells (`180`)
  - `[Bytes 12..13] grid_depth`: uint16 depth slices (`1` for single slice, `20` for 3D volume)
  - `[Bytes 14..15] data_type`: uint16 (`1` = Float32Array, `2` = Uint8 normalized)
  - `[Bytes 16..19] min_val`: float32 physical minimum value in slice
  - `[Bytes 20..23] max_val`: float32 physical maximum value in slice
  - `[Bytes 24..31] reserved`: 8 zero bytes for future metadata/flags
- **Payload (Byte 32 to End)**:
  - Continuous little-endian `Float32Array` containing `grid_width × grid_height` data points.
  - Read via JavaScript: `new Float32Array(buffer, 32, width * height)`.
  - In WebGL: uploaded directly as a single-channel texture (`gl.R32F` / `gl.LUMINANCE` or packed RGBA canvas) for 60fps sampling on the Cesium globe.

---

## 4. Coordinate Reference Systems (CRS)

- **Geographic Data**: WGS84 (`EPSG:4326`) for lat/lon coordinates.
- **Database Storage**: PostGIS `geography(Point, 4326)` for true ellipsoidal distance queries and indexing.
- **3D Globe Display**: Cesium ECEF (Earth-Centered, Earth-Fixed Cartesian 3D coordinates).
- **Vertical Exaggeration**: A uniform multiplier (e.g. 50x - 500x) applied to depth coordinates in WebGL shaders to make thin ocean layers visible relative to Earth's radius (6,371 km).

---

## 5. Extensibility Architecture

1. **Backend (`IngestionAdapter`)**:
   - Abstract Base Class in `data_service/app/ingestion/base.py`.
   - New sensors (e.g., ADCP, mooring buoys, HF radar) subclass `IngestionAdapter`, implement `fetch()` and `normalize()`, and register in `ADAPTER_REGISTRY`.
2. **Frontend (`LayerDefinition`)**:
   - TypeScript interface in `frontend/src/layers/registry.ts`.
   - Adding a new variable or sensor is done by adding one file in `frontend/src/layers/` and exporting it in the registry. The UI automatically generates controls and toggles.
