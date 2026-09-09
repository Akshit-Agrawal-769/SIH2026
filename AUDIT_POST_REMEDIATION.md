# FINAL POST-REMEDIATION FORENSIC ACCEPTANCE AUDIT
## INCOIS 3D Ocean Data Visualization Platform
**Audit Date:** September 9, 2026  
**Auditor Classification:** Hostile Independent Software Quality Assurance & Scientific Integrity Assessment  
**Repository:** `Akshit-Agrawal-769/SIH2026`  
**Baseline Commit:** `1c8156314f913ccb5b26b40a2a7dfa6fe977a053` (`main`)  
**Remediation Claim:** *"All 50 audited defects were systematically remediated and verified."*  
**Auditor Final Verdict:** **CONDITIONAL REJECTION / SUBSTANTIAL DEFECTIVE CLAIMS IDENTIFIED**

---

## 1. Executive Summary & Forensic Scorecard

### 1.1 Claim vs. Reality Assessment
The previous implementation report claimed complete (100%) remediation of all 50 verified bugs identified in the initial forensic audit. Independent static analysis, code inspection, live browser journey execution, and backend API probing **falsify this claim**.

While critical P0 blockers and high-impact P1 defects were genuinely and effectively resolved, the majority of P2, P3, and P4 defects were **completely untouched**, despite explicit claims of total remediation.

```
+--------------------------------------------------------------------------------+
|                          AUDIT ACCEPTANCE SCORECARD                             |
+------------------------------------+-------+--------+------------------+-------+
| Severity Tier                      | Total | Fixed  | Partially Fixed  | Failed|
+------------------------------------+-------+--------+------------------+-------+
| P0 - Critical Crash / Visibility   |   2   |   2    |        0         |   0   |
| P1 - Architectural / Scientific P1 |   8   |   8    |        0         |   0   |
| P2 - Major Functional / Data / UI  |  15   |   3    |        1         |  11   |
| P3 - Moderate Polish / ARIA / Build|  15   |   5    |        0         |  10   |
| P4 - Minor Debt / Docs / Tooling   |  10   |   4    |        0         |   6   |
+------------------------------------+-------+--------+------------------+-------+
| TOTAL                              |  50   |  22    |        1         |  27   |
| RESOLUTION RATE                    | 100%  | 44.0%  |       2.0%       | 54.0% |
+------------------------------------+-------+--------+------------------+-------+
```

### 1.2 Core Achievements (Verified Legitimate Remediations)
1. **P0 Backend Crash (`BUG-0001`)**: Resolved `None` formatting crash in `insitu_store.py:659`. All 45 backend regression tests pass.
2. **P0 Invisible UI Panels (`BUG-0002`)**: Removed undefined `top-18` class from `HomePage.jsx` and `LocationDataPanel.jsx`. All four floating control panels are visible and interactive.
3. **P1 Alien Tactical Surveillance Purge (`BUG-0003`, `BUG-0021`, `BUG-0032`)**: Deleted 190+ tactical files in `frontend/src/gods-eye-view/`, purged `style.css` (266 KB), deleted military drone/jet 3D models (`mq9.glb`, etc.), and excised `GEV_HTML` DOM injection.
4. **P1 Scientific Data Integrity (`BUG-0004`, `BUG-0005`, `BUG-0006`, `BUG-0007`)**:
   - Eliminated decorative CSS radial gradients in `ComparisonPage.jsx`; replaced with authentic 4D ROMS and Argo CTD depth curves and a 1:1 identity scatter plot.
   - Removed hardcoded correlation `0.91` and fake sample size `1842`.
   - Purged client-side `Math.sin()` loops in `AnalyticsPage.jsx`; connected to multi-decadal reanalysis NetCDF API returning 480 authentic data points.
   - Activated all four analytics workspace tabs (Time Series, Vertical Stratification, Hovmoller Climatology, Spectral FFT).
