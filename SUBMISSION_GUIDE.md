# SIH 2026 Submission Guide

Use this checklist before sharing your GitHub repository link with the SIH evaluation committee and ministry evaluators.

---

## Required Repository Content

- [x] **Actual source code is present:** Full implementations for the Frontend (React + CesiumJS + Three.js), Backend (FastAPI), C++ Ocean Engine (`ocean_core`), and Node.js API Gateway.
- [x] **`README.md` explains the project clearly:** Structured according to the standard 13-section SIH reference format.
- [x] **PS ID and PS Title are included:** Problem Statement ID `SIH2026-26067` / Ministry of Earth Sciences (MoES) — INCOIS.
- [x] **Problem statement and proposed solution are explained:** Clear oceanographic background, identified gaps, and digital twin solution.
- [x] **Key features are listed:** Volumetric 3D water column studio, depth-slice navigation, in-situ CTD observation co-visualization, C++ authentic data engine, zero-mock scientific integrity.
- [x] **Technology stack is listed:** Detailed listing of languages, frameworks, graphics engines, and scientific libraries.
- [x] **Setup and run instructions work:** Single-command Docker startup (`./run.sh` / `docker compose up`) and local manual dev scripts.
- [x] **Important screenshots are included:** High-resolution screenshots of the 3D globe, volumetric cube studio, depth slice layer, and CTD charts in `assets/screenshots/`.
- [x] **Final PPT / presentation is placed in `submission/`:** Located in `submission/PRESENTATION.md` with viewer links.
- [x] **Demo video link is added in `submission/DEMO.md`:** Comprehensive demonstration of the working 3D visualizer.
- [x] **Repository is accessible to reviewers:** All code, documentation, and dependencies are public and deployable without proprietary access tokens.

---

## Recommended Structure

```text
INCOIS-3D-OCEAN-VISUALIZATION/
├── README.md                      # Primary project overview (13 sections)
├── SUBMISSION_GUIDE.md            # Submission checklist and evaluation guide
├── submission/                    # Final SIH deliverables
│   ├── PRESENTATION.md            # PPT/PPTX slides and viewable links
│   └── DEMO.md                    # Video walk-through & feature highlights
├── docs/                          # In-depth technical documentation
│   ├── architecture.md            # Comprehensive system & data architecture
│   ├── PROBLEM_STATEMENT.md       # Official MoES / INCOIS problem specification
│   ├── DATA_STANDARDS.md          # CF-1.8 NetCDF & OGC WMS 1.3.0 standards
│   └── ADDING_A_LAYER.md          # Extensible plugin guide for new ocean variables
├── assets/                        # Visual media and interface previews
│   └── screenshots/               # UI captures, 3D models, and CTD HUD plots
│       └── README.md              # Screenshot catalog and descriptions
├── frontend/                      # Web visualizer (React 18, CesiumJS, Three.js, TypeScript)
├── data-service/                  # Scientific backend (FastAPI, xarray, NetCDF4, GeoAlchemy)
├── cpp_visualizer/                # Authoritative C++ ocean_core pipeline & binary exporter
├── gateway/                       # API reverse proxy & WebSocket hub (Node.js/Express)
├── datasets/                      # Authentic CMEMS, ROMS, and Argo NetCDF sources
├── tiles/                         # Authoritative binary voxel tiles (INCO format)
├── requirements.txt               # Top-level Python environment requirements
├── docker-compose.yml             # Full-stack container orchestration
├── .gitignore                     # Production ignore rules
└── LICENSE                        # Open-source license (MIT)
```

---

## Presentation Requirements

Upload your team's final SIH presentation into the `submission/` folder.

- **File convention:** `TeamName_SIH2026_Presentation.pptx`
- **Fallback link:** If the presentation exceeds GitHub file size limits, upload to Google Drive / OneDrive and provide an accessible viewer link in `submission/PRESENTATION.md`.
- **Pre-submission verification:** Verify the link in an incognito window while logged out.

---

## Demo Video Requirements

The demo video should be focused, professional, and showcase real software functionality:

1. **Duration:** 3 to 5 minutes recommended.
2. **Key workflows to demonstrate:**
   - 3D geospatial navigation across the Indian Ocean on the Cesium globe.
   - Dynamic depth-slice scrubbing (surface down to abyssal floor).
   - Opening the 3D Volumetric Water Column Block Studio (Three.js modal).
   - Clicking an authentic Argo float or Glider to inspect the vertical CTD temperature/salinity profile.
   - Switching ocean variables (Temperature, Salinity, Current Vectors, Chlorophyll-a).
   - Exporting CF-1.8 NetCDF volumetric datasets and OGC WMS capability.
3. Add the viewable YouTube / Google Drive URL to `submission/DEMO.md`.

---

## Screenshots & Prototype Previews

Store clear, annotated screenshots of the working platform in `assets/screenshots/`:
- `01-cesium-3d-globe.png`: Full-globe geospatial ocean context with current vectors and instrument markers.
- `02-volumetric-cube-studio.png`: High-detail Three.js 3D ocean block inspection with laser slicing.
- `03-argo-profile-inspector.png`: CTD depth profile chart showing authentic in-situ sensor measurements.
- `04-depth-slice-hud.png`: Real-time oceanographic telemetry, dynamic colorbar controls, and layer toggles.

---

## Security & Cleanliness Checklist

Before submitting the GitHub link:
- [x] No API keys, passwords, or secret tokens are committed.
- [x] `.env.example` is provided with default dev configurations.
- [x] Temporary build folders (`node_modules`, `__pycache__`, `.venv`, `cpp_visualizer/build/`) are excluded via `.gitignore`.
- [x] Zero synthetic/mock data generation is present in production code paths.
- [x] The repository builds cleanly from scratch on any standard machine.
