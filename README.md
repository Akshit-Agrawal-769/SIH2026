# INCOIS 3D Ocean Data Visualization Platform

A web-based 3D ocean data visualization platform that combines INCOIS Bio-ROMS model fields, CMEMS ARMOR3D surface currents and QC-filtered Argo profiles over the Indian Ocean and India's EEZ, on a Cesium globe with a Three.js water-column view.

Developed for the **Smart India Hackathon 2026 (SIH 2026)**.

> **Frontend (static hosting):**  https://sih2026-drab.vercel.app
>
> Static hosting serves the same authentic artefacts (tiles, Argo profiles, precomputed
> comparisons). Point analytics, WMS and NetCDF export need the API: deploy
> `render.yaml` and build the frontend with `VITE_API_BASE_URL=<gateway URL>`.

## 1. Project Information

- **Project Title:** INCOIS 3D Ocean Data Visualization Platform
- **PS ID:** SIH2026-26067
- **PS Title:** Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations
- **Organization:** Ministry of Earth Sciences (MoES) — Indian National Centre for Ocean Information Services (INCOIS)
- **Category:** Software
- **Theme:** Disaster Management / Smart Ocean & Climate
- **Team Name:** W.A.V.E
- **Team Members:**
  - Akshit Agrawal (Team Leader)
  - Aveeral Jain
  - Shreyansh Rastogi
  - Uddip Jain
  - Aayura Shankar Upadhyay
  - Indrina Gupta

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

- **Dual-engine view:** CesiumJS for geographic context (globe, fields, Argo markers, EEZ, currents) and Three.js for a water-column view at any ocean point.
- **Authentic data only:** every served value is traceable to a source NetCDF file through `frontend/public/api/catalog.json` (see [DATA_POLICY.md](DATA_POLICY.md)). Missing data is shown as "no data", never filled.
- **Model vs observation:** surface matchups between Argo floats and INCOIS Bio-ROMS with RMSE, MAE, bias and Pearson r computed from the listed pairs.
- **Open standards:** OGC WMS 1.3.0 and CF-1.8 NetCDF export from the same tiles.

---

## 4. Key Features (as implemented)

| Feature | Data | Notes |
|---|---|---|
| Globe fields: SST, SSS, chlorophyll-a, MLD | INCOIS Bio-ROMS, 12 monthly timesteps of 2019, surface only | log scale for chlorophyll |
| Surface geostrophic currents | CMEMS ARMOR3D, 2024-12-31 only | arrows on the real 1° vector grid |
| Timeline | real catalog timesteps only | custom UTC range, step, speed, keyboard |
| Argo floats | 13 floats, latest QC 1/2 profile each | T, S, and O₂/Chl where measured |
| Profile analysis | observed MLD (ΔT = 0.2 °C) and thermocline | from the Argo profile |
| Model vs observation | Argo ≤10 m vs IBR surface, ±15 days | 2902120: 210 pairs; 2902084: 52 pairs |
| Point analytics | time series (OLS), spatial z-score, correlation | requires the API |
| Water-column view (Three.js) | real surface field + nearest Argo profile | no subsurface gridded data exists |
| WMS 1.3.0 / NetCDF export | catalogued tiles | exact subsets, real time/depth |

Depth slicing below the surface shows no gridded data by design: the available model and
analysis products are surface-only, and subsurface values are never interpolated or invented.

---

## 5. Technology Stack

- **Frontend:** React 18, TypeScript, CesiumJS, Three.js, Vite, Tailwind CSS, Lucide Icons, Recharts
- **C++ Ocean Engine (`ocean_core`):** C++20, NetCDF C API, CMake — NetCDF loaders, QC filter, UNESCO/TEOS-10 depth, standalone tile exporter
- **Data build:** Python (`scripts/build_authentic_dataset.py`: netCDF4, SciPy, gsw)
- **Backend Data Service:** Python 3.11+, FastAPI, NumPy, SciPy, netCDF4; optional SQLAlchemy/GeoAlchemy2 (PostGIS) and MinIO
- **API Gateway:** Node.js, Express, TypeScript (public read-only proxy, JWT for mutating requests, rate limit)
- **Database & Storage:** PostgreSQL 15 + PostGIS, Redis 7, MinIO S3 Object Storage
- **Containerization:** Docker, Docker Compose

---

## 6. Architecture

See [docs/architecture.md](docs/architecture.md) for the complete architectural specification.

