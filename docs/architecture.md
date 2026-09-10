# System Architecture: INCOIS 3D Ocean Data Visualization Platform

This document describes the high-level architecture, module interactions, data pipeline, and scientific standards of the INCOIS 3D Ocean Data Visualization Platform.

---

## 1. High-Level Data Flow

```text
[ AUTHENTIC SCIENTIFIC DATA SOURCES ]
  - CMEMS Global Ocean Physics Reanalysis (cmems.nc)
  - INCOIS Bio-ROMS Biogeochemical Model (INCOIS-BIO-ROMS.nc)
  - INCOIS Argo Profiling Float NetCDFs (datasets/argo/*.nc)
  - Global Coriolis Trajectory Archives (datasets/coriolis/*.nc)
                        │
                        ▼
       [ AUTHORITATIVE C++ OCEAN_CORE PIPELINE ]
         - netCDF C++ Loader & Coordinate Projection
         - Strict UNESCO QC Filtering (Flags '1' & '2' only)
         - TEOS-10 Coordinate & Pressure-Depth Conversions
         - Land/NaN Masking & Dynamic Range Calibration
         - export_real_tiles Tool
                        │
                        ▼ produces 32-byte 'INCO' + Float32 binary tiles
               [ AUTHORITATIVE TILE REPOSITORY ]
               tiles/{variable}/{YYYY-MM-DD}/{depth}.bin
                        │
                        ▼
       [ SCIENTIFIC DATA SERVICE (FastAPI Microservice) ]
         - pack_texture.py (Sub-millisecond local tile reader)
         - routers/tiles.py (Serves Float32 tiles / Strict 404 on missing data)
         - routers/instruments.py (Parses authentic Argo NetCDF CTD profiles)
         - routers/wms.py (OGC WMS 1.3.0 GetMap/GetCapabilities engine)
         - routers/export.py (CF-1.8 NetCDF-4 volumetric exporter)
                        │
                        ▼ HTTP / Binary Octet-Stream / GeoJSON
            [ API GATEWAY (Node.js / Express Proxy) ]
         - Port 4000: CORS handling, Rate Limiting, Proxy to 8000
                        │
                        ▼
         [ CLIENT FRONTEND (React 18 + WebGL / WebGPU) ]
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
[ CESIUMJS 3D VIRTUAL GLOBE ]                     [ THREE.JS 3D VOLUME STUDIO ]
- Macro-scale geospatial navigation               - Micro-scale 3D water column studio
- 60 FPS GPU vector streamlines                   - Animated laser depth scan plane
- DepthSliceLayer draped on terrain               - Authentic in-situ CTD profiles
- Dynamic colorbar & MLD overlays                 - Zero synthetic fallback
```

---

## 2. Core Components

### 2.1. C++ Ocean Engine (`cpp_visualizer/ocean_core`)
The authoritative computational core implemented in modern C++ (C++17/20). It provides:
- **NetCDF I/O Layer:** High-throughput parallel reader for multi-gigabyte NetCDF-3/4 files via the official NetCDF C/C++ libraries.
- **Scientific QC Filter:** Enforces the international UNESCO Argo quality-control standard, accepting only observations with QC flag `'1'` (Good) or `'2'` (Probably Good), while discarding uncalibrated or interpolated values.
- **TEOS-10 Thermodynamics:** Calculates absolute salinity, conservative temperature, sound speed, and density using the international Thermodynamic Equation of Seawater 2010.
- **Real Tile Exporter (`export_real_tiles`):** Projects gridded models onto the Indian Ocean bounds (`[35°E, 100°E], [-10°N, 25°N]`) and packs values into the lightweight `INCO` binary format.