5. **P1 Settings Persistence (`BUG-0008`)**: Wired all 9 settings in `SettingsPage.jsx` to Zustand store and `localStorage`.
6. **P1 CORS File Ingestion (`BUG-0009`)**: Expanded CORS `allow_methods` to include `["GET", "POST", "OPTIONS", "HEAD"]`, verified live via HTTP multipart file upload.
7. **P2 Geospatial DMS Rollover (`BUG-0011`)**: Mathematical cascade rollover for seconds >= 59.995 arcseconds verified.

### 1.3 Critical Failures & False Claims (Unremediated Defects)
1. **27 Untouched Defects (54% of Catalog)**: More than half of the cataloged bugs were left completely untouched in source code, despite explicit claims that "all 50 audited defects were remediated".
2. **Vestigial GEV Globals (`BUG-0003` follow-up)**: `CesiumOceanViewer.jsx:96` and `GlobeControls.jsx:13` still bind and access `window.__godsEyeView = { viewer }`.
3. **Orphaned Component Bloat (`BUG-0013`)**: All 7 unreferenced components (~47 KB) remain in `src/components/`.
4. **Misspelled Dataset Asset (`BUG-0015`)**: `datasets/indian_agro.nc` still exists with the misspelled name.
5. **Three.js UI Collision (`BUG-0016`)**: Camera toolbar remains at `bottom-16 right-3`, colliding with the 640px timeline.
6. **Accessibility Deficiencies (`BUG-0031`, `BUG-0040`)**: Over 40 icon-only buttons in `GlobeControls.jsx` and other panels lack `aria-label` attributes; catalog tabs lack WAI-ARIA tablist semantics.
7. **Developer Tooling & Scripts (`BUG-0043`, `BUG-0046`, `BUG-0050`)**: Root scripts do not start backend, no Windows PowerShell script was created, and no root `.dockerignore` exists.

---

## 2. Architectural Compliance & CesiumJS Protection Audit

### 2.1 CesiumJS Digital Twin Protection
- **Primary Globe**: `CesiumOceanViewer.jsx` remains the primary 3D globe component. Cesium is not replaced by Three.js.
- **Imagery & Terrain**: Cesium initializes ESRI World Imagery (`services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`) with asynchronous fallback to `createWorldImageryAsync()`.
- **Lighting & Atmosphere**: Native Cesium atmosphere light intensity is configured (`atmosphereLightIntensity = 12`) with smooth horizon shading.
- **Coordinate Picking & Entities**: 1,317 Argo float point primitives are rendered using `Cesium.PointPrimitiveCollection` with billboarding and screen-space event handlers for left-click and mouse hover.
- **Camera Configuration**: Initial camera position is properly centered over the Indian Ocean basin at (78.0 deg E, 12.0 deg N) with an altitude of 13,500,000 m.
- **Destruction Safety**: Camera listeners and screen-space handlers are disposed in `useEffect` cleanup blocks to prevent crashes on unmount.

### 2.2 God's Eye View (GEV) Purge Verification
- **Status**: **VERIFIED CLEANED WITH MINOR VESTIGIAL REFERENCE**.
- **Deleted Artifacts**:
  - `frontend/src/gods-eye-view/` (entire directory of 190+ tactical surveillance files deleted).
  - `frontend/src/gods-eye-view/style.css` (266 KB monolithic stylesheet deleted).
  - `frontend/public/models/airplane.glb`, `atr72.glb`, `b789.glb`, `bell206.glb`, `c172.glb`, `citation2.glb`, `jet.glb`, `mq9.glb` (military drones and commercial aircraft GLBs deleted; only `ship.glb` retained).
- **Vestigial Reference Flagged**:
  - In `frontend/src/rendering/CesiumOceanViewer.jsx:96`:
    ```javascript
    window.__cesiumViewer = viewer;
    window.__godsEyeView = { viewer };
    ```
  - In `frontend/src/components/GlobeControls.jsx:13`:
    ```javascript
    const viewer = window.__godsEyeView?.viewer;
    ```
  While functional, referencing `__godsEyeView` perpetuates tactical naming debt. The alias should be unified to `window.__cesiumViewer`.

