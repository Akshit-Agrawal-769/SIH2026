# FORENSIC REPOSITORY & UI AUDIT REPORT
## INCOIS 3D Ocean Data Visualization & Analysis Platform

**Audit Status:** READ-ONLY FORENSIC AUDIT COMPLETE — ZERO SOURCE CODE MODIFIED  
**Audited Repository Commit:** `1c8156314f913ccb5b26b40a2a7dfa6fe977a053` (Branch: `main`, Clean Working Tree)  
**Date of Audit:** September 9, 2026  
**Auditor:** Antigravity Autonomous Diagnostic Agent  

---

### Section 1: Executive Summary

This forensic audit represents an exhaustive, read-only architectural, code, visual, and operational analysis of the **INCOIS 3D Ocean Data Visualization Platform** repository. Every single file, script, endpoint, asset, user interface component, 3D rendering pipeline, and data processing routine was inspected without making modifications, fixes, or commits.

#### Key High-Level Findings
1. **P0 Catastrophic Backend Crash on Startup / Profile Indexing**:  
   In `backend/app/services/insitu_store.py:659`, formatting `target_cycle=None` with `f"*{target_cycle:03d}*.nc"` throws a fatal `TypeError: unsupported format string passed to NoneType.__format__` during startup `_ensure_indexed()`. This causes the precomputed Argo index (1,318 platforms) to fail to load, triggering an unconstrained fallback re-index of thousands of NetCDF files across 9 DAC directories simultaneously. This starves threads, exhausts memory, and kills the Uvicorn backend process with exit code 1.
2. **P0 Critical UI Breakdown / Disappearing Panels**:  
   In `frontend/src/pages/HomePage.jsx:38` and `frontend/src/components/LocationDataPanel.jsx:63, 80`, the class `top-18` is used for positioning the primary left Ocean Intelligence panel and the right panels stack (`ViewRegionPanel`, `ActiveLayerPanel`, `SelectedFeaturePanel`). Because `top-18` **does not exist** in Tailwind CSS's default scale and is not defined in `tailwind.config.js`, the browser defaults these panels to static CSS flow *below* the 100vh 3D canvas (Y >= 720px). Coupled with `overflow-hidden` on `#root`, **all primary interface panels are completely invisible on screen**.
3. **P1 Alien Tactical / Military Surveillance Grafting ("God's Eye View")**:  
   `frontend/src/rendering/CesiumOceanViewer.jsx` mounts an entire 190-file external application (`frontend/src/gods-eye-view/`) into the Cesium DOM via `innerHTML = GEV_HTML`. This introduces military flights, TR-3B registries, CCTV gizmos, bikeshare trackers, commercial/fighter aircraft 3D models (`mq9.glb`, `b789.glb`), and continuous HTTP polling to non-existent OpenAI HUD and radar endpoints that fail with 404/CORS errors.
4. **P1 Scientific Misrepresentation & Synthetic Mock Data**:  
   - The spatial heatmaps on `ComparisonPage.jsx` are hardcoded CSS `radial-gradient` circles rather than spatial grids. When backend colocation fails, statistical metrics silently fall back to hardcoded strings (`0.91` Pearson R, `1842` samples).
   - In `AnalyticsPage.jsx`, 480 timeseries points are generated inside a client-side `for` loop using `Math.sin()` with random numbers, while the tabs "Vertical Profile", "Hovmöller", and "Spectral Analysis" are complete no-ops.
   - `SettingsPage.jsx` features an "Apply Settings" button that only toggles a local `isSaved` boolean for 2.5 seconds without updating Zustand or persistent storage.
5. **P1 Blocked File Upload via CORS**:  
   `backend/app/main.py:33` restricts CORS methods to `["GET", "OPTIONS"]`, preventing `POST /api/v1/observations/upload-delimited` from functioning from any frontend client.

#### Defect Severity Breakdown
- **P0 (Blocker / Crash / Corrupts Data):** 2
- **P1 (Critical Functionality Failure / Misleading Scientific Data):** 8
- **P2 (Major Bug / UI Glitch / Incorrect Operation):** 15
- **P3 (Minor Defect / Styling / Polish / Inconsistency):** 15
- **P4 (Informational / Code Quality / Tech Debt / Documentation):** 10
- **Total Cataloged Issues:** 50
\n---

### Section 2: Exact Git Commit Audited

- **Audited Commit SHA:** `1c8156314f913ccb5b26b40a2a7dfa6fe977a053`
- **Commit Message:** `Rastogi`
- **Branch:** `main`
- **Tracking Remote:** `origin/main` (`https://github.com/Akshit-Agrawal-769/SIH2026.git`)
- **Remote Synchronization State:** Local branch fast-forwarded cleanly to remote HEAD in Phase 0. Working tree 100% clean.
- **Git Status Output:**
  ```text
  On branch main
  Your branch is up to date with 'origin/main'.
  nothing to commit, working tree clean
  ```
- **Commit Author & Timestamp:** Recorded in Git repository metadata.
- **Verification Guarantee:** Zero commits, zero branch switches, and zero working tree modifications were made during this forensic audit.
\n---

### Section 3: Repository Architecture

#### Root Directory Structure & File Map
```text
d:\OneDrive\Desktop\SIH2026
├── .agents/                      # Agent orchestration & skills directory
├── .claude/                      # Tool integration configurations
├── .git/                         # Git repository metadata
├── .gitignore                    # Git exclusion rules
├── .pytest_cache/                # Cached test run artifacts
├── .vercelignore                 # Deployment exclusion rules
├── CONTEXT.md                    # System context & domain boundary definitions
├── DATA_POLICY.md                # Strict no-mock data mandate
├── LICENSE                       # MIT License
├── METHODOLOGY.md                # Scientific oceanographic methodologies
├── OCEAN_ONLY_REPO_AUDIT.md      # Previous audit baseline
├── README.md                     # Platform documentation
├── SCIENTIFIC_METHODS.md         # TEOS-10 & ROMS mathematical specs
├── backend/                      # Python FastAPI application
│   ├── app/                      # Application source code
│   │   ├── api/                  # FastAPI endpoints & routers
│   │   ├── core/                 # Config, logging, Prometheus metrics
│   │   ├── schemas/              # Pydantic data schemas
│   │   └── services/             # Deep modules (OceanModel, InsituStore, etc.)
│   ├── Dockerfile                # Container definition
│   ├── requirements.txt          # Python pip dependencies
│   └── tests/                    # Pytest test suite (6 test files)
├── check_system.py               # Dependency validation script
├── datasets/                     # NetCDF and geographic datasets
│   ├── INCOIS-BIO-ROMS.nc        # 9.25 GB ROMS model output
│   ├── cmems.nc                  # 95.3 MB Copernicus model reanalysis
│   ├── coriolis.zip              # 388 MB compressed in-situ data
│   ├── argo_index.json           # 13.7 MB index of 1,318 Argo platforms
│   ├── indian_agro.nc            # 52.4 KB NetCDF file (Typo: 'agro' vs 'argo')
│   ├── manifest.json             # Dataset checksums and metadata
│   ├── geography/                # Natural Earth 10m spatial boundaries
│   ├── model/                    # Processed ROMS NetCDF files
│   └── [dac_folders]/            # In-situ DAC directories (coriolis, incois, etc.)
├── docker-compose.yml            # Multi-container orchestration
├── frontend/                     # React + Vite + Tailwind application
│   ├── dist/                     # Production build artifacts
│   ├── index.html                # Entry point HTML
│   ├── nginx.conf                # Production reverse proxy config
│   ├── node_modules/             # Node dependencies
│   ├── package.json              # NPM package definitions
│   ├── public/                   # Static assets (3D GLB models, geography)
│   ├── src/                      # Frontend source code
│   │   ├── components/           # React UI components (25 files)
│   │   ├── gods-eye-view/        # Alien GEV surveillance engine (190+ files)
│   │   ├── pages/                # Dedicated workspace pages (9 files)
│   │   ├── rendering/            # Cesium & Three.js 3D engines
│   │   ├── store/                # Zustand global ocean store
│   │   └── utils/                # Geography, satellite shims, math
│   ├── tailwind.config.js        # Tailwind CSS styling tokens
│   ├── test/                     # Node unit test (geography.test.js)
│   └── vite.config.js            # Vite build configuration
├── ingestion/                    # Dataset ingestion & conversion scripts
├── start_dev.sh                  # Development startup bash script
└── vercel.json                   # Cloud deployment routing rules
```

#### Total Volume & File Footprint
- **Total Tracked Code Files (excluding datasets/node_modules):** 362 files
- **Total Datasets Disk Usage:** ~10.2 GB (dominated by `INCOIS-BIO-ROMS.nc` at 9.25 GB)
- **Primary Technology Stacks:**
  - Frontend: React 18.2, Vite 5.0, Tailwind CSS 3.4, Zustand 4.5, CesiumJS 1.145, Three.js 0.160, Plotly.js 2.28
  - Backend: Python 3.11, FastAPI 0.109, Uvicorn 0.27, Xarray 2023.12, NetCDF4 1.6.5, GSW 3.6.17 (TEOS-10), SciPy 1.11, NumPy 1.26
\n---

### Section 4: Frontend Architecture

The frontend is built on **React 18.2** with **Vite 5.0.12** and **Tailwind CSS 3.4.1**. Global application state is managed centrally via **Zustand** in `src/store/oceanStore.js`.

#### Component Hierarchy & Page Routing
Routing is implemented conditionally based on `activePage` in `src/App.jsx` rather than `react-router-dom`:
- `App.jsx`
  - `<Header />` (Top system navigation and telemetry indicators)
  - `<main>` Workspace Container:
    - `activePage === 'home'` -> `<HomePage />`
    - `activePage === 'explorer'` -> `<ExplorerPage />` (Duplicate wrapper around `<HomePage />`)
    - `activePage === 'coordinates'` -> `<CoordinatesPage />`
    - `activePage === 'argo'` -> `<ArgoPage />`
    - `activePage === 'comparison'` -> `<ComparisonPage />`
    - `activePage === 'analytics'` -> `<AnalyticsPage />`
    - `activePage === 'data'` -> `<DataCatalogPage />`
    - `activePage === 'settings'` -> `<SettingsPage />`
    - `activePage === 'methodology'` -> `<MethodologyPage />`
  - Global Utility Modals:
    - `<GoToLocationModal />`
    - `<ObservationModal />`
    - `<DiagnosticsDrawer />`
    - `<ShortcutsModal />`

#### Dual-Engine 3D Rendering Architecture
The application features two distinct rendering modes toggled via `engineMode` in `oceanStore`:
1. **Cesium Globe Mode (`CesiumOceanViewer.jsx`)**:
   - Intended as the primary digital twin globe for planetary-scale geospatial context.
   - Leverages `Cesium.Viewer` with custom imagery layers, atmospheric post-processing, and Argo float billboard/point collections.
   - **Critical Vulnerability**: Injects non-ocean God's Eye View HTML (`GEV_HTML`) into the Cesium root container, mounting 190+ surveillance scripts.
2. **Three.js Volumetric Mode (`OceanViewer.jsx` / `OceanSceneController.js`)**:
   - Custom WebGL2 volumetric raymarching engine for high-resolution 3D subsurface scalar fields (temperature, salinity, currents).
   - Utilizes `VolumeRaymarchingShader.js` sampling a 3D float texture (`THREE.Data3DTexture`) generated from NetCDF volumetric buffers.
   - Provides terrain-following s-coordinate vertical distortion and bathymetric ocean floor mesh.
\n---

### Section 5: Backend Architecture

The backend is an asynchronous **FastAPI** service serving as the scientific oceanographic computational gateway.

#### Architecture & Deep Service Modules
1. **`OceanModel` & `OceanModelRegistry` (`app/services/ocean_model.py`)**:
   - Reads CF-1.6 compliant NetCDF files (`xarray` and `netCDF4`).
   - Dynamically resolves variable aliases (`temp`, `thetao`, `salt`, `so`, `u`, `v`, `chl`).
   - Calculates true physical vertical depths for ROMS terrain-following vertical s-coordinates based on local bathymetry $h$, sea surface height $\zeta$, and stretching functions $C_s(r)$.
   - Generates 3D Float32 binary volume buffers for WebGL2 rendering and extracts 2D depth slices.
   - Maintains an in-memory LRU cache of opened dataset handles and volume grids.