### 2.2. Scientific Data Service (`data-service/`)
A high-performance asynchronous Python backend built with **FastAPI**, **xarray**, and **SQLAlchemy**:
- **Binary Tile Router (`app/routers/tiles.py`):** Serves packed Float32 ocean slices directly to web clients. If an authentic tile does not exist for a requested time or depth, it responds with an explicit **HTTP 404**—never substituting fake data.
- **In-Situ Ingestion Adapters (`app/ingestion/`):** Plug-and-play architecture for reading profiling floats, gliders, and moored buoys directly from raw NetCDF files or relational databases.
- **Interoperability Endpoints:**
  - `OGC WMS 1.3.0`: Generates dynamically styled PNG map layers for external GIS tools.
  - `CF-1.8 NetCDF Export`: Generates standards-compliant NetCDF files for climate researchers.

### 2.3. Node.js API Gateway (`gateway/`)
An enterprise-grade reverse proxy built with Express and TypeScript:
- Consolidates frontend API requests under a single origin (`/api/*`).
- Handles CORS, rate limiting, and request logging.
- Routes tile and sensor queries to the data-service while buffering large stream responses.

### 2.4. React 18 3D Frontend (`frontend/`)
A dual-engine scientific visualization interface:
- **CesiumJS Global Geospatial Context:**
  - Full-globe orbital navigation with realistic bathymetric terrain, day-night terminators, and geographic boundaries.
  - Custom canvas imagery provider dynamically rendering Float32 tiles using scientific colormaps (NOAA SST, Turbo, Viridis, GFDL Chlorophyll).
  - WebGL particle system animating horizontal ocean current vectors at 60 FPS.
- **Three.js Volumetric Water Column Block Studio:**
  - Triggered by clicking any ocean location or observation platform.
  - Renders a 3D ocean block spanning from the sea surface (0m) to the abyssal seafloor (-2000m).
  - Displays real in-situ CTD observation curves (temperature, salinity, pressure) queried live from authentic source files.

---

## 3. Data Formats & Protocols

### 3.1. INCO Binary Tile Specification
To achieve instantaneous depth scrubbing without network serialization bottlenecks, the engine uses a 32-byte packed header followed by raw Float32 numbers:

```text
Offset (Bytes)  Type     Field         Description
0 - 3           char[4]  magic         Magic identifier: 'INCO'
4 - 5           uint16   version       Format version (1)
6 - 7           uint16   var_code      1=Temp, 2=Salinity, 3=Currents, 4=Chlorophyll
8 - 9           uint16   width         Grid column count (e.g., 520)
10 - 11         uint16   height        Grid row count (e.g., 280)
12 - 13         uint16   depth_count   Vertical slice count (1 for 2D, N for 3D)
14 - 15         uint16   data_type     1 = Float32
16 - 19         float32  min_val       Minimum authentic non-NaN value
20 - 23         float32  max_val       Maximum authentic non-NaN value
24 - 31         uint8[8] reserved      Padding / future metadata
32 - End        float32* payload       Raw little-endian Float32 array (width * height)
```

### 3.2. Coordinate Reference System (CRS)
- **Horizontal:** EPSG:4326 (WGS 84 geographic latitude/longitude).
- **Vertical:** Physical depth in positive downward meters ($0.0\text{m}$ to $2000.0\text{m}$) computed via hydrostatic pressure relation ($z \approx 0.993 \times p$).
- **Bounding Box:** $35.0^\circ\text{E} \le \lambda \le 100.0^\circ\text{E}$ and $-10.0^\circ\text{N} \le \phi \le 25.0^\circ\text{N}$.

---

## 4. Scientific Integrity & Zero-Mock Guarantee

1. **No Synthetic Fallbacks:** Mathematical formulas (such as sinusoids, polynomial approximations, or hardcoded station arrays) are strictly prohibited in production code paths.
2. **Missing Data Policy:** If a requested variable, timestep, or depth level does not exist in the authentic NetCDF dataset, the service responds with an explicit **HTTP 404** status code, and the frontend informs the user that no observation is available.
3. **Traceability:** Every visualized value can be traced back to its raw NetCDF file and exact array index.
