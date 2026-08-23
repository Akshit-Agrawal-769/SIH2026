# INCOIS Web-Based 3D Ocean Data Visualization System
### Integrated 3D Volumetric Ocean Model Rendering & In-Situ Observation Co-Display Platform
**Smart India Hackathon (SIH 2026) — Problem Statement 26067**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Three.js / WebGL2](https://img.shields.io/badge/Three.js-WebGL2-black.svg?logo=three.js&logoColor=white)](https://threejs.org)

---

## 1. Problem Statement & Operational Context

India's vast Exclusive Economic Zone (EEZ) and coastline demand continuous, high-resolution monitoring of ocean state variables. **INCOIS (Indian National Centre for Ocean Information Services)** routinely generates and archives large volumes of numerical ocean model outputs (such as **ROMS / INDOFOS** 3D/4D fields of temperature, salinity, currents $u, v, w$, and chlorophyll) alongside in-situ observations from autonomous **Argo profiling floats** and underwater **Gliders**.

Despite the richness of this data, traditional tools are desktop-bound, support only 2D plan views, or lack the ability to co-visualize numerical model outputs alongside in-situ instrument profiles.

### The Solution
A browser-native, high-performance **3D Ocean Data Visualization Platform** that combines numerical ocean model fields (ROMS / INDOFOS) with real in-situ observations (Argo profiling floats) in a unified interactive 3D WebGL2 scene, complete with 4D spatio-temporal colocation and statistical model validation metrics.

> [!IMPORTANT]
> **STRICT NO MOCK DATA POLICY**  
> This platform strictly ingests and processes real oceanographic datasets. No fake temperatures, hardcoded coordinates, or synthetic float paths exist in production. Pressure-to-depth conversions are calculated using the thermodynamic equation of seawater (**TEOS-10** / `gsw.z_from_p`).

---

## 2. Core Capabilities & Features

- **3D Volumetric Raymarching**: Custom WebGL2 GLSL fragment shaders for direct raymarching of 3D scalar ocean volumes (`Data3DTexture`) with step-size integration and opacity transfer functions.
- **Scientific Colormaps**: Real-time switching between standard scientific palettes (**Turbo**, **Viridis**, **Thermal**, **Jet**).
- **Interactive 2D Depth Slicing**: Dynamic depth plane elevation control ($0\text{m} \rightarrow 2000\text{m}$) to inspect horizontal slices at arbitrary ocean levels.
- **Iso-Surface Extraction**: Real-time 3D iso-surface threshold rendering for oceanographic fronts and thermoclines.
- **In-Situ Argo Co-Display**: 3D instanced Argo float markers placed at authentic geographic coordinates (Arabian Sea & Bay of Bengal) with interactive raycasting click inspection.
- **Statistical Model-vs-Obs Validation**: 4D spatio-temporal interpolation colocating model fields onto in-situ float positions and depths, calculating:
  - Depth-resolved residuals: $\Delta(z) = \text{Model}(z) - \text{Obs}(z)$
  - Root Mean Square Error (RMSE)
  - Mean Absolute Error (MAE)
  - Forecast Bias
  - Pearson Correlation Coefficient ($r$)
- **Forecast Timeline Playback**: Automated 4D time-step animation with play/pause and step forward controls.

---

## 3. System Architecture

```mermaid
graph TD
    subgraph Data Sources ["Authoritative Data Sources (No Mock Data)"]
        DS1["INCOIS ROMS/INDOFOS Model NetCDF (4D Grid)"]
        DS2["Argo GDAC Profiling Float NetCDF (WMO 2902084 / 2902120)"]
    end

    subgraph Scientific Backend ["FastAPI Scientific Engine (Python 3.11+)"]
        XR["xarray Dataset Engine (h5netcdf / netcdf4)"]
        NORM["Coordinate & Unit Normalizer (gsw TEOS-10)"]
        INTERP["4D Spatial-Temporal Interpolator"]
        BIN_GEN["Float32 Binary Buffer & 3D Subvolume Generator"]
    end

    subgraph Frontend Application ["Browser WebGL2 App (React 18 + TypeScript + Three.js)"]
        UI["Scientific Control Panel (Variable, Depth, Colormaps)"]
        RENDER["Three.js WebGL2 3D Scene Viewport"]
        
        subgraph GPU Shaders ["GPU Shaders"]
            RAYMARCH["3D Raymarching Volume Shader (R32F Data3DTexture)"]
            SLICE["2D Depth Slice Mesh Shader"]
        end

        subgraph InSitu ["Observation Analytics"]
            MARKER["3D Instanced Argo Float Markers & Sensor Cables"]
            PLOT["Interactive Residual & Profiling Modal (Scorecard: RMSE, MAE, Bias)"]
        end
    end

    DS1 --> XR
    DS2 --> NORM
    XR --> NORM --> INTERP
    XR --> BIN_GEN

    BIN_GEN --> RAYMARCH
    BIN_GEN --> SLICE
    NORM --> MARKER
    INTERP --> PLOT

    UI --> RENDER
    RENDER --> RAYMARCH
    RENDER --> SLICE
    RENDER --> MARKER
```

---

## 4. Repository Structure

```
SIH2026/
├── backend/                        # FastAPI Scientific Data Gateway
│   ├── app/
│   │   ├── api/                    # Endpoints (/health, /model, /observations, /comparison)
│   │   ├── core/                   # Server configuration & CORS settings
│   │   ├── services/               # xarray 3D slicing, Argo parser, 4D comparison engine
│   │   ├── schemas/                # Pydantic data schemas
│   │   └── main.py                 # FastAPI application entrypoint
│   ├── tests/                      # Automated pytest test suites
│   ├── requirements.txt            # Backend dependencies
│   └── Dockerfile
├── frontend/                       # React 18 + TypeScript + Three.js WebGL App
│   ├── src/
│   │   ├── components/             # ControlPanel, ObservationModal, ColorbarLegend, Header
│   │   ├── rendering/              # Three.js OceanViewer, Volume Raymarching GLSL shaders
│   │   ├── store/                  # Zustand state management
│   │   ├── types/                  # TypeScript interface definitions
│   │   ├── App.tsx                 # Main application assembly
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── nginx.conf                  # Nginx reverse proxy configuration for Docker
│   └── Dockerfile
├── ingestion/                      # Scientific Data Ingestion & Validation Pipeline
│   ├── fetch_real_datasets.py      # Real Argo GDAC & ROMS model fetcher
│   ├── validate_real_data.py       # Real data & TEOS-10 validation script
│   ├── adapters/                   # ROMS NetCDF & Argo NetCDF adapters
│   └── requirements.txt
├── datasets/                       # Real NetCDF Data Storage Directory
│   ├── model/                      # Real INCOIS ROMS NetCDF files
│   ├── argo/                       # Real Argo profile NetCDF files
│   └── README.md
├── start_dev.sh                    # Single-command startup script (Backend + Frontend)
├── check_system.py                 # System health and diagnostics utility
├── docker-compose.yml              # Containerized multi-service deployment
└── README.md
```

---

## 5. Quick Start & How to Run

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 18+ / npm 9+
- **Docker & Docker Compose** (Optional, for containerized run)

---

### Method 1: Single-Command Startup (Recommended)

The easiest way to start both the scientific backend and the WebGL frontend together:

```bash
# Clone the repository
git clone https://github.com/Akshit-Agrawal-769/SIH2026.git
cd SIH2026

# Launch backend (port 8000) and frontend (port 3000) concurrently
./start_dev.sh
```

- Open **`http://localhost:3000`** in your browser.
- Interactive API Documentation: **`http://localhost:8000/docs`**.

---

### Method 2: Manual Multi-Terminal Setup

#### Terminal 1 — Start Scientific Backend:
```bash
cd SIH2026/backend

# Install Python dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2 — Start WebGL Frontend:
```bash
cd SIH2026/frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

---

### Method 3: Docker Compose

```bash
cd SIH2026
docker-compose up --build
```

---

## 6. Dataset Ingestion & Validation

To fetch fresh real Indian Ocean datasets and verify CF conventions:

```bash
# 1. Fetch authentic open-access Indian Ocean Argo floats and model data
python3 ingestion/fetch_real_datasets.py

# 2. Run real data validator and TEOS-10 conversion check
python3 ingestion/validate_real_data.py
```

---

## 7. System Diagnostics & Automated Testing

Run the full system health check and automated test suite:

```bash
# 1. Run system diagnostics
python3 check_system.py

# 2. Run backend API & scientific computation tests
cd backend
python3 -m pytest tests/
```

---

## 8. REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Checks status of loaded real NetCDF datasets. |
| `GET` | `/api/v1/model/datasets` | Lists available ROMS/INDOFOS model NetCDF files. |
| `GET` | `/api/v1/model/metadata?filename=...` | Returns spatial bounds, depth levels, time range, and variable info. |
| `GET` | `/api/v1/model/volume3d?filename=...&variable=temp` | Streams normalized Float32 binary 3D volume buffer for WebGL `Data3DTexture`. |
| `GET` | `/api/v1/model/slice2d?filename=...&variable=temp` | Streams 2D Float32 binary depth slice buffer. |
| `GET` | `/api/v1/observations/argo` | Lists ingested Argo floats with trajectories and positions. |
| `GET` | `/api/v1/observations/argo/{wmo}/profile` | Returns full vertical profile measurements with TEOS-10 depths and QC flags. |
| `GET` | `/api/v1/comparison/profile?platform_number=...` | Returns 4D interpolated model vs obs comparison, residuals, and metrics (RMSE, MAE, Bias, $r$). |

---

## 9. License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