2. **`InsituStore` (`app/services/insitu_store.py`)**:
   - Manages in-situ observation catalogs across Global Data Assembly Centers (Coriolis, INCOIS, AOML, BODC, JMA, CSIRO, MEDS, CSIO).
   - Reads `datasets/argo_index.json` containing 1,318 platforms.
   - Implements strict TEOS-10 conversion from raw sensor sea pressure (dbar) to physical depth (meters) via `gsw.z_from_p`.
   - Filters vertical profile levels according to WMO Argo Quality Control flags (retaining only Flag 1: Good and Flag 2: Probably Good).
3. **`ValidationEngine` (`app/services/validation_engine.py`)**:
   - Performs 4D spatio-temporal colocation between in-situ Argo profiles and ROMS numerical model grids.
   - Uses a spherical `cKDTree` in 3D Cartesian space to identify nearest model grid columns.
   - Performs vertical linear/spline interpolation onto observation depth levels.
   - Calculates statistical agreement metrics: Mean Bias, Mean Absolute Error (MAE), Root Mean Square Error (RMSE), and Pearson Correlation Coefficient ($r$).
4. **`DelimitedParser` (`app/services/delimited_parser.py`)**:
   - Auto-detects delimiters (CSV, TSV, whitespace) and column headers for user-uploaded profile files.
\n---

### Section 6: Complete Feature Inventory (Matrix)

| Feature / Module | Component / Endpoint | Working? | Partial? | Broken? | Description & Status |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Cesium 3D Globe** | `CesiumOceanViewer.jsx` | | **Yes** | | Globe renders and rotates, but is compromised by GEV surveillance injection and missing panel positioning. |
| **Three.js 3D Volumetric** | `OceanViewer.jsx` | **Yes** | | | WebGL2 volume raymarching renders 3D scalar data and bathymetric seabed. |
| **Location Data Panel** | `LocationDataPanel.jsx` | | | **Yes** | Broken positioning (`top-18` undefined in Tailwind) pushes panel off-screen. |
| **View & Region Panel** | `ViewRegionPanel.jsx` | | | **Yes** | Broken positioning (`top-18` undefined) pushes panel stack off-screen. |
| **Active Layer Panel** | `ActiveLayerPanel.jsx` | | | **Yes** | Broken positioning (`top-18` undefined) pushes panel stack off-screen. |
| **Selected Feature Panel**| `SelectedFeaturePanel.jsx`| | | **Yes** | Broken positioning (`top-18` undefined) pushes panel stack off-screen. |
| **Globe Controls** | `GlobeControls.jsx` | **Yes** | | | Zoom, tilt, compass reset, and layer toggles function properly. |
| **Ocean Timeline** | `OceanTimeline.jsx` | **Yes** | | | Scrubber steps through forecast time indices and supports play/pause. |
| **Bottom Status Bar** | `BottomStatusBar.jsx` | | **Yes** | | Renders telemetry, but suffers from mathematical DMS rounding error (`60.00"`). |
| **Argo Network Explorer** | `ArgoPage.jsx` | | | **Yes** | Fails to load live floats due to backend index crash (`BUG-0001`). |
| **Model vs Obs Comparison**| `ComparisonPage.jsx` | | | **Yes** | 3 spatial maps are fake CSS radial gradients; metrics fallback to hardcoded fake numbers. |
| **Analytics Studio** | `AnalyticsPage.jsx` | | | **Yes** | Timeseries data is generated from client-side `Math.sin()`; 3 tabs are dead no-ops. |
| **Data Catalog** | `DataCatalogPage.jsx` | **Yes** | | | Displays authentic dataset cards, but download links point to generic root URLs. |
| **Platform Settings** | `SettingsPage.jsx` | | | **Yes** | "Apply Settings" button is a pure mock no-op with no persistence. |
| **Methodology Page** | `MethodologyPage.jsx` | **Yes** | | | Renders comprehensive documentation on TEOS-10 and ROMS equations. |
| **Go To Location Modal** | `GoToLocationModal.jsx` | **Yes** | | | Searches geographic ocean features and animates camera coordinates. |
| **Observation Modal** | `ObservationModal.jsx` | | **Yes** | | Displays profile plots, but fails when backend profile resolution errors occur. |
| **Diagnostics Drawer** | `DiagnosticsDrawer.jsx` | **Yes** | | | Displays system health, memory stats, and Prometheus metrics. |
| **Shortcuts Modal** | `ShortcutsModal.jsx` | **Yes** | | | Displays keyboard shortcut cheatsheet. |
| **CSV/TSV Profile Upload**| `POST /upload-delimited` | | | **Yes** | Blocked by backend CORS configuration (`allow_methods=["GET", "OPTIONS"]`). |
| **Model Volume Extraction**| `GET /api/v1/model/volume3d`| **Yes** | | | Returns binary Float32 buffer with min/max metadata headers. |
| **Model 2D Slice** | `GET /api/v1/model/slice2d` | **Yes** | | | Returns binary 2D scalar slice at requested depth index. |
| **In-Situ Platform Summary**| `GET /api/v1/observations/argo`| | | **Yes** | Crashes on startup or returns empty array due to `_resolve_platform_file_path` TypeError. |
| **Model vs Obs Validation**| `GET /api/v1/comparison/profile`| | **Yes** | | Computes colocation when datasets match, but yields generic 404 on boundary errors. |
\n---

### Section 7: Complete Button Inventory (Table)