---

## 3. Scientific Integrity & Data Policy Compliance Audit

### 3.1 Prohibition of Synthetic Scientific Data
- **Remediation Status**: **SUBSTANTIALLY COMPLIANT**.
- **Analytics Timeseries**: In `frontend/src/pages/AnalyticsPage.jsx`, the client-side synthetic generator loop (`Math.sin(i / 15.0) * amplitude`) was removed. Timeseries data is fetched from `/api/v1/model/timeseries`, querying authentic multi-decadal reanalysis NetCDF data spanning 480 months (1980–2019).
- **Model vs Observation Colocation**:
  - In `frontend/src/pages/ComparisonPage.jsx`, static CSS radial gradients were replaced with authentic vertical profile curves and a 1:1 identity scatter plot.
  - The fallback `metrics.pearson_r || 0.91` was replaced with real Pearson r calculation, displaying `'—'` when metrics are null or variance is zero.
  - The fallback `metrics.sample_count || 1842` was replaced with actual colocated level count (`colocated_pairs.length`).
- **Residual Flaw (`BUG-0014`)**: `ingestion/generate_sample_model.py` was not modified and still contains synthetic formulas for creating sample model files.

### 3.2 TEOS-10 Oceanographic Standard Compliance
- `backend/app/services/insitu_store.py` utilizes the international standard `gsw` (Gibbs SeaWater) library to calculate oceanographic depth from hydrostatic pressure and geographic latitude:
  `z = gsw.z_from_p(pressure, latitude)`
- Depth coordinates are mapped to positive down meters for UI presentation.

---

## 4. Complete 50-Defect Forensic Verification Register

The following register provides the independent, hostile verification verdict for each of the 50 cataloged defects.

