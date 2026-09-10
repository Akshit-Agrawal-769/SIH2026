# INCOIS 3D Ocean Data Visualization Platform

A web-based, browser-native 3D interactive ocean visualization platform ("Digital Twin of the Water Column") that integrates numerical ocean model outputs and in-situ observations (Argo profiling floats, autonomous underwater gliders, and moored buoys) across the Indian Ocean and Exclusive Economic Zone (EEZ).

Developed for the **Smart India Hackathon 2026 (SIH 2026)**.

---

## 1. Project Information

- **Project Title:** INCOIS 3D Ocean Data Visualization Platform
- **PS ID:** SIH2026-26067
- **PS Title:** Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations
- **Organization:** Ministry of Earth Sciences (MoES) — Indian National Centre for Ocean Information Services (INCOIS)
- **Category:** Software
- **Theme:** Disaster Management / Smart Ocean & Climate
- **Team Name:** *(Add Team Name)*
- **Team Members:**
  - Member 1 (Team Leader)
  - Member 2
  - Member 3
  - Member 4
  - Member 5
  - Member 6

---

## 2. Problem Statement

India's vast Exclusive Economic Zone (EEZ) and coastline demand continuous, high-resolution monitoring of ocean state variables. INCOIS routinely generates and archives large volumes of ocean model outputs (3D fields of temperature, salinity, currents, chlorophyll) as well as observational data from autonomous instruments such as Argo profiling floats and underwater Gliders.

### Key Gaps Identified:
1. **Lack of 3D Volumetric View:** Existing systems are largely restricted to 2D planar maps or desktop-bound software, failing to convey complex vertical water column phenomena (thermoclines, haloclines, and mixed layer depths).
2. **Disconnected Observation vs. Model Streams:** Operational oceanographers must toggle between separate software packages to compare model predictions with physical instrument soundings.
3. **Absence of Real-Time Depth Slicing:** Forecasters lack interactive tools to scrub through depth layers from the sea surface down to 2000m with dynamic colorbars and streamlines.
4. **Data Integrity & Synthetic Fallback Risks:** Standard web viewers often fill missing observations with unscientific synthetic interpolation rather than authentic source data.

---

## 3. Proposed Solution

The **INCOIS 3D Ocean Platform** provides a browser-native Digital Twin of the water column:
- **Dual-Engine 3D Architecture:** Merges **CesiumJS** (macro-scale geospatial virtual globe navigation) with **Three.js** (micro-scale 3D volumetric water column studio).
- **Authoritative C++ Core (`ocean_core`):** Direct C++ NetCDF reading, international UNESCO QC filtering (flags '1' and '2'), TEOS-10 thermodynamics, and sub-millisecond Float32 binary tile export (`INCO` format).
- **Co-Visualization of Models & Sensors:** Simultaneous display of gridded CMEMS/ROMS ocean models and authentic in-situ CTD profiles (Argo floats and gliders).
- **Zero-Mock Scientific Integrity:** Strict elimination of all synthetic/fake data generators. Missing observations produce explicit HTTP 404 responses with transparent provenance tracking.

---

## 4. Key Features

- **Global 3D Virtual Globe:** Geospatial navigation across the Indian Ocean, Arabian Sea, and Bay of Bengal with bathymetric terrain and day-night terminators.
- **Dynamic Depth Slicing:** Smooth vertical navigation through the water column (surface to -2000m abyssal basin) with sub-millisecond response.
- **60 FPS Current Streamlines:** GPU-accelerated WebGL vector particle system animating horizontal ocean currents and eddies.
- **3D Volumetric Water Column Studio:** Interactive Three.js cube inspector with laser depth slicing and water mass stratification analysis.
- **In-Situ CTD Profile Inspector:** Interactive temperature and salinity sounding charts for active INCOIS Argo floats.
- **Scientific Colormap Customization:** Calibrated oceanographic palettes (NOAA SST, Turbo, Viridis, GFDL Chlorophyll) with auto-calibration.
- **Open Standards Interoperability:** Native OGC WMS 1.3.0 GetMap/GetCapabilities endpoints and CF-1.8 NetCDF-4 volumetric data export.

---

## 5. Technology Stack