```text
[ SOURCE NETCDF (datasets/, not in git) ]
  - INCOIS-BIO-ROMS.nc  (INCOIS Bio-ROMS, monthly surface SST/SSS/CHL/MLD)
  - cmems.nc            (CMEMS ARMOR3D, 2024-12-31 surface ugo/vgo)
  - Argo GDAC profiles  (coriolis/<WMO>/profiles/S*.nc, argo/incois_<WMO>_prof.nc)
                        │
                        ▼
  scripts/build_authentic_dataset.py   (QC 1/2, TEOS-10, regridding, matchups)
                        │
                        ▼
  frontend/public/{tiles,api,data}     (catalog.json + INCO float32 tiles + JSON)
          │                                        │
          ▼                                        ▼
  FastAPI data-service (8000)           static hosting (Vercel) serves the same files
          │
          ▼
  Node gateway (4000, public GET, JWT for POST)
          │
          ▼
  React client (3000):  Cesium globe  +  Three.js water-column view
```

The C++ `ocean_core` (`cpp_visualizer/`) provides independent NetCDF readers, QC filtering
and a standalone tile exporter (`export_real_tiles`, labels tiles with source timestamps);
the served tiles come from the Python build script.

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
| `cpp_visualizer/` | C++ computational core, QC filtering, depth conversion, standalone tile exporter |
| `scripts/build_authentic_dataset.py` | Builds every served artefact from the source NetCDF files |
| `gateway/` | Node.js reverse proxy (public GET, JWT for mutating requests), rate limiting |
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
- **Note:** the demo video was recorded with an earlier build whose subsurface fields, glider/buoy platforms and current animation used synthetic data that has since been removed (see AUDIT_REPORT.md).

---

## 10. Screenshots / Prototype Previews

Store and view screenshots in [assets/screenshots/](assets/screenshots/):


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

### Rebuilding the data (only when the source NetCDF files change)
```bash
pip install -r scripts/requirements-build.txt
python scripts/build_authentic_dataset.py --ibr-year 2019
```

### Option 1: Docker
```bash
docker compose up --build -d
# optional: load the catalogued Argo profiles into PostGIS
docker exec -it incois_data_service python seed_data.py
```

### Option 2: Local Development
```bash
# Terminal 1: Python Data Service (reads frontend/public by default)
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

# Tests
cd data-service && pytest tests/            # engine + API on the real catalog
cd frontend && npx vitest run               # timeline, colour scale, sound speed

# Optional C++ build
cmake -S cpp_visualizer -B cpp_visualizer/build && cmake --build cpp_visualizer/build
ctest --test-dir cpp_visualizer/build
```

### Port Mappings
| Service | URL | Notes |
|---|---|---|
| **3D Web Visualizer** | [http://localhost:3000](http://localhost:3000) | Interactive Cesium + Three.js application |
| **API Gateway** | [http://localhost:4000](http://localhost:4000) | Reverse proxy & API aggregator |
| **Backend Swagger API** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive OpenAPI documentation |
| **OGC WMS 1.3.0** | [http://localhost:4000/api/wms](http://localhost:4000/api/wms?SERVICE=WMS&REQUEST=GetCapabilities) | GIS integration endpoint |
| **MinIO S3 Console** | [http://127.0.0.1:9001](http://127.0.0.1:9001) | Optional object storage (bound to localhost) |

---

## 13. Future Scope

1. **AI/ML Thermocline & Eddy Detection:** Integrate deep-learning models (CNN/LSTM) to automatically identify mesoscale eddies, coastal upwelling zones, and thermocline depth anomalies.
2. **High-Frequency (HF) Radar Streaming:** Direct WebSockets ingestion of coastal HF-radar surface velocity measurements along the Indian coastline.
3. **Satellite Altimetry Assimilation:** Ingest live sea level anomaly (SLA) data from INSAT-3D and SWOT missions for dynamic sea-surface height modeling.
4. **Mobile & PWA Optimization:** Lightweight progressive web app (PWA) client for artisanal fishermen and field operational teams.

---

## Important Security & Integrity Notice

- **Credentials:** no secrets are committed. `docker-compose.yml` only has local-development defaults for PostGIS/MinIO, bound to 127.0.0.1. The gateway has no built-in login; mutating endpoints stay disabled unless `JWT_SECRET` (gateway) and `ADMIN_API_TOKEN` (data-service) are set.
- **Scientific data policy:** see [DATA_POLICY.md](DATA_POLICY.md) and [METHODOLOGY.md](METHODOLOGY.md). The 2026-09 audit is summarised in [AUDIT_REPORT.md](AUDIT_REPORT.md).