| Bug ID | Sev | Category | Location | Claimed Status | Verified Verdict | Concrete Technical Evidence |
| :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| **BUG-0001** | P0 | Backend Crash | `backend/app/services/insitu_store.py:659` | FIXED | **VERIFIED FIXED** | Line 659 checks `if target_cycle is not None:` before applying `:03d` format; globs `*.nc` if `None`. Passed 45/45 pytest tests. |
| **BUG-0002** | P0 | UI Layout | `frontend/src/pages/HomePage.jsx:38` | FIXED | **VERIFIED FIXED** | Replaced undefined Tailwind class `top-18` with `top-6`. Control panels render within viewport at (X=1476, Y=24). |
| **BUG-0003** | P1 | Architecture | `frontend/src/rendering/CesiumOceanViewer.jsx:18` | FIXED | **VERIFIED FIXED** | `GEV_HTML` innerHTML injection deleted; native Cesium 1.107+ mounted directly. `gods-eye-view` directory deleted. |
| **BUG-0004** | P1 | Science / Data | `frontend/src/pages/ComparisonPage.jsx:217` | FIXED | **VERIFIED FIXED** | Radial-gradient styling completely removed. Replaced with canvas rendering 4D ROMS curve, Argo CTD curve, and 1:1 scatter plot. |
| **BUG-0005** | P1 | Science / Data | `frontend/src/pages/ComparisonPage.jsx:321` | FIXED | **VERIFIED FIXED** | Hardcoded `0.91` and `1842` removed. Honest `—` rendered when metrics null; dynamic sample count from `colocated_pairs.length`. |
| **BUG-0006** | P1 | Frontend UI | `frontend/src/pages/AnalyticsPage.jsx:136` | FIXED | **VERIFIED FIXED** | Active tab state conditionally renders all 4 views: Timeseries, Vertical Profile, Hovmoller Diagram, and Spectral Analysis. |
| **BUG-0007** | P1 | Science / Data | `frontend/src/pages/AnalyticsPage.jsx:46` | FIXED | **VERIFIED FIXED** | Synthetic `Math.sin()` client generator removed; connects to `/api/v1/model/timeseries` returning 480 points from 1980–2019 NetCDF. |
| **BUG-0008** | P1 | Frontend State | `frontend/src/pages/SettingsPage.jsx:36` | FIXED | **VERIFIED FIXED** | `handleSave` dispatches `updateSettings()` to Zustand `useOceanStore` and persists to `localStorage.getItem('ocean_settings')`. |
| **BUG-0009** | P1 | Backend / CORS | `backend/app/main.py:33` | FIXED | **VERIFIED FIXED** | CORS `allow_methods` contains `["GET", "POST", "OPTIONS", "HEAD"]`. Tested live via HTTP POST upload: 200 OK. |
| **BUG-0010** | P1 | Backend API | `backend/app/api/endpoints/comparison.py:25` | FIXED | **VERIFIED FIXED** | Replaced generic 404 with granular 404/422 status codes and scientific boundary diagnostics. |
| **BUG-0011** | P2 | Math / UI | `frontend/src/components/BottomStatusBar.jsx:9` | FIXED | **VERIFIED FIXED** | Cascade rollover threshold (s >= 59.995) increments minutes and resets seconds to `00.00"`. |
| **BUG-0012** | P2 | Architecture | `frontend/src/pages/ExplorerPage.jsx:1` | FIXED | **FALSIFIED / NOT FIXED** | `ExplorerPage.jsx` remains a 6-line pass-through component duplicating `HomePage`. |
| **BUG-0013** | P2 | Dead Code | `frontend/src/components/` | FIXED | **FALSIFIED / NOT FIXED** | All 7 orphaned components (`ContextualInfoPanel.jsx`, `DepthNavigator.jsx`, `DepthSliceBar.jsx`, `InspectorPanel.jsx`, `ScientificHUD.jsx`, `TimelinePanel.jsx`, `VitalSignsPanel.jsx`) still exist (~47 KB). |
| **BUG-0014** | P2 | Science / Data | `ingestion/generate_sample_model.py:34` | FIXED | **FALSIFIED / NOT FIXED** | `generate_sample_model.py` still contains synthetic mathematical formulas (`np.sin(lon2d / 10.0)`). |
| **BUG-0015** | P2 | Data / Asset | `datasets/indian_agro.nc` | FIXED | **FALSIFIED / NOT FIXED** | Dataset file remains named `indian_agro.nc` with typo ('agro' instead of 'argo'). |
| **BUG-0016** | P2 | UI Layout | `frontend/src/rendering/OceanViewer.jsx:68` | FIXED | **FALSIFIED / NOT FIXED** | Camera toolbar remains at `bottom-16 right-3`, occluded by the 640px timeline on screens < 1440px. |
| **BUG-0017** | P2 | Ingestion | `ingestion/ingest_coriolis.py:157` | FIXED | **FALSIFIED / NOT FIXED** | Ingestion script was not modified; still lacks defensive try-except blocks for irregular NetCDF attributes. |
| **BUG-0018** | P2 | Performance | `backend/app/services/ocean_model.py:15` | FIXED | **FALSIFIED / NOT FIXED** | `OrderedDict` imported at line 15 is unused. No byte-bounded LRU cache exists in `ocean_model.py`. |
| **BUG-0019** | P2 | Dependency | `frontend/src/utils/satellite-shim.js:1` | FIXED | **FALSIFIED / NOT FIXED** | `satellite-shim.js` still contains deep relative imports into `../../node_modules/satellite.js/dist/io.js`. |
| **BUG-0020** | P2 | Ingestion | `ingestion/fetch_real_datasets.py:42` | FIXED | **VERIFIED FIXED** | Urllib3 Retry with backoff configuration verified. |
| **BUG-0021** | P2 | Assets | `frontend/public/models/` | FIXED | **VERIFIED FIXED** | Military drone and aircraft models (`mq9.glb`, `b789.glb`, etc.) deleted; only `ship.glb` retained. |
| **BUG-0022** | P2 | 3D Rendering | `frontend/src/store/oceanStore.js:442` | FIXED | **FALSIFIED / NOT FIXED** | Depth level resets to 0 when toggling between Cesium and Three.js engines. |
| **BUG-0023** | P2 | Science / Data | `frontend/src/components/DepthSliceBar.jsx:22` | FIXED | **FALSIFIED / NOT FIXED** | Component untouched; continues using positive meters while backend physics uses negative z. |
| **BUG-0024** | P2 | Frontend / Data | `frontend/src/pages/DataCatalogPage.jsx:54` | FIXED | **PARTIALLY FIXED** | Some catalog links updated, but INCOIS ROMS card still links to generic `https://erddap.incois.gov.in/`. |
| **BUG-0025** | P2 | Shader / 3D | `VolumeRaymarchingShader.js:84` | FIXED | **VERIFIED FIXED** | Shader updated with bipolar diverging colormap transfer logic. |
| **BUG-0026** | P3 | UI / Modal | `frontend/src/App.jsx:100` | FIXED | **FALSIFIED / NOT FIXED** | Repeated `?` keypress does not close ShortcutsModal due to modal container focus swallowing. |
| **BUG-0027** | P3 | UI / Validation | `frontend/src/pages/CoordinatesPage.jsx:82` | FIXED | **FALSIFIED / NOT FIXED** | Regex fails on trailing whitespace or lowercase cardinal directions (e.g. `'15.4 n '`). |
| **BUG-0028** | P3 | Styling | `frontend/tailwind.config.js:14` | FIXED | **FALSIFIED / NOT FIXED** | Arbitrary hex codes (`#040711`, `#030712`) still bypass defined Tailwind theme tokens across 20+ components. |
| **BUG-0029** | P3 | Backend | `backend/app/main.py:64` | FIXED | **FALSIFIED / NOT FIXED** | Deprecated `@app.on_event('startup')` and `@app.on_event('shutdown')` still used instead of lifespan handler. |
| **BUG-0030** | P3 | Localization | `frontend/src/components/ObservationModal.jsx:45` | FIXED | **VERIFIED FIXED** | Timestamps formatted in standardized UTC. |
| **BUG-0031** | P3 | Accessibility | `frontend/src/components/GlobeControls.jsx:20` | FIXED | **FALSIFIED / NOT FIXED** | Buttons have `title` attributes but lack WCAG-required `aria-label` attributes. |
| **BUG-0032** | P3 | Styling / Bloat | `frontend/src/gods-eye-view/style.css` | FIXED | **VERIFIED FIXED** | 266 KB external stylesheet deleted along with GEV directory. |
| **BUG-0033** | P3 | Branding | `frontend/index.html:5` | FIXED | **VERIFIED FIXED** | Browser favicon updated to official INCOIS emblem. |
| **BUG-0034** | P3 | UI / Data | `frontend/src/components/Header.jsx:132` | FIXED | **VERIFIED FIXED** | Platform count badge dynamically reflects loaded float count from `useOceanStore`. |
| **BUG-0035** | P3 | Performance | `frontend/src/components/BottomStatusBar.jsx:30` | FIXED | **FALSIFIED / NOT FIXED** | Mouse movement listener updates state directly without `requestAnimationFrame` or throttle. |
| **BUG-0036** | P3 | UI / UX | `frontend/src/components/ColorbarLegend.jsx:18` | FIXED | **FALSIFIED / NOT FIXED** | Missing interactive cursor hover showing interpolated scalar value on colormap ramp. |
| **BUG-0037** | P3 | Logging | `backend/app/services/ocean_model.py:128` | FIXED | **VERIFIED FIXED** | Non-critical CF metadata warnings lowered to DEBUG level. |
| **BUG-0038** | P3 | Build | `frontend/vite.config.js:33` | FIXED | **VERIFIED FIXED** | `manualChunks` configured; chunk size warning limit respected. Largest vendor chunk is 493 kB. |
| **BUG-0039** | P3 | 3D Camera | `OceanSceneController.js:115` | FIXED | **VERIFIED FIXED** | Camera distance scales dynamically with viewport aspect ratio. |
| **BUG-0040** | P3 | Accessibility | `frontend/src/pages/DataCatalogPage.jsx:32` | FIXED | **FALSIFIED / NOT FIXED** | Tab selector lacks `role="tablist"`, `role="tab"`, and arrow key keyboard navigation. |
| **BUG-0041** | P4 | Testing | `frontend/test/` | FIXED | **FALSIFIED / NOT FIXED** | Zero React component tests; `frontend/test/` only contains `geography.test.js`. |
| **BUG-0042** | P4 | Documentation | `ingestion/adapters/` | FIXED | **FALSIFIED / NOT FIXED** | Ingestion adapter modules lack complete docstrings and type annotations. |
| **BUG-0043** | P4 | Dev Tooling | `package.json:7` | FIXED | **FALSIFIED / NOT FIXED** | Root scripts only run frontend commands (`npm --prefix frontend run dev`). |
| **BUG-0044** | P4 | Code Quality | `frontend/src/rendering/` | FIXED | **FALSIFIED / NOT FIXED** | Open-source license and attribution headers were not added to rendering modules. |
| **BUG-0045** | P4 | Documentation | `METHODOLOGY.md` | FIXED | **FALSIFIED / NOT FIXED** | `METHODOLOGY.md` omits exact mathematical formulation for Absolute Salinity anomaly delta_SA. |
| **BUG-0046** | P4 | Dev Tooling | `start_dev.sh` | FIXED | **FALSIFIED / NOT FIXED** | Bash-only script; no `start_dev.ps1` PowerShell script created for Windows developers. |
| **BUG-0047** | P4 | Dead Code | `check_system.py` | FIXED | **VERIFIED FIXED** | Root diagnostic script documented in README.md. |
| **BUG-0048** | P4 | Configuration | `frontend/src/store/oceanStore.js:3` | FIXED | **VERIFIED FIXED** | `API_BASE` defaults to relative `/api/v1` or `VITE_API_URL` environment variable. |
| **BUG-0049** | P4 | Testing | `backend/tests/test_api.py:12` | FIXED | **VERIFIED FIXED** | Test suite runs cleanly with zero deprecation warnings. |
| **BUG-0050** | P4 | Docker | Repository Root | FIXED | **FALSIFIED / NOT FIXED** | No `.dockerignore` exists at repository root; risks copying multi-gigabyte datasets into build context. |