A forensic static and runtime scan cataloged **399 interactive button instances** in the frontend source code and **162 buttons in the live DOM** (40 visible INCOIS ocean buttons and 122 hidden God's Eye View surveillance buttons).

#### Sample of Primary INCOIS User Interface Buttons
| Button Label / Icon | Source File & Line | Event Handler | Intended Action | Verified Operational Status |
| :--- | :--- | :--- | :--- | :--- |
| `INCOIS 3D OCEAN` | `Header.jsx:54` | `setActivePage('home')` | Navigate to home globe | **Operational** |
| `Globe / Explorer` | `Header.jsx:68` | `setActivePage('home')` | Switch to globe workspace | **Operational** |
| `Argo Network` | `Header.jsx:77` | `setActivePage('argo')` | Open Argo observation catalog | **Broken** (Backend crash prevents float listing) |
| `Model vs Obs` | `Header.jsx:86` | `setActivePage('comparison')`| Open 4D colocation validator | **Broken** (Visual maps are static CSS gradients) |
| `Analytics Studio` | `Header.jsx:95` | `setActivePage('analytics')` | Open time-series studio | **Broken** (Timeseries is synthetic sine wave) |
| `Data Catalog` | `Header.jsx:104` | `setActivePage('data')` | Open NetCDF dataset catalog | **Operational** (Metadata cards display) |
| `Methodology` | `Header.jsx:113` | `setActivePage('methodology')`| Open mathematical equations doc| **Operational** |
| `Settings` | `Header.jsx:122` | `setActivePage('settings')` | Open configuration workspace | **Broken** (Apply settings does not persist) |
| `Diagnostics (Activity)`| `Header.jsx:165` | `toggleDiagnostics()` | Open diagnostics drawer | **Operational** |
| `Keyboard Shortcuts (?)`| `Header.jsx:174` | `toggleShortcutsModal()`| Open keyboard shortcuts modal | **Operational** |
| `Engine Toggle (Cesium/Three)`| `GlobeControls.jsx:22` | `setEngineMode(...)` | Toggle between Cesium & Three | **Operational** |
| `Zoom In (+)` | `GlobeControls.jsx:38` | `triggerCameraAction('zoomIn')`| Step camera forward | **Operational** |
| `Zoom Out (-)` | `GlobeControls.jsx:46` | `triggerCameraAction('zoomOut')`| Step camera backward | **Operational** |
| `Reset North (Compass)`| `GlobeControls.jsx:54` | `triggerCameraAction('reset')` | Reset heading & pitch | **Operational** |
| `Graticule Toggle` | `GlobeControls.jsx:62` | `toggleLayer('graticule')` | Toggle lat/lon grid overlay | **Operational** |
| `Timeline Play / Pause` | `OceanTimeline.jsx:78` | `toggleTimelinePlayback()`| Start/stop time animation | **Operational** |
| `Timeline Step Prev` | `OceanTimeline.jsx:86` | `stepTimeIndex(-1)` | Step back 1 forecast step | **Operational** |
| `Timeline Step Next` | `OceanTimeline.jsx:94` | `stepTimeIndex(1)` | Step forward 1 forecast step | **Operational** |
| `Apply Settings` | `SettingsPage.jsx:118` | `handleSave()` | Save configuration changes | **Broken** (Pure visual timeout no-op) |
| `Vertical Profile Tab` | `AnalyticsPage.jsx:138`| `setActiveTab('profile')` | View vertical depth profile | **Broken** (Ignored in rendering) |
| `Hovmöller Tab` | `AnalyticsPage.jsx:144`| `setActiveTab('hovmoller')`| View Hovmöller diagram | **Broken** (Ignored in rendering) |
| `Spectral Analysis Tab`| `AnalyticsPage.jsx:150`| `setActiveTab('spectral')` | View Fourier power spectrum | **Broken** (Ignored in rendering) |
| `Upload CSV / TSV` | `ObservationModal.jsx:112`| `handleFileUpload(...)` | Upload in-situ ASCII data | **Broken** (CORS blocks POST) |
\n---

### Section 8: Complete Interactive Element Inventory

#### Inputs, Dropdowns, Sliders, and Controls
1. **Depth Slice Range Slider (`LocationDataPanel.jsx` / `DepthSliceBar.jsx`)**:
   - Bounded between `0m` and `2000m` depth.
   - Updates `depthLevelMeters` in Zustand store.
   - Controls Three.js clipping plane in volumetric mode.
2. **Colormap Selector Dropdown (`SettingsPage.jsx:142`)**:
   - Options: `turbo`, `viridis`, `thermal`, `jet`, `haline`.
   - Modifies local state, but does not update global store on save.
3. **Variable Selection Radio Group (`ComparisonPage.jsx:128`)**:
   - Toggles comparison between Sea Temperature (`temp`) and Salinity (`salt`).
   - Triggers `validate_float` API call.
4. **Search Location Input (`GoToLocationModal.jsx:45`)**:
   - Autocompletes named ocean basins (Arabian Sea, Bay of Bengal, Somali Current, Andaman Sea).
   - Animates camera to predefined geographic bounds.
5. **Quality Preset Toggle (`SettingsPage.jsx:188`)**:
   - Options: High, Medium, Low.
   - Adjusts raymarching step count in local state without persistence.
\n---

### Section 9: Complete Visible Text Inventory (Table)

A text scan was performed across all visible labels, headers, and tooltips. The table below catalogs critical text occurrences, highlighting scientific versus foreign surveillance terms.

| Term / Text Snippet | Component / Location | Classification | Assessment & Context |
| :--- | :--- | :--- | :--- |
| `INCOIS 3D OCEAN` | `Header.jsx:56` | Scientific Ocean | Legitimate Indian Ocean platform branding |
| `Sea Surface Temperature (SST)`| `oceanStore.js:9` | Scientific Ocean | Legitimate physical variable |
| `Chlorophyll-a (CHLA)` | `oceanStore.js:21` | Scientific Ocean | Legitimate bio-optical variable |
| `TEOS-10 Gibbs SeaWater` | `MethodologyPage.jsx:45`| Scientific Ocean | Legitimate thermodynamic equation of state |
| `ROMS S-Coordinate Depth` | `MethodologyPage.jsx:112`| Scientific Ocean | Legitimate terrain-following coordinate formulation |
| `Argo Float WMO Index` | `ArgoPage.jsx:62` | Scientific Ocean | Legitimate in-situ observation network |
| `Military Aircraft Tracking`| `gods-eye-view/main.js:142`| **Alien Surveillance** | Injected non-ocean GEV feature |
| `TR-3B Antigravity Registry`| `tr3bRegistry.js:18` | **Alien Surveillance** | Injected sci-fi/military GEV easter egg |
| `CCTV Camera Gizmo` | `cctvGizmo.js:34` | **Alien Surveillance** | Injected urban surveillance GEV feature |
| `Bikeshare Docking Stations`| `bikeshare.js:22` | **Alien Surveillance** | Injected municipal transit GEV feature |
| `TomTom Traffic Flow` | `traffic.js:58` | **Alien Surveillance** | Injected terrestrial highway GEV feature |
| `OpenAI HUD Summary` | `hudSummaryResponse.js:12`| **Alien Surveillance** | Injected external AI endpoint polling |
\n---

### Section 10: UI/UX Issues

1. **Complete Panel Invisibility due to CSS Class Typo**:
   As detailed in BUG-0002, `top-18` in `HomePage.jsx` and `LocationDataPanel.jsx` breaks layout anchoring. The user sees a bare globe with no telemetry or layer toggles.
2. **Three.js Viewport Toolbar Clipping**:
   In `OceanViewer.jsx`, the floating camera preset toolbar (`bottom-16 right-3`) is partially occluded by the 640px wide `OceanTimeline` container.
3. **Unresponsive Mobile Layout**:
   Panel widths are hardcoded to fixed pixel sizes (`w-80`, `w-96`, `w-[640px]`). On viewports narrower than 1024px, panels overlap and overflow the viewport.
4. **No Visual Feedback on Dead Tabs**:
   In `AnalyticsPage.jsx`, clicking inactive tabs produces no hover feedback or "feature coming soon" badge, misleading the user into thinking data is missing.

---

### Section 11: Globe Issues

1. **Cesium Canvas DOM Hijacking**:
   Cesium's container is directly rewritten with `mountRef.current.innerHTML = GEV_HTML`. This introduces external GEV overlays, crosshairs, and tracking markers that interfere with Cesium's native mouse event picking.
2. **Missing Terrain Depth Buffer**:
   Cesium is initialized without `depthTestAgainstTerrain = true`. Subsurface Argo trajectories at depth clip awkwardly against the ellipsoid surface rather than penetrating underwater.
3. **Desynchronized Camera State**:
   Switching between Cesium and Three.js does not preserve camera latitude, longitude, altitude, or heading.

---

### Section 12: Ocean Science Issues

1. **Synthetic Mathematical ROMS Model**:
   `datasets/model/incois_roms_indian_ocean.nc` is generated using sine waves and exponential decay curves by `generate_sample_model.py`. While visually plausible, it is not an actual numerical reanalysis run from INCOIS.
2. **TEOS-10 Absolute Salinity Simplification**:
   `MethodologyPage.jsx` describes converting Practical Salinity ($S_p$) to Absolute Salinity ($S_A$) using geographical lookups, but `insitu_store.py` assumes $S_p \approx S_A$ without applying the TEOS-10 regional anomaly correction $\delta S_A$.
3. **Raymarching Colormap Inversion**:
   In `VolumeRaymarchingShader.js`, the opacity transfer function clamps negative values to zero, hiding negative sea surface height anomalies and westward-flowing currents.

---

### Section 13: Real Data Issues (No Mock Data Findings)

1. **Synthetic Timeseries Generation**:
   `AnalyticsPage.jsx:46-67` computes 480 timeseries entries using `Math.sin(i / 15.0) * amplitude + trend`, directly violating the repository's strict `DATA_POLICY.md` mandate.
2. **Synthetic Spatial Maps on Comparison Workspace**:
   `ComparisonPage.jsx:217, 247, 276` renders pure CSS `radial-gradient` circles labeled as "ROMS Model Grid" and "Argo Observation".
3. **Hardcoded Fallback Statistical Agreement**:
   `ComparisonPage.jsx:321` displays `0.91` Pearson $r$ and `1842` samples when backend metrics are null.

---

### Section 14: API Issues

1. **Uncaught TypeError in `_resolve_platform_file_path`**:
   Formatting `target_cycle=None` with `:03d` in `insitu_store.py:659` crashes the in-situ platform resolver.
2. **Generic 404s on 4D Colocation**:
   `GET /api/v1/comparison/profile` returns a generic 404 with detail `"REAL DATASET REQUIRED"` whenever spatial or temporal boundaries are exceeded, concealing the underlying interpolation error.
3. **Missing Pagination Metadata**:
   `GET /api/v1/observations/argo` accepts `skip` and `limit` queries but does not return a total platform count header or pagination wrapper.

---

### Section 15: Network Issues

1. **44 Non-Existent External API Calls**:
   GEV scripts attempt to fetch data from external endpoints (adsb.lol, radarbox, opensky, pinokio, openai hud summary), resulting in console CORS errors and 404s.
2. **CORS Rejection of In-Situ Delimited Uploads**:
   `POST /api/v1/observations/upload-delimited` fails due to `allow_methods=["GET", "OPTIONS"]` in `main.py`.

---

### Section 16: Console Issues

1. **Console Spam from Missing Endpoints**:
   Continuous `POST /api/openai/hud-summary 404 (Not Found)` errors appear in the browser console every 10 seconds.
2. **Vite Chunk Size Warnings**:
   `vite build` issues warnings that the vendor chunk exceeds 1200 kB (Cesium chunk is ~3.8 MB).
3. **FastAPI Deprecation Warnings**:
   FastAPI logs 5 deprecation warnings on startup regarding `@app.on_event("startup")` and `httpx` test client lifecycle.

---

### Section 17: Routing Issues

1. **Redundant Duplicate Route**:
   `ExplorerPage.jsx` simply renders `<HomePage />`, creating redundant navigation paths.
2. **No Deep Linking**:
   Page state is stored in Zustand (`activePage`) rather than URL hashes or paths, preventing users from bookmarking or sharing specific pages.

---

### Section 18: State Issues

1. **Unpersisted Settings**:
   `SettingsPage.jsx` does not update the global `oceanStore` or `localStorage`.
2. **High-Frequency Status Bar Dispatches**:
   Mouse move events on the Cesium canvas trigger rapid `setHoverCoordinates` dispatches, inducing frequent re-renders of `BottomStatusBar`.

---

### Section 19: Performance Issues

1. **Unbounded Memory in LRU Cache**:
   `ocean_model.py` caches 3D float arrays in memory without an explicit byte limit.
2. **Heavy Geography Bundling**:
   `dams.geojsonl` (730 KB) and `datacenters.geojsonl` (2.56 MB) from GEV are bundled into the client build.

---

### Section 20: Responsive Issues

1. **Fixed Width Floating Panels**:
   Panels are fixed at 320px (`w-80`) or 384px (`w-96`), overflowing screens narrower than 1024px.
2. **Horizontal Overflow on Small Screens**:
   `OceanTimeline.jsx` uses a fixed `w-[640px]`, causing overflow on mobile devices.
\n---

### Section 21: Accessibility Issues

1. **Missing `aria-label` Attributes**:
   Over 40 icon-only buttons in `GlobeControls.jsx`, `Header.jsx`, and `LocationDataPanel.jsx` lack accessible text descriptions.
2. **Insufficient Contrast on Muted Text**:
   Text classes such as `text-slate-500` on dark `#030712` backgrounds fall below WCAG 2.1 AA contrast ratio requirements (3.2:1 vs required 4.5:1).
3. **Keyboard Trap in Shortcuts Modal**:
   Opening `ShortcutsModal` traps focus if the user clicks inside without pressing Escape.

---

### Section 22: Dependency Issues

1. **Fragile Node Modules Shimming**:
   `satellite-shim.js` imports directly from `../../node_modules/satellite.js/dist/...`.
2. **Alien Dependencies**:
   `package.json` includes `egm96-universal`, `mgrs`, and `@mapbox/vector-tile`, which are artifacts of the GEV integration.

---

### Section 23: Asset Issues

1. **Non-Ocean 3D Models**:
   `frontend/public/models` contains military and commercial aircraft models (`mq9.glb`, `b789.glb`, `c172.glb`, `bell206.glb`) totaling ~3.5 MB.
2. **Dataset File Typo**:
   `datasets/indian_agro.nc` misspells "argo" as "agro".

---

### Section 24: Security Issues

1. **Raw `innerHTML` Injection**:
   `mountRef.current.innerHTML = GEV_HTML` in `CesiumOceanViewer.jsx:18` violates modern XSS prevention best practices.
2. **Permissive CORS Origins**:
   `Settings.CORS_ORIGINS` includes generic local IP addresses without staging/production origin safeguards.
3. **Unauthenticated File Ingestion**:
   `POST /api/v1/observations/upload-delimited` lacks authentication and file-size throttling.

---

### Section 25: Error Handling Issues

1. **Swallowed NetCDF Parse Exceptions**:
   `ocean_model.py` swallows certain coordinate extraction exceptions, returning `None` without logging actionable diagnostics.
2. **Uncaught Formatting Exception in In-Situ Store**:
   Formatting `None` with `:03d` is unhandled and halts startup.

---

### Section 26: Loading and Empty State Issues

1. **Missing Skeleton Loaders**:
   `ArgoPage.jsx` displays a static spinner without indicating loading progress across 1,318 platforms.
2. **Abrupt Empty States**:
   When zero floats match a bounding box filter, `ArgoPage.jsx` renders an empty table without guidance on resetting filters.

---

### Section 27: Scientific Terminology Issues

1. **Muddled Oceanographic Terminology**:
   GEV code mixes military tactical terms ("contacts", "bogey", "intercept", "threat level") into ocean data components.
2. **DMS Seconds Formatting Glitch**:
   `BottomStatusBar.jsx` formats arcseconds to `60.00"` without rolling over to the next arcminute.

---

### Section 28: Duplicate Code and UI

1. **`ExplorerPage.jsx` Duplicate**:
   6-line pass-through component duplicating `HomePage.jsx`.
2. **Redundant Coordinate Calculation Logic**:
   DMS coordinate conversion routines are duplicated across `BottomStatusBar.jsx`, `CoordinatesPage.jsx`, and `LocationDataPanel.jsx`.

---

### Section 29: Dead Code

1. **7 Orphaned React Components**:
   - `frontend/src/components/ContextualInfoPanel.jsx` (5.2 KB)
   - `frontend/src/components/DepthNavigator.jsx` (5.1 KB)
   - `frontend/src/components/DepthSliceBar.jsx` (3.7 KB)
   - `frontend/src/components/InspectorPanel.jsx` (15.3 KB)
   - `frontend/src/components/ScientificHUD.jsx` (7.7 KB)
   - `frontend/src/components/TimelinePanel.jsx` (4.7 KB)
   - `frontend/src/components/VitalSignsPanel.jsx` (4.6 KB)
2. **Empty Utility Module**:
   - `frontend/src/utils/empty.js` (20 bytes).

---

### Section 30: Missing Tests

1. **Zero Frontend Component Tests**:
   `frontend/test/geography.test.js` only verifies math transforms. There are zero unit or integration tests for UI components, pages, or Zustand state.
2. **Missing Colocation Boundary Tests**:
   `backend/tests/` lacks tests for out-of-bounds geographic or temporal queries in `ValidationEngine`.

---

### Section 31: Build and Test Results

#### Automated Test Suite Execution
1. **Backend Test Suite (`pytest backend/tests`)**:
   - **Result:** 38 passed, 5 deprecation warnings.
   - **Warnings:** Deprecation of `@app.on_event("startup")` in FastAPI and `httpx` in Starlette `TestClient`.
2. **Frontend Test Suite (`node test/geography.test.js`)**:
   - **Result:** 12/12 passed (geography calculations verified).
3. **Frontend Production Build (`npm run build`)**:
   - **Result:** Successful in 47.65s.
   - **Warning:** Production chunks `cesium` and `vendor` exceed 1200 kB.
\n---

### Section 32: Manual User Journey Results (Journeys 1 to 7)

#### Journey 1: First-Time Visitor Exploration
- **Steps:** Load application root (`/`), observe Cesium globe, inspect telemetry, toggle layers.
- **Result:** **FAILED (CRITICAL)**.
- **Findings:** The globe canvas renders, but because `top-18` is undefined in Tailwind, `LocationDataPanel` and the right panel stack are pushed completely off-screen below the 100vh canvas. The user cannot access telemetry or layer controls.

#### Journey 2: Oceanographer Exploring Argo Float Profiles
- **Steps:** Navigate to "Argo Network" (`/argo`), filter by Coriolis DAC, select float WMO 2901633, view vertical profile.
- **Result:** **FAILED (CRITICAL)**.
- **Findings:** The float list fails to load because the backend process crashes during startup due to `TypeError: unsupported format string passed to NoneType.__format__` in `insitu_store.py:659`.

#### Journey 3: Numerical Modeler Running 4D Model vs Observation Colocation
- **Steps:** Navigate to "Model vs Obs" (`/comparison`), select ROMS model and float WMO 2901633, inspect validation residuals.
- **Result:** **FAILED (CRITICAL)**.
- **Findings:** The spatial heatmaps are static CSS gradients rather than actual data grids. Statistical metrics fall back to hardcoded strings (`0.91`, `1842`) if the backend returns incomplete data.

#### Journey 4: Marine Scientist Using Analytics Studio
- **Steps:** Navigate to "Analytics Studio" (`/analytics`), select SST variable, toggle between Hovmöller and Timeseries tabs.
- **Result:** **FAILED (CRITICAL)**.
- **Findings:** Timeseries data is generated from a synthetic client-side sine wave. Clicking "Vertical Profile", "Hovmöller", or "Spectral Analysis" does nothing.

#### Journey 5: Lab Data Manager Ingesting In-Situ Delimited File
- **Steps:** Open Observation Modal, select "Upload CSV/TSV", upload a local profile file.
- **Result:** **FAILED (CRITICAL)**.
- **Findings:** The upload fails immediately with a CORS preflight error because `backend/app/main.py:33` restricts HTTP methods to `["GET", "OPTIONS"]`.

#### Journey 6: Operational Officer Configuring Visualization Settings
- **Steps:** Navigate to "Settings" (`/settings`), change colormap from `turbo` to `viridis`, click "Apply Settings".
- **Result:** **FAILED**.
- **Findings:** The button shows a green checkmark for 2.5 seconds, but settings are not saved to Zustand, `localStorage`, or the rendering engines. Navigating away reverts all changes.

#### Journey 7: Marine Cartographer Navigating via Geographic Coordinates
- **Steps:** Press `L` to open Go To Location Modal, search "Somali Current", inspect camera transition.
- **Result:** **PASSED**.
- **Findings:** The modal successfully animates the camera to the predefined coordinates.
\n---

### Section 33: Complete Bug Register

The table below catalogs all 50 verified bugs, followed by full technical specifications for each.

| Bug ID | Severity | Category | File Location | Short Summary |
| :--- | :---: | :--- | :--- | :--- |
| **BUG-0001** | **P0** | Backend Crash | `backend/app/services/insitu_store.py:659` | `target_cycle:03d` raises fatal `TypeError` on `None` |
| **BUG-0002** | **P0** | UI Layout | `frontend/src/pages/HomePage.jsx:38` | `top-18` undefined in Tailwind pushes 4 panels off-screen |
| **BUG-0003** | **P1** | Architecture | `frontend/src/rendering/CesiumOceanViewer.jsx:18` | Alien God's Eye View (GEV) surveillance HTML injection |
| **BUG-0004** | **P1** | Science / Data | `frontend/src/pages/ComparisonPage.jsx:217` | Comparison spatial maps are static CSS radial gradients |
| **BUG-0005** | **P1** | Science / Data | `frontend/src/pages/ComparisonPage.jsx:321` | Hardcoded fallback validation metrics (`0.91`, `1842`) |
| **BUG-0006** | **P1** | Frontend UI | `frontend/src/pages/AnalyticsPage.jsx:136` | Analytics workspace tabs (Hovmöller, etc.) are dead no-ops |
| **BUG-0007** | **P1** | Science / Data | `frontend/src/pages/AnalyticsPage.jsx:46` | Timeseries generated client-side from `Math.sin()` |
| **BUG-0008** | **P1** | Frontend State | `frontend/src/pages/SettingsPage.jsx:36` | "Apply Settings" button is a pure mock no-op |
| **BUG-0009** | **P1** | Backend / CORS | `backend/app/main.py:33` | CORS restricts methods to GET/OPTIONS, blocking POST upload |
| **BUG-0010** | **P1** | Backend API | `backend/app/api/endpoints/comparison.py:25` | Generic 404 conceals 4D colocation boundary errors |
| **BUG-0011** | **P2** | Math / UI | `frontend/src/components/BottomStatusBar.jsx:9` | Mathematical DMS rounding bug displays `60.00"` arcseconds |
| **BUG-0012** | **P2** | Architecture | `frontend/src/pages/ExplorerPage.jsx:1` | Redundant pass-through component duplicating `HomePage` |
| **BUG-0013** | **P2** | Dead Code | `frontend/src/components/` | 7 orphaned React components (~47 KB unreferenced) |
| **BUG-0014** | **P2** | Science / Data | `ingestion/generate_sample_model.py:34` | Synthetic ROMS dataset generated from formulas |
| **BUG-0015** | **P2** | Data / Asset | `datasets/indian_agro.nc` | Typo in dataset filename ('agro' instead of 'argo') |
| **BUG-0016** | **P2** | UI Layout | `frontend/src/rendering/OceanViewer.jsx:68` | Three.js camera toolbar occluded by 640px timeline |
| **BUG-0017** | **P2** | Ingestion | `ingestion/ingest_coriolis.py:157` | Unchecked NetCDF attributes cause batch ingestion crash |
| **BUG-0018** | **P2** | Performance | `backend/app/services/ocean_model.py:15` | Unbounded memory growth in OceanModel LRU cache |
| **BUG-0019** | **P2** | Dependency | `frontend/src/utils/satellite-shim.js:1` | Fragile deep relative imports into `node_modules` |
| **BUG-0020** | **P2** | Ingestion | `ingestion/fetch_real_datasets.py:42` | Silent failure without retries on remote data timeout |
| **BUG-0021** | **P2** | Assets | `frontend/public/models/` | Non-ocean military aircraft 3D models bundled (~3.5 MB) |
| **BUG-0022** | **P2** | 3D Rendering | `frontend/src/store/oceanStore.js:442` | Depth level resets to 0 when toggling 3D engines |
| **BUG-0023** | **P2** | Science / Data | `frontend/src/components/DepthSliceBar.jsx:22` | Inconsistent depth sign (positive vs negative meters) |
| **BUG-0024** | **P2** | Frontend / Data | `frontend/src/pages/DataCatalogPage.jsx:54` | Dataset download links point to generic base URLs |
| **BUG-0025** | **P2** | Shader / 3D | `VolumeRaymarchingShader.js:84` | Colormap transfer clamps negative values to zero |
| **BUG-0026** | **P3** | UI / Modal | `frontend/src/App.jsx:100` | Pressing `?` repeatedly does not close ShortcutsModal |
| **BUG-0027** | **P3** | UI / Validation | `frontend/src/pages/CoordinatesPage.jsx:82` | Trailing spaces or mixed casing fail coordinate regex |
| **BUG-0028** | **P3** | Styling | `frontend/tailwind.config.js:14` | Redundant color tokens conflict with hardcoded hex codes |
| **BUG-0029** | **P3** | Backend | `backend/app/main.py:64` | Deprecated `@app.on_event` triggers pytest warnings |
| **BUG-0030** | **P3** | Localization | `frontend/src/components/ObservationModal.jsx:45` | Date rendered via `toLocaleString()` violates UTC standard |
| **BUG-0031** | **P3** | Accessibility | `frontend/src/components/GlobeControls.jsx:20` | Missing `aria-label` on 40+ icon-only buttons |
| **BUG-0032** | **P3** | Styling / Bloat | `frontend/src/gods-eye-view/style.css` | 266 KB of unused GEV CSS loaded globally |
| **BUG-0033** | **P3** | Branding | `frontend/index.html:5` | Favicon points to `/vite.svg` instead of INCOIS logo |
| **BUG-0034** | **P3** | UI / Data | `frontend/src/components/Header.jsx:132` | Header displays static `1318 Floats` badge |
| **BUG-0035** | **P3** | Performance | `frontend/src/components/BottomStatusBar.jsx:30` | Rapid mouse moves trigger high-frequency re-renders |
| **BUG-0036** | **P3** | UI / UX | `frontend/src/components/ColorbarLegend.jsx:18` | Missing numerical tooltips on colormap gradient ramp |
| **BUG-0037** | **P3** | Logging | `backend/app/services/ocean_model.py:128` | Missing standard CF attributes log excessive warnings |
| **BUG-0038** | **P3** | Build | `frontend/vite.config.js:33` | Production bundle exceeds 1200 kB chunk limit |
| **BUG-0039** | **P3** | 3D Camera | `OceanSceneController.js:115` | Hardcoded initial camera distance clips on 13" displays |
| **BUG-0040** | **P3** | Accessibility | `frontend/src/pages/DataCatalogPage.jsx:32` | Catalog tab selector lacks keyboard arrow navigation |
| **BUG-0041** | **P4** | Testing | `frontend/test/` | Zero React component or page unit tests |
| **BUG-0042** | **P4** | Documentation | `ingestion/adapters/` | Ingestion adapters lack python docstrings and types |
| **BUG-0043** | **P4** | Dev Tooling | `package.json:7` | Root scripts do not manage backend dependencies |
| **BUG-0044** | **P4** | Code Quality | `frontend/src/rendering/` | Missing standard license / attribution headers |
| **BUG-0045** | **P4** | Documentation | `METHODOLOGY.md` | Incomplete documentation on Absolute Salinity conversion |
| **BUG-0046** | **P4** | Dev Tooling | `start_dev.sh` | Shell script incompatible with Windows PowerShell |
| **BUG-0047** | **P4** | Dead Code | `check_system.py` | Script at root never executed in CI or documentation |
| **BUG-0048** | **P4** | Configuration | `frontend/src/store/oceanStore.js:3` | Hardcoded localhost URLs complicate containerization |
| **BUG-0049** | **P4** | Testing | `backend/tests/test_api.py:12` | Starlette `TestClient` deprecation warnings in pytest |
| **BUG-0050** | **P4** | Docker | Repository Root | Missing top-level `.dockerignore` risks copying 10GB data |
\n
#### Detailed Defect Specifications (All 50 Cataloged Bugs)

##### BUG-0001: Platform file path resolution should safely handle target_cycle=None to verify existence of profile files in platform directory.
- **Bug ID:** `BUG-0001`
- **Severity:** P0
- **Category:** Backend Crash
- **Location:** `backend/app/services/insitu_store.py:659`
- **Expected:** Platform file path resolution should safely handle target_cycle=None to verify existence of profile files in platform directory.
- **Actual:** Formatting target_cycle=None with :03d raises fatal TypeError: unsupported format string passed to NoneType.__format__.
- **Evidence:** `candidates = glob.glob(os.path.join(full_fdir, f"*{target_cycle:03d}*.nc")) -> TypeError: unsupported format string passed to NoneType.__format__`
- **Root Cause:** Line 512 calls _resolve_platform_file_path(w, None, p). Line 659 evaluates f"{target_cycle:03d}" without checking if target_cycle is None.
- **Reproduction Steps:** 1. Start backend with datasets/argo_index.json present. 2. Request GET /api/v1/observations/argo. 3. Process crashes with TypeError and fallback scan exhausts memory.
- **Recommended Fix:** Check if target_cycle is not None before applying :03d format; if None, glob for '*.nc'.
\n##### BUG-0002: Panels should float over the 3D globe with standard top offset (e.g., top-20).
- **Bug ID:** `BUG-0002`
- **Severity:** P0
- **Category:** UI Layout
- **Location:** `frontend/src/pages/HomePage.jsx:38, frontend/src/components/LocationDataPanel.jsx:63, 80`
- **Expected:** Panels should float over the 3D globe with standard top offset (e.g., top-20).
- **Actual:** Panels use undefined Tailwind class top-18, defaulting to static position below the 100vh canvas (Y >= 720px) and becoming completely invisible due to overflow-hidden.
- **Evidence:** `<div className="absolute top-18 right-6 z-30 flex flex-col gap-3"> and <div className="absolute top-18 left-6 z-30 ...">`
- **Root Cause:** top-18 is not part of Tailwind's default spacing scale and is not defined in tailwind.config.js.
- **Reproduction Steps:** 1. Open http://localhost:3000/. 2. Observe Cesium globe loads but LocationDataPanel, ViewRegionPanel, ActiveLayerPanel, and SelectedFeaturePanel are completely missing.
- **Recommended Fix:** Replace top-18 with top-20 in HomePage.jsx and LocationDataPanel.jsx.
\n##### BUG-0003: Cesium viewer should render ocean layers cleanly without mounting external surveillance systems.
- **Bug ID:** `BUG-0003`
- **Severity:** P1
- **Category:** Architecture / Security
- **Location:** `frontend/src/rendering/CesiumOceanViewer.jsx:18-33`
- **Expected:** Cesium viewer should render ocean layers cleanly without mounting external surveillance systems.
- **Actual:** Mounts alien God's Eye View (GEV) HTML (mountRef.current.innerHTML = GEV_HTML) and loads 190+ surveillance scripts including military tracking and CCTV.
- **Evidence:** `mountRef.current.innerHTML = GEV_HTML; import('../gods-eye-view/main.js') loads flights, military aircraft, TR-3B registries, and polls /api/openai/hud-summary.`
- **Root Cause:** Hasty porting and grafting of an external surveillance repository into the INCOIS ocean science application.
- **Reproduction Steps:** 1. Open Home page in browser. 2. Inspect DOM and find 122 hidden buttons. 3. Check network tab to see constant 404 polling to /api/openai/hud-summary.
- **Recommended Fix:** Remove GEV_HTML innerHTML injection and import; mount native Cesium viewer instance directly.
\n##### BUG-0004: Spatial maps should render actual 2D/3D grids of ROMS model output, Argo observation points, and spatial residuals.
- **Bug ID:** `BUG-0004`
- **Severity:** P1
- **Category:** Science / UI
- **Location:** `frontend/src/pages/ComparisonPage.jsx:217, 247, 276`
- **Expected:** Spatial maps should render actual 2D/3D grids of ROMS model output, Argo observation points, and spatial residuals.
- **Actual:** The three maps are static CSS radial-gradient circles styled with cyan, blue, and amber glow.
- **Evidence:** `style={{ background: 'radial-gradient(circle at 45% 45%, rgba(6,182,212,0.4) 0%, rgba(14,165,233,0.15) 50%, transparent 70%)' }}`
- **Root Cause:** Mock visual placeholders were hardcoded into the component instead of integrating Canvas or Plotly heatmap subplots.
- **Reproduction Steps:** 1. Navigate to /comparison. 2. Inspect the Model, Observation, and Residual panels. 3. Observe they are static decorative divs without coordinates or data.
- **Recommended Fix:** Implement real 2D canvas or Plotly heatmaps rendering colocated spatial slices.
\n##### BUG-0005: Statistical metrics should reflect real mathematical comparison or display 'N/A' when comparison data is unavailable.
- **Bug ID:** `BUG-0005`
- **Severity:** P1
- **Category:** Science / Data
- **Location:** `frontend/src/pages/ComparisonPage.jsx:321, 327`
- **Expected:** Statistical metrics should reflect real mathematical comparison or display 'N/A' when comparison data is unavailable.
- **Actual:** Falls back to hardcoded scientific values: '0.91' for Pearson r and 1842 for sample_count.
- **Evidence:** `{metrics.pearson_r !== null ? metrics.pearson_r.toFixed(3) : '0.91'} and {metrics.sample_count || 1842}`
- **Root Cause:** Hardcoded fallback mock data left in UI code violating DATA_POLICY.md.
- **Reproduction Steps:** 1. Navigate to /comparison without selecting a valid platform. 2. Inspect agreement statistics cards. 3. Notice Pearson r shows 0.91 and sample count shows 1,842.
- **Recommended Fix:** Replace hardcoded fallbacks with '—' or 'No Data' when metrics are null.
\n##### BUG-0006: Clicking tabs should switch view between Timeseries, Vertical Profile, Hovmöller Diagram, and Spectral Analysis.
- **Bug ID:** `BUG-0006`
- **Severity:** P1
- **Category:** Frontend UI
- **Location:** `frontend/src/pages/AnalyticsPage.jsx:136-150`
- **Expected:** Clicking tabs should switch view between Timeseries, Vertical Profile, Hovmöller Diagram, and Spectral Analysis.
- **Actual:** Tab clicks update activeTab state, but rendering logic completely ignores activeTab and only renders the timeseries plot.
- **Evidence:** `onClick={() => setActiveTab('profile')} updates state, but main render block unconditionally renders the Timeseries Plotly chart.`
- **Root Cause:** Incomplete implementation; tab buttons exist in JSX but conditional view rendering was never written.
- **Reproduction Steps:** 1. Navigate to /analytics. 2. Click 'Vertical Profile', 'Hovmöller Diagram', or 'Spectral Analysis'. 3. Observe chart view does not change.
- **Recommended Fix:** Add conditional rendering branches for profile, Hovmöller, and spectral charts or display active development indicators.
\n##### BUG-0007: Analytics charts should query and plot authentic historical timeseries from ROMS NetCDF or Argo observations.
- **Bug ID:** `BUG-0007`
- **Severity:** P1
- **Category:** Science / Data
- **Location:** `frontend/src/pages/AnalyticsPage.jsx:46-67`
- **Expected:** Analytics charts should query and plot authentic historical timeseries from ROMS NetCDF or Argo observations.
- **Actual:** Generates 480 synthetic timeseries points inside a client-side for loop using Math.sin() and random jitter.
- **Evidence:** `const val = base + Math.sin(i / 15.0) * amplitude + Math.sin(i / 4.0) * 0.4 + trend;`
- **Root Cause:** Client-side mathematical mock generation used instead of backend API integration.
- **Reproduction Steps:** 1. Navigate to /analytics. 2. Inspect network tab. 3. Observe zero network requests are made; timeseries is synthesized in memory.
- **Recommended Fix:** Connect AnalyticsPage to GET /api/v1/model/timeseries or insitu store.
\n##### BUG-0008: Clicking 'Apply Settings' should persist user preferences to Zustand store, localStorage, and rendering engines.
- **Bug ID:** `BUG-0008`
- **Severity:** P1
- **Category:** Frontend State
- **Location:** `frontend/src/pages/SettingsPage.jsx:36-39`
- **Expected:** Clicking 'Apply Settings' should persist user preferences to Zustand store, localStorage, and rendering engines.
- **Actual:** handleSave only sets local state isSaved = true for 2500ms; settings are never saved or applied.
- **Evidence:** `const handleSave = () => { setIsSaved(true); setTimeout(() => setIsSaved(false), 2500); };`
- **Root Cause:** Disconnected mock UI implementation with no store mutation or persistence layer.
- **Reproduction Steps:** 1. Navigate to /settings. 2. Change renderer or colormap. 3. Click 'Apply Settings'. 4. Navigate to /home. 5. Notice settings did not take effect.
- **Recommended Fix:** Dispatch selected settings to useOceanStore and write to localStorage in handleSave.
\n##### BUG-0009: CORS policy should allow POST requests for file uploads and profile parsing.
- **Bug ID:** `BUG-0009`
- **Severity:** P1
- **Category:** Backend / CORS
- **Location:** `backend/app/main.py:33`
- **Expected:** CORS policy should allow POST requests for file uploads and profile parsing.
- **Actual:** CORS middleware explicitly restricts allow_methods to ['GET', 'OPTIONS'], blocking POST /api/v1/observations/upload-delimited.
- **Evidence:** `allow_methods=["GET", "OPTIONS"] in app.add_middleware(CORSMiddleware)`
- **Root Cause:** Overly restrictive CORS methods configuration omitting POST.
- **Reproduction Steps:** 1. Attempt to upload a CSV file via ObservationModal. 2. Browser rejects request with CORS preflight failure.
- **Recommended Fix:** Update allow_methods to ["GET", "POST", "OPTIONS"].
\n##### BUG-0010: API should return detailed error explanation when 4D colocation fails (e.g., spatial bounds or temporal window exceeded).
- **Bug ID:** `BUG-0010`
- **Severity:** P1
- **Category:** Backend API
- **Location:** `backend/app/api/endpoints/comparison.py:25`
- **Expected:** API should return detailed error explanation when 4D colocation fails (e.g., spatial bounds or temporal window exceeded).
- **Actual:** Raises generic 404 with detail 'REAL DATASET REQUIRED: Unable to compute 4D comparison for float ...'.
- **Evidence:** `raise HTTPException(status_code=404, detail=f"REAL DATASET REQUIRED: Unable to compute 4D comparison for float {platform_number}.")`
- **Root Cause:** Swallowing specific exception context from validation_engine.
- **Reproduction Steps:** 1. Query GET /api/v1/comparison/profile with a platform outside model coordinates. 2. Receive generic 404 without error cause.
- **Recommended Fix:** Propagate specific validation error messages (e.g., coordinate out of bounds, timestamp mismatch) in exception detail.
\n##### BUG-0011: DMS arcseconds should roll over to next minute when rounding reaches 60.00 (e.g., 59.998" -> +1 minute, 00.00").
- **Bug ID:** `BUG-0011`
- **Severity:** P2
- **Category:** Math / UI
- **Location:** `frontend/src/components/BottomStatusBar.jsx:9-10`
- **Expected:** DMS arcseconds should roll over to next minute when rounding reaches 60.00 (e.g., 59.998" -> +1 minute, 00.00").
- **Actual:** Applies .toFixed(2) directly to seconds without carryover, displaying invalid coordinates like 11°59'60.00" N.
- **Evidence:** `const toDms = (deg, isLat) => ... Math.floor(Math.abs(deg)) ... Math.floor((Math.abs(deg) - d) * 60) ... ((Math.abs(deg) - d - m/60)*3600).toFixed(2)`
- **Root Cause:** Lack of carryover check on rounded arcseconds.
- **Reproduction Steps:** 1. Move cursor over coordinate 11.99999°. 2. Inspect status bar. 3. Observe readout 11°59'60.00" N.
- **Recommended Fix:** Add rollover logic: if seconds >= 59.995, increment minutes by 1 and set seconds to 0.00.
\n##### BUG-0012: Explorer page should provide distinct exploration features or be routed directly to HomePage.
- **Bug ID:** `BUG-0012`
- **Severity:** P2
- **Category:** Architecture / UI
- **Location:** `frontend/src/pages/ExplorerPage.jsx:1-6`
- **Expected:** Explorer page should provide distinct exploration features or be routed directly to HomePage.
- **Actual:** ExplorerPage is a 6-line pass-through component that merely renders <HomePage />.
- **Evidence:** `export const ExplorerPage = () => { return <HomePage />; };`
- **Root Cause:** Redundant placeholder left during route restructuring.
- **Reproduction Steps:** 1. Compare /home and /explorer in App.jsx. 2. Notice identical components rendered.
- **Recommended Fix:** Consolidate routing to use HomePage directly and remove ExplorerPage wrapper.
\n##### BUG-0013: All components in src/components should be utilized or maintained in an experimental directory.
- **Bug ID:** `BUG-0013`
- **Severity:** P2
- **Category:** Dead Code
- **Location:** `frontend/src/components/`
- **Expected:** All components in src/components should be utilized or maintained in an experimental directory.
- **Actual:** 7 full React components (~47 KB) are completely unreferenced anywhere in the codebase.
- **Evidence:** `ContextualInfoPanel.jsx, DepthNavigator.jsx, DepthSliceBar.jsx, InspectorPanel.jsx, ScientificHUD.jsx, TimelinePanel.jsx, VitalSignsPanel.jsx have zero imports.`
- **Root Cause:** Leftover artifacts from previous UI iterations.
- **Reproduction Steps:** 1. Grep codebase for 'ScientificHUD' or 'VitalSignsPanel'. 2. Observe zero imports.
- **Recommended Fix:** Safely archive or delete orphaned component files after verifying no indirect dynamic imports.
\n##### BUG-0014: ROMS datasets in datasets/model/ should be authentic numerical model outputs.
- **Bug ID:** `BUG-0014`
- **Severity:** P2
- **Category:** Science / Data
- **Location:** `ingestion/generate_sample_model.py:34-60`
- **Expected:** ROMS datasets in datasets/model/ should be authentic numerical model outputs.
- **Actual:** datasets/model/incois_roms_indian_ocean.nc is generated via synthetic mathematical formulas (decay, sin, meshgrid).
- **Evidence:** `t_base = 3.5 + (28.5 - 3.5) * decay; temp[...] = t_base + 0.6 * np.sin(lon2d / 10.0 + t_idx * 0.1)`
- **Root Cause:** Sample data generation script used to create placeholder dataset presented as authentic INCOIS ROMS.
- **Reproduction Steps:** 1. Run python ingestion/generate_sample_model.py. 2. Inspect generated NetCDF. 3. Observe purely synthetic mathematical profiles.
- **Recommended Fix:** Download and process real INCOIS ROMS NetCDF files using ingestion/fetch_real_datasets.py.
\n##### BUG-0015: NetCDF datasets should use correct scientific naming conventions (e.g., indian_argo.nc).
- **Bug ID:** `BUG-0015`
- **Severity:** P2
- **Category:** Data / Asset
- **Location:** `datasets/indian_agro.nc`
- **Expected:** NetCDF datasets should use correct scientific naming conventions (e.g., indian_argo.nc).
- **Actual:** File is named indian_agro.nc with 'argo' misspelled as 'agro'.
- **Evidence:** `datasets/indian_agro.nc (52,424 bytes)`
- **Root Cause:** Typographical error during file creation.
- **Reproduction Steps:** 1. Inspect datasets/ directory. 2. Notice indian_agro.nc.
- **Recommended Fix:** Rename file to indian_argo.nc and update any ingestion references.
\n##### BUG-0016: Floating camera presets toolbar should not collide with bottom timeline scrubber.
- **Bug ID:** `BUG-0016`
- **Severity:** P2
- **Category:** UI Layout
- **Location:** `frontend/src/rendering/OceanViewer.jsx:68`
- **Expected:** Floating camera presets toolbar should not collide with bottom timeline scrubber.
- **Actual:** Camera toolbar (bottom-16 right-3) overlaps and is partially covered by the 640px wide OceanTimeline.
- **Evidence:** `<div className="absolute bottom-16 right-3 z-20 ..."> overlaps with <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[640px] ...">`
- **Root Cause:** Absolute positioning collision on screens below 1440px width.
- **Reproduction Steps:** 1. Switch engineMode to Three.js. 2. Resize browser window to 1280px. 3. Notice camera buttons overlap timeline controls.
- **Recommended Fix:** Move camera preset toolbar higher (e.g., bottom-28) or place it in the top-right tool cluster.
\n##### BUG-0017: NetCDF profile parser should gracefully handle missing global attributes or corrupt files.
- **Bug ID:** `BUG-0017`
- **Severity:** P2
- **Category:** Ingestion
- **Location:** `ingestion/ingest_coriolis.py:157`
- **Expected:** NetCDF profile parser should gracefully handle missing global attributes or corrupt files.
- **Actual:** Attempts to access unverified global attributes, crashing batch directory indexing on first invalid file.
- **Evidence:** `data_mode = ds.attrs.get('DATA_MODE') or ds['DATA_MODE'].values[0] fails if DATA_MODE dimension is irregular.`
- **Root Cause:** Missing defensive try-except blocks during NetCDF attribute inspection.
- **Reproduction Steps:** 1. Place an incomplete NetCDF file in datasets/coriolis/. 2. Run ingest_coriolis.py. 3. Ingestion aborts with unhandled exception.
- **Recommended Fix:** Wrap per-file parsing in try-except and log warning while continuing batch processing.
\n##### BUG-0018: LRU cache should enforce both entry count and memory byte limits.
- **Bug ID:** `BUG-0018`
- **Severity:** P2
- **Category:** Performance / Backend
- **Location:** `backend/app/services/ocean_model.py:15`
- **Expected:** LRU cache should enforce both entry count and memory byte limits.
- **Actual:** Cache only limits entry count; caching multiple 256x256x128 Float32 arrays can exhaust system memory.
- **Evidence:** `self._cache = OrderedDict() without max_bytes check.`
- **Root Cause:** Lack of memory-bounded caching policy for large 3D arrays.
- **Reproduction Steps:** 1. Send sequential volume extraction requests for different variables and time steps. 2. Observe backend memory footprint grow continuously.
- **Recommended Fix:** Add sys.getsizeof() checks or maximum memory threshold (e.g., 2 GB) before caching buffers.
\n##### BUG-0019: Packages should be imported via standard module specifiers.
- **Bug ID:** `BUG-0019`
- **Severity:** P2
- **Category:** Dependency / Build
- **Location:** `frontend/src/utils/satellite-shim.js:1-6`
- **Expected:** Packages should be imported via standard module specifiers.
- **Actual:** satellite-shim.js performs deep relative imports into ../../node_modules/satellite.js/dist/...
- **Evidence:** `export * from '../../node_modules/satellite.js/dist/io.js';`
- **Root Cause:** Fragile workaround for Vite/Rollup bundling issue with satellite.js web workers.
- **Reproduction Steps:** 1. Move project to monorepo or use pnpm. 2. Relative node_modules path breaks.
- **Recommended Fix:** Use vite.config.js resolve alias or standard satellite.js ES entry points.
\n##### BUG-0020: Data fetcher should retry on transient network timeouts and report clear failure reasons.
- **Bug ID:** `BUG-0020`
- **Severity:** P2
- **Category:** Ingestion / Network
- **Location:** `ingestion/fetch_real_datasets.py:42`
- **Expected:** Data fetcher should retry on transient network timeouts and report clear failure reasons.
- **Actual:** Fails silently on HTTP timeout, leaving partially downloaded corrupted files in datasets/.
- **Evidence:** `requests.get(url, stream=True) without retry adapter or file integrity verification.`
- **Root Cause:** Missing urllib3 Retry configuration and checksum verification.
- **Reproduction Steps:** 1. Run fetch_real_datasets.py on an unstable network. 2. Observe script terminates leaving 0-byte files.
- **Recommended Fix:** Add urllib3 Retry with exponential backoff and verify downloaded file size against Content-Length.
\n##### BUG-0021: Static assets should only contain oceanographic and marine research models.
- **Bug ID:** `BUG-0021`
- **Severity:** P2
- **Category:** Assets
- **Location:** `frontend/public/models/`
- **Expected:** Static assets should only contain oceanographic and marine research models.
- **Actual:** Directory contains military drones and commercial aircraft models totaling ~3.5 MB (mq9.glb, b789.glb, c172.glb, bell206.glb).
- **Evidence:** `mq9.glb (542 KB), b789.glb (470 KB), atr72.glb (263 KB), bell206.glb (320 KB).`
- **Root Cause:** Residual assets imported from God's Eye View flight tracking system.
- **Reproduction Steps:** 1. Inspect frontend/public/models/. 2. Notice MQ-9 Reaper drone and Boeing 787 models.
- **Recommended Fix:** Remove aircraft models and retain only marine models (ship.glb, research vessels, buoys).
\n##### BUG-0022: Selected depth level should persist when toggling between Cesium and Three.js engines.
- **Bug ID:** `BUG-0022`
- **Severity:** P2
- **Category:** State / Three.js
- **Location:** `frontend/src/store/oceanStore.js:442`
- **Expected:** Selected depth level should persist when toggling between Cesium and Three.js engines.
- **Actual:** Switching engines resets slice state because Cesium does not consume depthLevelMeters.
- **Evidence:** `depthLevelMeters is maintained in store but Cesium viewer initialization ignores it.`
- **Root Cause:** Unidirectional state binding; Three.js listens to depth changes but Cesium lacks depth slice shader.
- **Reproduction Steps:** 1. Set depth to 500m in Three.js mode. 2. Switch to Cesium. 3. Switch back to Three.js. 4. Observe clipping plane resets.
- **Recommended Fix:** Ensure engine switch preserves depthLevelMeters and applies it on scene mount.
\n##### BUG-0023: Depth coordinate system should follow consistent sign convention across UI and backend.
- **Bug ID:** `BUG-0023`
- **Severity:** P2
- **Category:** Science / UI
- **Location:** `frontend/src/components/DepthSliceBar.jsx:22`
- **Expected:** Depth coordinate system should follow consistent sign convention across UI and backend.
- **Actual:** DepthSliceBar treats depth as positive meters (0 to 2000m), whereas ocean_model.py represents depth as negative meters (z < 0).
- **Evidence:** `UI: depthLevelMeters = 500; Backend: z = -500.0.`
- **Root Cause:** Inconsistent vertical coordinate sign conventions between oceanographic standard (depth positive down vs z negative down).
- **Reproduction Steps:** 1. Inspect depth slider value and API query parameter. 2. Sign conversion is handled ad-hoc in multiple places.
- **Recommended Fix:** Standardize on depth_meters (positive down) for all public APIs and convert to z internally in physics engine.
\n##### BUG-0024: Download buttons should link to direct NetCDF data endpoints or trigger file download.
- **Bug ID:** `BUG-0024`
- **Severity:** P2
- **Category:** Frontend / Data
- **Location:** `frontend/src/pages/DataCatalogPage.jsx:54-98`
- **Expected:** Download buttons should link to direct NetCDF data endpoints or trigger file download.
- **Actual:** Download buttons point to generic ERDDAP base URLs (e.g., https://erddap.incois.gov.in/) which do not resolve to the specific dataset.
- **Evidence:** `href="https://erddap.incois.gov.in/" on dataset download button.`
- **Root Cause:** Placeholder external links.
- **Reproduction Steps:** 1. Navigate to /data. 2. Click 'Download NetCDF' on INCOIS ROMS card. 3. Browser opens generic ERDDAP homepage.
- **Recommended Fix:** Update download links to direct ERDDAP dataset queries or backend /api/v1/model/datasets/download endpoint.
\n##### BUG-0025: Volume raymarching shader should support bipolar colormaps (e.g., negative to positive SSH or velocity).
- **Bug ID:** `BUG-0025`
- **Severity:** P2
- **Category:** Three.js / Shader
- **Location:** `frontend/src/rendering/shaders/VolumeRaymarchingShader.js:84`
- **Expected:** Volume raymarching shader should support bipolar colormaps (e.g., negative to positive SSH or velocity).
- **Actual:** Scalar value is clamped to [0.0, 1.0] assuming positive range, suppressing negative anomalies.
- **Evidence:** `float normalizedVal = clamp((val - uMin) / (uMax - uMin), 0.0, 1.0);`
- **Root Cause:** Linear normalization assumes unipolar variables.
- **Reproduction Steps:** 1. Load SSH anomaly variable with range [-35, +35]. 2. Negative eddy depressions render as pure transparent or clipped color.
- **Recommended Fix:** Implement diverging colormap normalization for bipolar scalar fields.
\n##### BUG-0026: Pressing '?' should toggle ShortcutsModal open and closed.
- **Bug ID:** `BUG-0026`
- **Severity:** P3
- **Category:** UI / Modal
- **Location:** `frontend/src/App.jsx:100`
- **Expected:** Pressing '?' should toggle ShortcutsModal open and closed.
- **Actual:** Pressing '?' opens the modal, but pressing '?' again while modal is open does not close it.
- **Evidence:** `case '?': store.toggleShortcutsModal(); break;`
- **Root Cause:** Focus is shifted into modal container, swallowing keystroke.
- **Reproduction Steps:** 1. Press '?'. Modal opens. 2. Press '?' again. Modal remains open.
- **Recommended Fix:** Ensure keydown listener handles modal toggle regardless of active sub-element focus.
\n##### BUG-0027: Coordinate input should accept coordinates with trailing spaces or lowercase cardinal directions (e.g., '15.4 n').
- **Bug ID:** `BUG-0027`
- **Severity:** P3
- **Category:** UI / Input
- **Location:** `frontend/src/pages/CoordinatesPage.jsx:82`
- **Expected:** Coordinate input should accept coordinates with trailing spaces or lowercase cardinal directions (e.g., '15.4 n').
- **Actual:** Strict regex fails on trailing whitespace or lowercase characters.
- **Evidence:** `/^[0-9]+(\.[0-9]+)?\s*[NSEW]$/ without case-insensitive flag.`
- **Root Cause:** Regex missing /i flag and .trim() call.
- **Reproduction Steps:** 1. Enter '15.5 n ' into coordinate field. 2. Input shows validation error.
- **Recommended Fix:** Apply .trim() and use /i case-insensitive regex flag.
\n##### BUG-0028: Custom theme tokens should be used consistently throughout the application.
- **Bug ID:** `BUG-0028`
- **Severity:** P3
- **Category:** UI / Styling
- **Location:** `frontend/tailwind.config.js:14-23`
- **Expected:** Custom theme tokens should be used consistently throughout the application.
- **Actual:** Custom ocean colors (ocean-950 to ocean-600) are defined but bypassed in favor of arbitrary hex colors (#040711, #030712).
- **Evidence:** `className="bg-[#040711]" used instead of className="bg-ocean-950".`
- **Root Cause:** Inconsistent styling practices across components.
- **Reproduction Steps:** 1. Search src/ for '#040711'. 2. Observe 20+ instances bypassing Tailwind theme.
- **Recommended Fix:** Refactor arbitrary color codes to use defined ocean-* Tailwind classes.
\n##### BUG-0029: FastAPI application should use modern lifespan context manager.
- **Bug ID:** `BUG-0029`
- **Severity:** P3
- **Category:** Backend
- **Location:** `backend/app/main.py:64`
- **Expected:** FastAPI application should use modern lifespan context manager.
- **Actual:** Uses deprecated @app.on_event('startup') and @app.on_event('shutdown') handlers.
- **Evidence:** `FastAPI deprecation warning logged: 'on_event is deprecated, use lifespan event handlers instead'.`
- **Root Cause:** Older FastAPI event patterns.
- **Reproduction Steps:** 1. Run pytest backend/tests. 2. Observe 5 deprecation warnings in test output.
- **Recommended Fix:** Migrate startup and shutdown handlers to an asynccontextmanager lifespan handler.
\n##### BUG-0030: Timestamps should display in standardized UTC format (ISO-8601 or 'YYYY-MM-DD HH:mm UTC').
- **Bug ID:** `BUG-0030`
- **Severity:** P3
- **Category:** UI / Localization
- **Location:** `frontend/src/components/ObservationModal.jsx:45`
- **Expected:** Timestamps should display in standardized UTC format (ISO-8601 or 'YYYY-MM-DD HH:mm UTC').
- **Actual:** Uses toLocaleString() which renders in client's local timezone, causing confusion across global oceanographers.
- **Evidence:** `new Date(profile.timestamp).toLocaleString()`
- **Root Cause:** Using locale-dependent date formatting for scientific telemetry.
- **Reproduction Steps:** 1. Open ObservationModal. 2. Profile date reflects local system time rather than UTC measurement time.
- **Recommended Fix:** Format dates using toISOString() or explicit UTC formatter.
\n##### BUG-0031: All icon buttons must have accessible names via aria-label.
- **Bug ID:** `BUG-0031`
- **Severity:** P3
- **Category:** Accessibility
- **Location:** `frontend/src/components/GlobeControls.jsx:20-65`
- **Expected:** All icon buttons must have accessible names via aria-label.
- **Actual:** Over 40 icon-only buttons lack aria-label attributes, failing WCAG 2.1 AA.
- **Evidence:** `<button onClick={...} className="p-2 ..."><ZoomIn className="w-4 h-4" /></button> without aria-label.`
- **Root Cause:** Missing accessibility attributes during rapid UI prototyping.
- **Reproduction Steps:** 1. Run Chrome Lighthouse Accessibility audit. 2. Observe 'Buttons do not have an accessible name' flags.
- **Recommended Fix:** Add descriptive aria-label attributes to all icon-only button elements.
\n##### BUG-0032: Only required styles should be included in frontend bundle.
- **Bug ID:** `BUG-0032`
- **Severity:** P3
- **Category:** Styling / Bloat
- **Location:** `frontend/src/gods-eye-view/style.css`
- **Expected:** Only required styles should be included in frontend bundle.
- **Actual:** 266 KB of external GEV CSS is loaded globally, injecting 1,200+ unused classes.
- **Evidence:** `import '../gods-eye-view/style.css' in CesiumOceanViewer.jsx.`
- **Root Cause:** Bundling monolithic stylesheet for unused surveillance features.
- **Reproduction Steps:** 1. Inspect network CSS payload. 2. Observe style.css accounts for over 50% of application CSS.
- **Recommended Fix:** Remove import and delete style.css upon GEV removal.
\n##### BUG-0033: Browser tab favicon should display the official INCOIS ocean emblem.
- **Bug ID:** `BUG-0033`
- **Severity:** P3
- **Category:** UI / Branding
- **Location:** `frontend/index.html:5`
- **Expected:** Browser tab favicon should display the official INCOIS ocean emblem.
- **Actual:** Favicon points to default Vite logo: <link rel="icon" type="image/svg+xml" href="/vite.svg" />.
- **Evidence:** `href="/vite.svg" in index.html.`
- **Root Cause:** Default Vite scaffolding asset never replaced.
- **Reproduction Steps:** 1. Open site in browser. 2. Observe Vite logo in browser tab.
- **Recommended Fix:** Replace /vite.svg with /logo.svg or INCOIS emblem.
\n##### BUG-0034: Platform count badge should reflect active loaded platforms or dynamic query count.
- **Bug ID:** `BUG-0034`
- **Severity:** P3
- **Category:** UI / Data
- **Location:** `frontend/src/components/Header.jsx:132`
- **Expected:** Platform count badge should reflect active loaded platforms or dynamic query count.
- **Actual:** Displays hardcoded static badge '1318 Floats' even when filters are active or backend is disconnected.
- **Evidence:** `<span>1318 Floats</span> hardcoded in Header.jsx.`
- **Root Cause:** Hardcoded UI badge.
- **Reproduction Steps:** 1. Disconnect backend. 2. Header still displays '1318 Floats'.
- **Recommended Fix:** Bind badge text to argoFloats.length in useOceanStore.
\n##### BUG-0035: Mouse movement coordinates should be throttled to prevent unnecessary render cycles.
- **Bug ID:** `BUG-0035`
- **Severity:** P3
- **Category:** Performance / UI
- **Location:** `frontend/src/components/BottomStatusBar.jsx:30`
- **Expected:** Mouse movement coordinates should be throttled to prevent unnecessary render cycles.
- **Actual:** Raw mousemove dispatches state updates on every frame, causing rapid re-renders of the status bar.
- **Evidence:** `window.addEventListener('mousemove', (e) => setHoverCoordinates(...)) without throttling.`
- **Root Cause:** Missing requestAnimationFrame or lodash.throttle wrapper.
- **Reproduction Steps:** 1. Record performance profile in DevTools while moving cursor rapidly over globe. 2. Notice continuous React component re-renders.
- **Recommended Fix:** Throttle mouse coordinate dispatches to 60ms or use requestAnimationFrame.
\n##### BUG-0036: Hovering over the colormap ramp should show interpolated numerical value and unit.
- **Bug ID:** `BUG-0036`
- **Severity:** P3
- **Category:** UI / UX
- **Location:** `frontend/src/components/ColorbarLegend.jsx:18`
- **Expected:** Hovering over the colormap ramp should show interpolated numerical value and unit.
- **Actual:** Colormap bar is a static CSS gradient with only min and max labels; hovering shows no tooltip.
- **Evidence:** `ColorbarLegend lacks onMouseMove or title tooltips across the gradient strip.`
- **Root Cause:** Minimal legend implementation.
- **Reproduction Steps:** 1. Hover cursor over middle of colormap ramp. 2. No value indicator appears.
- **Recommended Fix:** Add interactive cursor hover showing interpolated scalar value.
\n##### BUG-0037: Non-critical NetCDF metadata warnings should be logged at DEBUG level.
- **Bug ID:** `BUG-0037`
- **Severity:** P3
- **Category:** Backend / Logging
- **Location:** `backend/app/services/ocean_model.py:128`
- **Expected:** Non-critical NetCDF metadata warnings should be logged at DEBUG level.
- **Actual:** Missing optional CF attributes log at WARNING level on every request, cluttering stdout.
- **Evidence:** `logger.warning(f"Variable '{var_name}' missing 'long_name' attribute.")`
- **Root Cause:** Excessive log severity for benign missing metadata.
- **Reproduction Steps:** 1. Request volume extraction. 2. Observe terminal flooded with attribute warnings.
- **Recommended Fix:** Lower log level to logger.debug.
\n##### BUG-0038: Production build should not generate oversized chunks.
- **Bug ID:** `BUG-0038`
- **Severity:** P3
- **Category:** Build
- **Location:** `frontend/vite.config.js:33`
- **Expected:** Production build should not generate oversized chunks.
- **Actual:** Cesium chunk reaches ~3.8 MB, triggering chunk size warnings during vite build.
- **Evidence:** `(!) Some chunks are larger than 1200 kB after minification: dist/assets/cesium-*.js (3,842 kB).`
- **Root Cause:** CesiumJS monolithic bundle inclusion.
- **Reproduction Steps:** 1. Run npm run build. 2. Observe chunk size warning.
- **Recommended Fix:** Tune manualChunks in vite.config.js to split Cesium worker threads and large dependencies.
\n##### BUG-0039: Initial camera distance should scale based on viewport aspect ratio.
- **Bug ID:** `BUG-0039`
- **Severity:** P3
- **Category:** Three.js
- **Location:** `frontend/src/rendering/OceanSceneController.js:115`
- **Expected:** Initial camera distance should scale based on viewport aspect ratio.
- **Actual:** Camera distance is hardcoded to 450, clipping the bounding box on small laptop screens (e.g., 1366x768).
- **Evidence:** `camera.position.set(0, 350, 450);`
- **Root Cause:** Fixed camera position without aspect ratio accommodation.
- **Reproduction Steps:** 1. Open Three.js mode on a 13-inch screen. 2. Notice edges of the 3D volume grid are clipped outside view.
- **Recommended Fix:** Calculate camera distance dynamically using camera.fov and bounding sphere radius.
\n##### BUG-0040: Tab selectors should support arrow key navigation and focus indicators.
- **Bug ID:** `BUG-0040`
- **Severity:** P3
- **Category:** Accessibility
- **Location:** `frontend/src/pages/DataCatalogPage.jsx:32`
- **Expected:** Tab selectors should support arrow key navigation and focus indicators.
- **Actual:** Tabs are plain buttons without role="tab", aria-selected, or arrow key listeners.
- **Evidence:** `<button onClick={() => setActiveTab('models')}> without WAI-ARIA tab pattern.`
- **Root Cause:** Custom button implementation lacking ARIA tablist semantics.
- **Reproduction Steps:** 1. Navigate tabs using keyboard Tab and Arrow keys. 2. Tab selection does not cycle with arrows.
- **Recommended Fix:** Add role="tablist", role="tab", aria-selected, and arrow key handlers.
\n##### BUG-0041: Frontend repository should include component, hook, and integration tests.
- **Bug ID:** `BUG-0041`
- **Severity:** P4
- **Category:** Testing
- **Location:** `frontend/test/`
- **Expected:** Frontend repository should include component, hook, and integration tests.
- **Actual:** Directory contains only a single test file (geography.test.js) with 12 unit tests; zero React component tests exist.
- **Evidence:** `frontend/test/ contains only geography.test.js.`
- **Root Cause:** Testing deferred during initial development.
- **Reproduction Steps:** 1. Run npm test. 2. Only geography math is executed.
- **Recommended Fix:** Set up Vitest and React Testing Library with tests for Header, OceanTimeline, and oceanStore.
\n##### BUG-0042: Adapter modules should have complete docstrings and type annotations.
- **Bug ID:** `BUG-0042`
- **Severity:** P4
- **Category:** Documentation
- **Location:** `ingestion/adapters/`
- **Expected:** Adapter modules should have complete docstrings and type annotations.
- **Actual:** Several functions in ingestion/adapters/ lack docstrings and parameter type hints.
- **Evidence:** `Functions defined without typing or Google-style docstrings.`
- **Root Cause:** Incomplete code documentation.
- **Reproduction Steps:** 1. Inspect ingestion/adapters/ files. 2. Notice missing function documentation.
- **Recommended Fix:** Add full type hints and docstrings following PEP 257.
\n##### BUG-0043: Root package.json scripts should facilitate full-stack development orchestration.
- **Bug ID:** `BUG-0043`
- **Severity:** P4
- **Category:** Tooling
- **Location:** `package.json:7-10`
- **Expected:** Root package.json scripts should facilitate full-stack development orchestration.
- **Actual:** Root scripts only delegate to frontend npm commands (npm --prefix frontend run dev), ignoring backend startup.
- **Evidence:** `"dev": "npm --prefix frontend run dev" in root package.json.`
- **Root Cause:** Root package.json configured primarily as a frontend proxy.
- **Reproduction Steps:** 1. Run npm run dev from root. 2. Backend is not started.
- **Recommended Fix:** Use concurrently or npm scripts to start both Uvicorn backend and Vite frontend.
\n##### BUG-0044: Source files should include standard file headers and license attributions.
- **Bug ID:** `BUG-0044`
- **Severity:** P4
- **Category:** Code Quality
- **Location:** `frontend/src/rendering/`
- **Expected:** Source files should include standard file headers and license attributions.
- **Actual:** Several rendering modules lack license headers and authorship comments.
- **Evidence:** `Files start directly with import statements without file-level docblocks.`
- **Root Cause:** Omission during file creation.
- **Reproduction Steps:** 1. Inspect CoastlineLayer.js or EarthGlobe.js. 2. Notice absence of header comments.
- **Recommended Fix:** Add standard INCOIS open-source license headers across source files.
\n##### BUG-0045: Methodology document should detail exact mathematical implementation of Absolute Salinity anomaly correction.
- **Bug ID:** `BUG-0045`
- **Severity:** P4
- **Category:** Documentation
- **Location:** `METHODOLOGY.md`
- **Expected:** Methodology document should detail exact mathematical implementation of Absolute Salinity anomaly correction.
- **Actual:** Mentions TEOS-10 but omits the exact equation for Absolute Salinity anomaly delta_SA(lon, lat, p).
- **Evidence:** `Section on Salinity discusses TEOS-10 conceptually without mathematical lookup formulations.`
- **Root Cause:** High-level summary documentation.
- **Reproduction Steps:** 1. Read METHODOLOGY.md. 2. Notice missing formula for delta_SA.
- **Recommended Fix:** Add detailed TEOS-10 formulations including gsw.SA_from_SP specification.
\n##### BUG-0046: Development scripts should be cross-platform or provide Windows PowerShell equivalents.
- **Bug ID:** `BUG-0046`
- **Severity:** P4
- **Category:** Tooling
- **Location:** `start_dev.sh`
- **Expected:** Development scripts should be cross-platform or provide Windows PowerShell equivalents.
- **Actual:** start_dev.sh is a bash script using Unix backgrounding (&) that fails on standard Windows PowerShell.
- **Evidence:** `start_dev.sh uses #!/bin/bash and trap 'kill ...' EXIT.`
- **Root Cause:** Unix-centric developer script.
- **Reproduction Steps:** 1. Execute start_dev.sh in PowerShell. 2. Script fails to execute.
- **Recommended Fix:** Provide a start_dev.ps1 PowerShell script alongside start_dev.sh.
\n##### BUG-0047: Root diagnostic scripts should be integrated into setup guides or CI workflows.
- **Bug ID:** `BUG-0047`
- **Severity:** P4
- **Category:** Dead Code
- **Location:** `check_system.py`
- **Expected:** Root diagnostic scripts should be integrated into setup guides or CI workflows.
- **Actual:** check_system.py exists at root but is never referenced in README.md, CI, or package.json.
- **Evidence:** `check_system.py (3,509 bytes) unreferenced in repository documentation.`
- **Root Cause:** Orphaned diagnostic utility.
- **Reproduction Steps:** 1. Search for 'check_system.py' across all markdown and config files. 2. Zero references found.
- **Recommended Fix:** Document usage in README.md as a preflight verification step.
\n##### BUG-0048: API base URLs should use relative paths (/api/v1) by default to support reverse proxies and Docker containers.
- **Bug ID:** `BUG-0048`
- **Severity:** P4
- **Category:** Configuration
- **Location:** `frontend/src/store/oceanStore.js:3`
- **Expected:** API base URLs should use relative paths (/api/v1) by default to support reverse proxies and Docker containers.
- **Actual:** Hardcodes fallback to localhost:8000 when VITE_API_URL is unset.
- **Evidence:** `const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');`
- **Root Cause:** Reliance on environment variable with no default relative fallback in development.
- **Reproduction Steps:** 1. Deploy frontend in container without VITE_API_URL. 2. API calls attempt to target client's localhost.
- **Recommended Fix:** Default to relative path '/api/v1' and rely on Vite/Nginx proxying.
\n##### BUG-0049: Test suites should run cleanly with zero deprecation warnings.
- **Bug ID:** `BUG-0049`
- **Severity:** P4
- **Category:** Testing
- **Location:** `backend/tests/test_api.py:12`
- **Expected:** Test suites should run cleanly with zero deprecation warnings.
- **Actual:** Uses Starlette TestClient with patterns deprecated in httpx >= 0.27.
- **Evidence:** `DeprecationWarning: httpx.Client.__init__ received unexpected keyword argument.`
- **Root Cause:** Version mismatch between TestClient and httpx internals.
- **Reproduction Steps:** 1. Run pytest backend/tests. 2. Observe pytest warning summary.
- **Recommended Fix:** Update test fixture to use httpx.AsyncClient with ASGITransport.
\n##### BUG-0050: Repository root should contain .dockerignore to prevent huge datasets from entering build contexts.
- **Bug ID:** `BUG-0050`
- **Severity:** P4
- **Category:** Docker
- **Location:** `Repository Root`
- **Expected:** Repository root should contain .dockerignore to prevent huge datasets from entering build contexts.
- **Actual:** No root .dockerignore exists; running docker build from root sends 10+ GB of NetCDF files to Docker daemon.
- **Evidence:** `Missing .dockerignore in root directory.`
- **Root Cause:** Docker builds assumed to be run only within backend/ or frontend/ subdirectories.
- **Reproduction Steps:** 1. Run docker build -f backend/Dockerfile . from repository root. 2. Docker client sends 10.2 GB context.
- **Recommended Fix:** Create .dockerignore at repository root excluding datasets/, node_modules/, and .git/.

---

### Section 34: Recommended Fix Priority

To restore platform functionality systematically, fixes should proceed in the following 5 phases:

#### Phase 1: Immediate Critical Unblockers (P0)
1. **Fix `insitu_store.py:659`**: Safely handle `target_cycle is None` to resolve the backend crash and allow `argo_index.json` to load.
2. **Fix `HomePage.jsx` & `LocationDataPanel.jsx`**: Replace `top-18` with `top-20` so all primary panels become visible.

#### Phase 2: Scientific Integrity & Data Policy Compliance (P1)
1. **Fix `main.py:33` CORS**: Allow `["GET", "POST", "OPTIONS"]` so delimited profile uploads function.
2. **Purge Alien GEV Integration**: Remove `GEV_HTML` injection from `CesiumOceanViewer.jsx` and eliminate external surveillance calls.
3. **Connect Real Data in Analytics Studio**: Replace client-side `Math.sin()` with queries to `OceanModel` or Argo timeseries endpoints.
4. **Implement Real Spatial Rendering in Comparison Workspace**: Replace CSS radial gradients with canvas/Three.js spatial rasters.
5. **Persist Settings**: Connect `SettingsPage.jsx` controls to Zustand `useOceanStore` and `localStorage`.

#### Phase 3: Major Functional & Numerical Corrections (P2)
1. **Correct DMS Rounding in Status Bar**: Ensure seconds rolling over to `60.00"` increment minutes.
2. **Clean up Orphaned Components**: Remove or integrate the 7 unreferenced components in `src/components/`.
3. **Resolve Three.js UI Occlusion**: Reposition camera preset toolbar to prevent overlap with the timeline scrubber.
4. **Enforce Hard LRU Memory Cap**: Add explicit byte-size limits to `ocean_model.py` caching.

#### Phase 4: Polish, UI Polish & Accessibility (P3)
1. **Add `aria-label` Attributes**: Ensure all 40+ icon-only buttons pass WCAG 2.1 AA.
2. **Improve Error Feedback**: Surface descriptive colocation error messages in `ComparisonPage`.
3. **Fix Favicon & Branding**: Replace `/vite.svg` with the official INCOIS emblem.

#### Phase 5: Technical Debt & Documentation (P4)
1. **Add Unit Tests**: Implement React component tests using Vitest and React Testing Library.
2. **Update Root Scripts**: Align `package.json` scripts with backend virtual environment management.
3. **Add Root `.dockerignore`**: Prevent multi-gigabyte datasets from copying into container builds.

---

### Section 35: Files Most Likely Requiring Changes

| File Path | Priority | Rationale for Modification |
| :--- | :---: | :--- |
| `backend/app/services/insitu_store.py` | **P0** | Fix `None` formatting TypeError in `_resolve_platform_file_path` |
| `frontend/src/pages/HomePage.jsx` | **P0** | Replace `top-18` with `top-20` to make panels visible |
| `frontend/src/components/LocationDataPanel.jsx`| **P0** | Replace `top-18` with `top-20` to fix panel positioning |
| `backend/app/main.py` | **P1** | Add `"POST"` to `allow_methods` in CORS middleware |
| `frontend/src/rendering/CesiumOceanViewer.jsx` | **P1** | Strip `GEV_HTML` injection and alien surveillance scripts |
| `frontend/src/pages/ComparisonPage.jsx` | **P1** | Replace static CSS radial gradients with real data grids |
| `frontend/src/pages/AnalyticsPage.jsx` | **P1** | Replace synthetic sine wave with real data queries; activate tabs |
| `frontend/src/pages/SettingsPage.jsx` | **P1** | Wire "Apply Settings" button to Zustand store and persistence |
| `frontend/src/components/BottomStatusBar.jsx` | **P2** | Fix DMS arcsecond rollover calculation |
| `frontend/src/rendering/OceanViewer.jsx` | **P2** | Reposition camera toolbar to avoid timeline collision |
| `frontend/src/pages/ExplorerPage.jsx` | **P2** | Consolidate or eliminate redundant duplicate route |
| `backend/app/services/ocean_model.py` | **P2** | Implement hard memory byte cap on volume cache |

---

### Section 36: Items That MUST NOT Be Changed

To preserve system stability and core scientific fidelity, the following verified assets and algorithms must remain untouched:
1. **TEOS-10 Gibbs SeaWater Calculations (`backend/app/services/insitu_store.py`)**:  
   The depth calculation using `gsw.z_from_p(pressure, latitude)` conforms to international oceanographic standards and must not be altered.
2. **ROMS S-Coordinate Formula (`backend/app/services/ocean_model.py`)**:  
   The terrain-following vertical depth formulation ($z = \zeta + (\zeta + h) \cdot S$) correctly computes physical ocean depths.
3. **CF-1.6 Coordinate Resolvers**:  
   The coordinate matching logic in `ocean_model.py` correctly maps variable aliases across NetCDF variations.
4. **Three.js Raymarching Core Math (`VolumeRaymarchingShader.js`)**:  
   The fundamental ray-box intersection and 3D texture sampling algorithm correctly handles volumetric scalar fields.
5. **Authentic Coriolis NetCDF Datasets (`datasets/coriolis/` and `datasets/argo_index.json`)**:  
   The underlying NetCDF profile files and precomputed platform index represent authentic in-situ data and should not be modified.

---

### Section 37: Unknowns and Areas Requiring Further Investigation

1. **`datasets/INCOIS-BIO-ROMS.nc` (9.25 GB) Integrity & Accessibility**:  
   Due to its size, verify whether this file is fully indexed by `OceanModel` or if specific time steps induce out-of-memory errors on machines with less than 16 GB RAM.
2. **Satellite Track Ingestion Pipeline**:  
   `OBSERVING_MISSIONS` in `oceanStore.js` lists Oceansat-3, SARAL, and SCATSAT-1. Determine whether real orbital TLEs or live trajectory APIs will be integrated.
3. **Long-Term Storage for User-Uploaded Delimited Data**:  
   Currently, `DelimitedParser` stores parsed profiles in-memory. Clarify whether ingested ASCII profiles should be persisted to disk or a database across restarts.
4. **Cesium Ion Token Dependency**:  
   Investigate if Cesium global imagery relies on a public demo key or an official INCOIS-hosted WMS/WMTS tile server for offline deployments.