- **Frontend:** React 18, TypeScript, CesiumJS, Three.js, Vite, Tailwind CSS, Lucide Icons, Recharts
- **C++ Ocean Engine (`ocean_core`):** C++17/20, NetCDF C/C++ API, CMake, Ninja, UCRT64/GCC
- **Backend Data Service:** Python 3.11+, FastAPI, Uvicorn, xarray, NetCDF4, NumPy, SciPy, SQLAlchemy, GeoAlchemy2
- **API Gateway:** Node.js, Express, TypeScript
- **Database & Storage:** PostgreSQL 15 + PostGIS, Redis 7, MinIO S3 Object Storage
- **Containerization:** Docker, Docker Compose

---

## 6. Architecture

See [docs/architecture.md](docs/architecture.md) for the complete architectural specification.

```text
[ AUTHENTIC NETCDF DATASETS ]
  - CMEMS Reanalysis (cmems.nc)
  - INCOIS Bio-ROMS (INCOIS-BIO-ROMS.nc)
  - INCOIS Argo Profiles (datasets/argo/*.nc)
                        │
                        ▼
       [ C++ OCEAN_CORE ENGINE ]
         - NetCDF Loader & UNESCO QC Filter
         - TEOS-10 Thermodynamics
         - export_real_tiles Tool
                        │
                        ▼ produces 32-byte 'INCO' + Float32 binary tiles
               [ AUTHORITATIVE TILES ]
               tiles/{variable}/{date}/{depth}.bin
                        │
                        ▼
       [ FASTAPI DATA SERVICE (Port 8000) ]
         - tiles.py (Float32 tiles / 404 on missing)
         - instruments.py (Authentic Argo CTD profiles)
         - wms.py (OGC WMS 1.3.0) & export.py (CF-1.8 NetCDF)
                        │
                        ▼
       [ NODE.JS GATEWAY (Port 4000) ]
                        │
                        ▼
       [ REACT 18 CLIENT (Port 3000) ]
         ┌──────────────┴──────────────┐
         ▼                             ▼
[ CESIUM 3D GLOBE ]          [ THREE.JS 3D VOLUME ]
- Geospatial Context          - 3D Water Column Studio
- Depth-Slice Draping         - Laser Scan & In-Situ CTD
```

---

## 7. Repository Structure

```text
INCOIS-3D-OCEAN-VISUALIZATION/
├── README.md                      # Project overview (13 sections)
├── SUBMISSION_GUIDE.md            # SIH 2026 checklist & evaluation criteria
├── submission/                    # Evaluation deliverables
│   ├── PRESENTATION.md            # Slide deck & cloud viewer links
│   └── DEMO.md                    # Working demo video link & outline
├── docs/                          # Technical documentation
│   ├── architecture.md            # Detailed system & data architecture
│   ├── PROBLEM_STATEMENT.md       # Official MoES/INCOIS problem description
│   ├── DATA_STANDARDS.md          # CF-1.8 NetCDF & OGC WMS specifications
│   └── ADDING_A_LAYER.md          # Extensible plugin guide for new sensors
├── assets/                        # Visual media and screenshots
│   └── screenshots/               # Interface previews and naming guide
│       └── README.md              # Screenshot catalog
├── frontend/                      # React 18 + CesiumJS + Three.js web visualizer
├── data-service/                  # FastAPI ocean microservice
├── cpp_visualizer/                # C++ ocean_core engine & tile exporter
├── gateway/                       # Node.js API Gateway reverse proxy
├── datasets/                      # Authentic scientific NetCDF archives
├── tiles/                         # Authoritative binary voxel tiles
├── requirements.txt               # Top-level Python environment requirements
├── docker-compose.yml             # Container orchestration
├── .gitignore                     # Git ignore rules
└── LICENSE                        # MIT License
```

### What goes where?

| Directory / File | Description |
|---|---|
| `frontend/` | Web application source code (CesiumJS, Three.js, React components) |
| `data-service/` | FastAPI backend, OGC WMS, CF-1.8 exporter, and NetCDF ingestion adapters |
| `cpp_visualizer/` | C++ computational core, QC filtering, TEOS-10, and binary tile exporter |
| `gateway/` | Node.js reverse proxy, rate limiting, and API consolidation |
| `datasets/` | Authentic source NetCDF files (CMEMS, Bio-ROMS, Argo) |
| `docs/` | Comprehensive technical architecture and scientific standards |
| `assets/screenshots/` | High-resolution UI captures and visualizer previews |
| `submission/` | Final SIH presentation PPT/PPTX and demo video links |
| `README.md` | Primary SIH submission overview |

---

## 8. Final Presentation