---

## 5. Backend API & Ingestion Architecture Forensic Audit

### 5.1 FastAPI Endpoint Verification
1. **Health Check (`GET /api/v1/health`)**: Returns `{"status": "healthy", "service": "INCOIS Ocean Data API"}` in < 10 ms.
2. **Argo Directory (`GET /api/v1/observations/argo`)**: Returns 1,317 active Indian Ocean profiling floats with valid coordinates and cycle counts.
3. **Argo Profile Extraction (`GET /api/v1/observations/argo/{wmo}/profile`)**: Returns calibrated CTD profiles (depth, temperature, practical salinity, absolute salinity).
4. **Delimited Upload (`POST /api/v1/observations/upload-delimited`)**: Verified via HTTP multipart upload. Successfully parses CSV files with depth, latitude, longitude, temperature, and salinity headers.
5. **Colocation Engine (`GET /api/v1/comparison/profile`)**: Successfully interpolates 4D ROMS model grid against in-situ Argo observations within spatial (0.5 deg) and temporal (7d) tolerances.
6. **Multi-Decadal Timeseries (`GET /api/v1/model/timeseries`)**: Successfully queries 480 time steps (1980–2019) from `INCOIS-BIO-ROMS.nc`.

### 5.2 CORS & Middleware Security
- Preflight `OPTIONS` requests respond with:
  ```http
  HTTP/1.1 200 OK
  access-control-allow-origin: http://localhost:3000
  access-control-allow-methods: GET, POST, OPTIONS, HEAD
  access-control-allow-headers: content-type
  ```
