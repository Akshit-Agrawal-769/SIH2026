# INCOIS 3D Ocean Data Visualization Platform

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![CesiumJS](https://img.shields.io/badge/CesiumJS-3D%20Globe-blue)](https://cesium.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Data%20Service-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React%2018-TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![CF-1.8](https://img.shields.io/badge/CF--1.8-NetCDF4-success)](docs/DATA_STANDARDS.md)
[![OGC WMS](https://img.shields.io/badge/OGC-WMS%201.3.0-orange)](docs/DATA_STANDARDS.md)

A web-based, browser-native 3D Ocean Data Visualization Platform ("Digital Twin of the Water Column") integrating numerical ocean model outputs and in-situ observations (Argo profiling floats, autonomous underwater gliders, moored OMNI buoys) across the Indian Ocean and Exclusive Economic Zone (EEZ).

Developed for the **Ministry of Earth Sciences (MoES) — Indian National Centre for Ocean Information Services (INCOIS)**.

---

## System Architecture

```
                               ┌─────────────────────────────────┐
                               │     BROWSER CLIENT (React 18)   │
                               │  - CesiumJS 3D Virtual Globe    │
                               │  - 60 FPS Flow Streamlines      │
                               │  - Volumetric Ray-Marching      │
                               │  - Interactive Recharts CTD HUD │
                               └────────────────┬────────────────┘
                                                │ REST / WebSockets
                                                ▼
                               ┌─────────────────────────────────┐
                               │       API GATEWAY (Node.js)     │
                               │  Port: 4000                     │
                               │  - Express + TypeScript         │
                               │  - Rate limiting & Proxy        │
                               └────────┬───────────────┬────────┘
                                        │               │
                  ┌─────────────────────┘               └─────────────────────┐
                  ▼                                                           ▼
┌─────────────────────────────────┐                       ┌─────────────────────────────────┐
│   DATA SERVICE (Python 3.11)    │                       │     POSTGRES 15 + POSTGIS       │
│  Port: 8000                     │◄─────reads/writes────►│  Port: 5432                     │
│  - FastAPI + xarray + netCDF4   │                       │  - Spatial Platform Locations   │
│  - OGC WMS 1.3.0 Raster Engine  │                       │  - Vertical Depth Profiles      │
│  - CF-1.8 NetCDF Exporter       │                       └─────────────────────────────────┘
│  - IngestionAdapter Plugins     │
└───────────────┬─────────────────┘
                │ read/write binary packed tiles
                ▼
┌─────────────────────────────────┐                       ┌─────────────────────────────────┐
│     MINIO OBJECT STORAGE        │                       │             REDIS 7             │
│  Port: 9000 (API), 9001 (Web)   │                       │  Port: 6379                     │
│  - 1,120 Packed Float32 Tiles   │                       │  - Ingestion Queue & Cache      │
└─────────────────────────────────┘                       └─────────────────────────────────┘
```

---

## Option 1: Quick Start with Docker (Recommended)

Requires only [Docker](https://docs.docker.com/get-docker/) & Docker Compose. Zero API keys required (no Cesium Ion tokens or external dependencies).

### 1-Command Startup:
```bash
./run.sh
```

### Or Step-by-Step:
```bash
# 1. Clone & create environment file
cp .env.example .env

# 2. Build and launch all 6 services
docker compose up --build -d

# 3. Seed real observation stations and 1,120 binary 4D ocean tiles
docker exec -it incois_data_service python3 seed_data.py
```

### Access Ports & Services:
| Interface | URL | Credentials / Notes |
|---|---|---|
| **3D Globe Application** | [http://localhost:3000](http://localhost:3000) (or `:3001`) | Interactive 3D Cesium visualization |
| **API Gateway** | [http://localhost:4000](http://localhost:4000) | Express reverse proxy & WebSocket hub |
| **Backend REST & Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger UI |
| **OGC WMS 1.3.0 Endpoint**| [http://localhost:4000/api/wms](http://localhost:4000/api/wms?SERVICE=WMS&REQUEST=GetCapabilities) | Ready for QGIS / ArcGIS import |
| **NetCDF-4 Export** | [http://localhost:4000/api/export/netcdf](http://localhost:4000/api/export/netcdf?variable=temperature) | CF-1.8 Compliant volumetric binary |
| **MinIO S3 Console** | [http://localhost:9001](http://localhost:9001) | User: `minioadmin` · Pass: `minioadmin` |

---

## Option 2: Local Development (Without Docker Containers)

### Prerequisites
- Node.js 18+ or 20+
- Python 3.11+
- PostgreSQL with PostGIS extension, Redis, and MinIO running locally (or run them via `docker compose up -d postgres redis minio minio-init`)

### Terminal 1: Python Data Service
```bash
cd data-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 seed_data.py
uvicorn app.main:app --reload --port 8000
```

### Terminal 2: API Gateway
```bash
cd gateway
npm install
npm run dev
```

### Terminal 3: React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Health & Verification Commands

Verify that all services are communicating properly:

```bash
# 1. Gateway Health Check
curl -s http://localhost:4000/health

# 2. Data Service Health Check
curl -s http://localhost:8000/health

# 3. List Ingested Observation Platforms (15 stations: Argo, Gliders, Moored Buoys)
curl -s http://localhost:4000/api/instruments | grep -o '"platform_type":"[^"]*"' | sort | uniq -c

# 4. Test OGC WMS 1.3.0 GetCapabilities
curl -s "http://localhost:4000/api/wms?SERVICE=WMS&REQUEST=GetCapabilities" | head -n 20

# 5. Test OGC WMS GetMap PNG Generation
curl -s -I "http://localhost:4000/api/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=temperature&BBOX=45,-15,100,30&WIDTH=256&HEIGHT=256&FORMAT=image/png"

# 6. Test CF-1.8 NetCDF-4 On-Demand Export
curl -s -I "http://localhost:4000/api/export/netcdf?variable=temperature&date=2024-06-05"
```

---

## Core Capabilities & Features

1. **3D Water Column Volumetric Slices**: Drapes horizontal cross-sections from surface (`0m`, 20–32°C) down through the thermocline (`100m–200m`) to abyssal cold water (`2000m`, 2–4°C).
2. **60 FPS Real-Time Ocean Current Vectors**: GPU-instanced moving billboards continuously streaming along flow vectors (Somali Jet, Wyrtki Jet, Rossby Eddies).
3. **In-Situ Observation Co-Display**: Argo floats, underwater gliders, and OMNI moored buoys rendered as glowing radar beacons with distance decluttering and interactive CTD depth modals.
4. **14-Day Timeline Animation**: Predictive pre-fetching scrubber with Play/Pause, Rewind, Fast-Forward, and 1x/2x/4x speed toggle.
5. **Public Outreach & Guided Science Tours**: 4 cinematic camera flights with narrative explanations designed for exhibitions, students, and policymakers.
6. **Open Standards & Interoperability**: Standard OGC WMS 1.3.0 and CF-1.8 NetCDF-4 download for QGIS, ArcGIS, and Python `xarray`.
7. **Zero-Touch Plugin Extensibility**: Modular `IngestionAdapter` (Python) and `LayerRegistry` (TypeScript) allowing new sensor streams in under 15 minutes.

---

## Documentation

- [System Architecture Specification](ARCHITECTURE.md)
- [Master Build Plan & Phase Deliverables](docs/INCOIS_Ocean_3D_Viz_Master_Build_Plan.md)
- [Data Standards (CF-1.8 & OGC WMS)](docs/DATA_STANDARDS.md)
- [Developer Guide: Adding a New Layer / Sensor](docs/ADDING_A_LAYER.md)
- [Problem Statement (Verbatim)](docs/PROBLEM_STATEMENT.md)