The team's final SIH PowerPoint presentation is documented in [submission/PRESENTATION.md](submission/PRESENTATION.md).

- **Local Presentation File:** [submission/INCOIS_Ocean3D_SIH2026_Final_Presentation.pptx](submission/PRESENTATION.md)
- **Accessible Cloud Viewer Link:** Accessible via Google Drive / OneDrive in [submission/PRESENTATION.md](submission/PRESENTATION.md) (configured with public view permissions).

---

## 9. Demo Video

A video demonstration of the working 3D visualizer is documented in [submission/DEMO.md](submission/DEMO.md).

- **Demonstration Link:** Accessible via YouTube / Google Drive in [submission/DEMO.md](submission/DEMO.md).
- **Features Demonstrated:** Full 3D globe orbit, 60 FPS current streamlines, laser depth slicing, Three.js water column block, and authentic in-situ CTD profile inspection.

---

## 10. Screenshots / Prototype Previews

Store and view screenshots in [assets/screenshots/](assets/screenshots/):

| View | Screenshot | Description |
|---|---|---|
| **Cesium 3D Globe** | [View](assets/screenshots/01-cesium-3d-globe.png) | Indian Ocean SST colormap with current vector streamlines and Argo float markers |
| **3D Volumetric Studio** | [View](assets/screenshots/02-volumetric-cube-studio.png) | Three.js water column cube with laser depth slicing and stratification planes |
| **Argo CTD Inspector** | [View](assets/screenshots/03-argo-profile-inspector.png) | Vertical CTD sounding curves (temperature & salinity down to 2000m) |

See [assets/screenshots/README.md](assets/screenshots/README.md) for full descriptions.

---

## 11. Installation

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose (Recommended)
- *Or for manual setup:* Node.js 18+, Python 3.11+, and CMake / GCC (C++17)

### Step 1: Clone Repository
```bash
git clone https://github.com/Akshit-Agrawal-769/SIH2026.git
cd SIH2026
```

### Step 2: Environment Configuration
```bash
cp .env.example .env
```

---

## 12. Run

### Option 1: Docker (Recommended 1-Command Startup)
```bash
# Build and launch all services in background
docker compose up --build -d

# Seed database and sync authentic binary tiles
docker exec -it incois_data_service python seed_data.py
```

### Option 2: Local Development
```bash
# Terminal 1: Python Data Service
cd data-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Node Gateway
cd gateway
npm install
npm run dev

# Terminal 3: React Frontend
cd frontend
npm install
npm run dev

# Optional C++ Exporter Build:
cd cpp_visualizer
mkdir build && cd build
cmake -G Ninja ..
ninja
./export_real_tiles ../.. ../../tiles
```

### Port Mappings
| Service | URL | Notes |
|---|---|---|
| **3D Web Visualizer** | [http://localhost:3000](http://localhost:3000) | Interactive Cesium + Three.js application |
| **API Gateway** | [http://localhost:4000](http://localhost:4000) | Reverse proxy & API aggregator |
| **Backend Swagger API** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive OpenAPI documentation |
| **OGC WMS 1.3.0** | [http://localhost:4000/api/wms](http://localhost:4000/api/wms?SERVICE=WMS&REQUEST=GetCapabilities) | GIS integration endpoint |
| **MinIO S3 Console** | [http://localhost:9001](http://localhost:9001) | Object storage admin console |

---

## 13. Future Scope

1. **AI/ML Thermocline & Eddy Detection:** Integrate deep-learning models (CNN/LSTM) to automatically identify mesoscale eddies, coastal upwelling zones, and thermocline depth anomalies.
2. **High-Frequency (HF) Radar Streaming:** Direct WebSockets ingestion of coastal HF-radar surface velocity measurements along the Indian coastline.
3. **Satellite Altimetry Assimilation:** Ingest live sea level anomaly (SLA) data from INSAT-3D and SWOT missions for dynamic sea-surface height modeling.
4. **Mobile & PWA Optimization:** Lightweight progressive web app (PWA) client for artisanal fishermen and field operational teams.

---

## Important Security & Integrity Notice

- **Zero Credentials Committed:** This repository contains no passwords, private API keys, or cloud access tokens. Default development configurations are provided via `.env.example`.
- **Scientific Data Policy:** In accordance with MoES/INCOIS guidelines, this repository operates under a strict **NO MOCK DATA** policy. All visualizations originate from authentic NetCDF sources or explicit HTTP 404 responses.