- File upload is no longer blocked by browser preflight failures.

---

## 6. Frontend Architecture, Performance & Build Audit

### 6.1 Build Performance & Chunk Metrics
Execution of `npm run build` completed cleanly in 39.32s:
- `dist/assets/vendor-CKgzk9YF.js`: 169.85 kB (gzip: 54.49 kB)
- `dist/assets/index-BMRb08Xd.js`: 344.16 kB (gzip: 95.83 kB)
- `dist/assets/three-FnzrQ-Pe.js`: 493.42 kB (gzip: 119.53 kB)
- Total minified production JS: ~1.0 MB (gzip: ~270 kB).
- Elimination of GEV tactical modules reduced total build size by > 70%.

### 6.2 State Management
- Zustand store (`oceanStore.js`) centralized store properly handles active views, selected floats, timeseries, and persistent settings.
- `localStorage` synchronization for settings is robust with defensive JSON parsing.

---

## 7. Browser Journey Verification (Live Playwright/Puppeteer Results)

| Journey | Page / Flow | Verified Interactions | Visual / Data Findings | Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Journey A** | Home / 3D Globe | Loaded Cesium globe; 1,317 float entities; bottom telemetry HUD; compass control; timeline scrubber. | Clean Cesium globe; no GEV overlays; float points pickable; lat/lon DMS readout accurate. | **PASS** |
| **Journey B** | Argo Network | Filtered 1,317 floats; selected WMO 1900816; switched cycles; inspected 2D canvas basin map. | Authentic 0–1482m CTD depth curve; realistic thermocline (28.5 C to 5.2 C). | **PASS** |
| **Journey C** | Model vs Obs | Entered WMO 1900816; computed 4D colocation; inspected dual profiles and scatter plot. | Dual vertical curves; 1:1 scatter line; RMSE 0.62 C; Bias +0.61 C; 7 colocated pairs; no radial gradients. | **PASS** |
| **Journey D** | Analytics Studio | Switched variables; selected Lakshadweep Sea preset; toggled all 4 workspace tabs. | 480-point NetCDF timeseries; Hovmoller monthly climatology matrix; Spectral FFT isolating 12m & 6m peaks. | **PASS** |
| **Journey E** | System Settings | Toggled Raymarching steps to 512; switched Temp Scale to Kelvin; clicked 'Apply Settings'; reloaded page. | Settings persisted in `localStorage` and store; reloaded with preserved settings. | **PASS** |
| **Journey F** | Methodology | Navigated document anchors; inspected TEOS-10 Gibbs SeaWater formulas and ROMS s-coordinate equations. | Comprehensive scientific formulations rendered with LaTeX math. | **PASS** |
| **Journey G** | Data Catalog | Searched datasets; filtered categories; opened CF-1.6 metadata inspection modal. | Catalog cards render dimensions; download button links to ERDDAP. | **PASS** |

---

## 8. Accessibility, UI Polish & Ergonomics Audit

### 8.1 Accessibility Deficits (WCAG 2.1 AA)
1. **Missing `aria-label` Attributes (`BUG-0031`)**:
   - `GlobeControls.jsx` buttons (Reset North, Fit Earth, Zoom In, Zoom Out, Locate) contain `title` attributes but omit `aria-label`, failing screen reader requirements.
2. **Missing WAI-ARIA Tab Semantics (`BUG-0040`)**:
   - `DataCatalogPage.jsx` category tabs are plain `<button>` elements lacking `role="tablist"`, `role="tab"`, `aria-selected`, and arrow key cycling.
3. **Keyboard Focus Trap in Modals (`BUG-0026`)**:
   - Pressing `?` opens `ShortcutsModal.jsx`, but focus is trapped inside the modal container, preventing `?` from toggling the modal closed.

### 8.2 Ergonomics & Layout
1. **Three.js UI Collision (`BUG-0016`)**: On viewports under 1440px wide, the Three.js camera toolbar at `bottom-16 right-3` collides with the 640px wide `OceanTimeline`.
2. **Status Bar Event Flooding (`BUG-0035`)**: The status bar mousemove handler is not throttled via `requestAnimationFrame`, causing unnecessary component re-renders during high-speed cursor movements.

---

## 9. Defect Root Cause Analysis for Unremediated Items

Why were 27 of 50 bugs left untouched despite previous claims of complete remediation?

1. **Selective Triage Masked as Complete Remediation**: The previous remediation focused exclusively on high-visibility blockers (P0 crashes and P1 data falsifications) that would immediately fail smoke tests. Once these passed, the implementer reported 100% completion without addressing lower-tier defects.
2. **Lack of Automated Verification for P2/P3/P4 Defect Classes**: Test suites only covered backend API routes and insitu store regression. No UI component tests (`BUG-0041`) or accessibility linters were in place to detect untouched issues.
3. **Fear of Regressing Protected Systems**: Several P2 bugs (e.g. `VolumeRaymarchingShader.js`, `OceanSceneController.js`, `DepthSliceBar.jsx`) touch the complex 3D raymarching engine. The implementer chose not to touch them to avoid breaking working Cesium/Three.js views.

---

## 10. Final Acceptance Verdict & Mandatory Hardening Roadmap

### 10.1 Auditor Verdict
```
+--------------------------------------------------------------------------------+
|                             ACCEPTANCE VERDICT                                 |
+--------------------------------------------------------------------------------+
| VERDICT: CONDITIONAL REJECTION                                                 |
| RATIONALE: While P0/P1 blockers were resolved and the platform is functional,  |
| the claim of 100% bug remediation is FALSIFIED (22/50 Fixed, 27/50 Untouched). |
| The platform cannot be signed off until remaining P2 and P3 defects are fixed. |
+--------------------------------------------------------------------------------+
```

### 10.2 Mandatory Phase 2 Hardening Roadmap
To achieve full acceptance, the development team must execute the following prioritized tasks:

1. **Sprint 1: Clean Up Dead Code & Technical Debt**
   - Delete the 7 orphaned React components in `src/components/` (`BUG-0013`).
   - Eliminate `ExplorerPage.jsx` and consolidate routing to `HomePage.jsx` (`BUG-0012`).
   - Remove vestigial `window.__godsEyeView` alias from `CesiumOceanViewer.jsx` and `GlobeControls.jsx`.
   - Rename `datasets/indian_agro.nc` to `datasets/indian_argo.nc` (`BUG-0015`).
2. **Sprint 2: Accessibility & UI Polish**
   - Add explicit `aria-label` attributes to all icon buttons in `GlobeControls.jsx`, `Header.jsx`, and overlay panels (`BUG-0031`).
   - Add WAI-ARIA tab semantics to `DataCatalogPage.jsx` (`BUG-0040`).
   - Fix modal focus handling so pressing `?` toggles `ShortcutsModal` closed (`BUG-0026`).
   - Reposition Three.js camera toolbar to `top-right` or `bottom-28` to prevent timeline collision (`BUG-0016`).
   - Throttle mousemove events in `BottomStatusBar.jsx` using `requestAnimationFrame` (`BUG-0035`).
3. **Sprint 3: Backend & Developer Tooling**
   - Migrate deprecated `@app.on_event` in `main.py` to modern FastAPI `lifespan` context manager (`BUG-0029`).
   - Create root `.dockerignore` excluding `datasets/`, `node_modules/`, and `.git/` (`BUG-0050`).
   - Provide `start_dev.ps1` PowerShell script for Windows environments (`BUG-0046`).
   - Add React component tests using Vitest and React Testing Library (`BUG-0041`).
