# SIH2026 MASTER FORENSIC AUDIT & REMEDIATION REPORT

Date: 2026-09-25 · Branch: `audit/remediation-2026-09-25` (from `main` @ `44c20f7a`) · Safety branch: `audit-backup-2026-09-25`
Changes are **uncommitted** on the audit branch; nothing was pushed.

Evidence labels: **VERIFIED** (checked by running code/data), **PARTIALLY VERIFIED**, **NOT VERIFIED**, **FALSE** (claim contradicted by evidence).

## 1. Executive Summary

The platform's core scientific content was not authentic. The 3D "INCOIS ROMS" tiles (160 files, 8 depths, 2024-06-01..05) were procedural fields from a deleted generator (`ingestion/generate_sample_model.py`, commit `913a7ac0`); 18 of 32 observation platforms (2 gliders, 16 buoys) plus float 2902126 were fabricated from formulas; oxygen/chlorophyll for two real floats were formula-generated; currents were synthetic and were extrapolated to depth with an invented Ekman rotation; the model-vs-observation feature compared 2026 Argo profiles with a synthetic 2024 field while claiming "INCOIS Bio-ROMS 3.9" and QC it did not apply. The file named `incois_roms_indian_ocean.nc` is a byte-identical copy of a CMEMS ARMOR3D product. Auth was a hardcoded `admin/password` shipped in the browser bundle.

All of this was replaced by a reproducible pipeline (`scripts/build_authentic_dataset.py`) over the three authentic sources present locally — INCOIS Bio-ROMS (DOI 10.5281/zenodo.13802393), CMEMS ARMOR3D, and Argo GDAC files — and the backend, gateway, frontend, C++ exporter, tests and docs were corrected. Every served value was traced to its source and spot-checked (§4, §25). The honest consequence: gridded data are **surface-only** (no subsurface model levels exist), the model runs to 2019-12, and only two floats overlap it.

Public deployments were **not** changed (no access); both still serve the old synthetic data (§27).

## 2. Repository Architecture

`frontend/` (React 18, Vite, TS, Zustand, CesiumJS, Three.js), `data-service/` (FastAPI), `gateway/` (Express/TS), `cpp_visualizer/` (C++20 ocean_core + tools/tests), `scripts/` (data build), `datasets/` (untracked sources, ~9.5 GB), `infra/` (PostGIS), `docs/`. Removed as dead or fabricating: `api/` (stale duplicate engine + fabricated JSON copies of a deleted Vercel function), `scripts/generate_real_data.py`, `fix_cpp.py` (hardcoded `/home/hasney12`), `frontend/update_*.py` codemods, `data-service/app/processing/voxelize.py` + `land_mask_550x450.npy`, glider/buoy adapters (always empty), obsolete tests. Local untracked `tiles/` and `api/tiles/` (synthetic) are no longer read by any code path and were left on disk. `frontend/src/rendering/volumeShader.ts` is unused (left).

## 3. Data Architecture

| Source file | Content (VERIFIED from NetCDF headers) | Used for |
|---|---|---|
| `datasets/model/INCOIS-BIO-ROMS.nc` (9.2 GB) | INCOIS IBR, 480 monthly steps 1980-01-24→2019-12-25, 1/12°, 30–120°E 30°S–30°N, surface SST/SSS/CHL(kg m⁻³)/MLD/pCO2/DIC/NO3, **no depth dim** | SST, SSS, Chl-a, MLD tiles (2019); model side of comparisons |
| `datasets/cmems.nc` (95 MB) | CMEMS ARMOR3D `MULTIOBS_GLO_PHY_TSUV_3D_MYNRT_015_012`, CLS, 1 step 2024-12-31, depth 0, global 0.125°, `to/so/ugo/vgo/mlotst/zo` | surface geostrophic currents |
| `datasets/model/incois_roms_indian_ocean.nc` | **byte-identical to cmems.nc** (FALSE "ROMS" label) | not used |
| Argo `datasets/coriolis/<WMO>/profiles/S*.nc`, `datasets/argo/incois_2902084_prof.nc`, `incois_2902120_prof.nc` | FR GDAC files; 2902084: 56 profiles 2012–14 (D-mode); 2902120: 262 profiles 2014–21 (D-mode); 11 BGC floats 2022–26 | Argo markers, profiles, matchups |

Served artefacts (`frontend/public`): 49 tiles (IBR 4 variables × 12 months + 1 ARMOR3D currents; 28 MB vs 93 MB before), `api/catalog.json`, 5 manifests, 13 profiles, 13 matchup files, 26 precomputed comparisons, `data/currents_uv.json`.

## 4. Scientific Data Lineage

NetCDF → `build_authentic_dataset.py` (regrid / QC / TEOS-10 / collocation) → `frontend/public` → FastAPI (`analytics_engine.py`) or static hosting → client parser (var_code-checked) → Cesium/Three.js. Spot checks (all VERIFIED, `scratchpad/verify_build.py`):
* ARMOR3D speed at (10.0625N, 60.0625E): direct √(u²+v²) 0.06661 = tile 0.06661.
* IBR SST 2019-06-28 at (15.0625N, 65.0625E): manual bilinear 30.19907 = tile 30.19907.
* SST Jan vs Jul 2019 domain means 27.864 / 28.341 °C (distinct payloads for all 12 months; test enforces).
* Argo 2902084 level (16.0 dbar, 27.251 °C, QC '1') = source; depth 15.91 m = gsw; latest cycle 55 = max JULD.
* Browser hover at 13°N 88°E shows 27.909 °C = tile cell (184, 424).

## 5. Zero-Mock Audit

| Item | Before | After |
|---|---|---|
| Gridded tiles | procedural (uniform +0.0296 °C/5 days at every depth; S & Chl identical all dates; Chl ≡ 0.0200 at 100/500/1000 m) — FALSE "authentic" | IBR/ARMOR3D only |
| Gliders ×2, OMNI/CB buoys ×16, float 2902126 | formula profiles, fake coords/times | removed |
| O₂ / Chl for 2902084/2902120 | Garcia-Gordon × depth factor; Gaussian | removed (not measured) |
| Currents | synthetic u/v, NaN→0, exp(−z/140) + Ekman at any depth | ARMOR3D ugo/vgo, null kept, surface & 2024-12-31 only |
| C++ exporter | one slice copied to 14 invented dates; IBR 1980-01 labelled June 2024 | source timestamps only |
| Timeline (WIP) | hardcoded mock dates, fake WMO `INCOIS_ARGO_1234` | catalog timesteps |
| 3D views | painted stratification, random "current" particles | neutral frame + real data |
| Code sweep | — | no `Math.random`/`np.random` in served paths (VERIFIED by grep) |

## 6. Argo / QC / TEOS-10 Audit

* QC: old ingestion used raw values for D-mode data, ignored PRES/position/time QC, turned masked pressure into 0 m (FALSE "QC 1/2 verified"). Now flags 1/2 per parameter with `*_ADJUSTED` for A/D (PARAMETER_DATA_MODE aware), JULD_QC/POSITION_QC 1/2 — VERIFIED.
* Oldest-profile bug (VERIFIED in old `ingestion/argo.py`: position/last_report from `float_profiles[0]`, stored first 5 cycles). Fixed: latest by JULD.
* Depth: Python used 0.993·p (≈ 7–12 m error at 2000 dbar, no latitude). Now `gsw.z_from_p`. C++ UNESCO-1983 matches gsw within 4 mm (VERIFIED); C++ docs no longer claim other TEOS-10 quantities.
* Oxygen units were shown as ml/l; Argo DOXY is µmol/kg (fixed, no conversion applied).
* 4 floats' JSON contained `NaN` tokens (invalid JSON in browsers) — build now uses `allow_nan=False` (test enforces).

## 7. Model-vs-Observation Audit

Old: pairs of 2026 profiles vs a synthetic 2024 field at default date 2024-06-03; vertical interpolation over fabricated levels. New (METHODOLOGY §4): shallowest QC-good level ≤10 m, nearest IBR step within ±15 days, bilinear on the native grid with all-ocean corners, surface only. Metrics hand-recomputed from served pairs (VERIFIED): 2902120 temperature N=210, RMSE 0.9758 °C, MAE 0.7614, bias −0.0901, r 0.7954; salinity RMSE 0.7692 PSU; 2902084 temperature N=52, RMSE 0.6053, r 0.833. Pearson requires N≥3 and non-zero variance; r² labelled as squared r. Floats without overlap return the two time spans (VERIFIED in UI).

## 8. Analytics Audit

* Time series: slope assumed consecutive days → OLS on real day offsets (test with a date gap).
* "Anomaly": spatial z-score, now labelled as such (not climatological); σ=0 → unavailable.
* Correlation: co-temporal fields only (currents excluded automatically); 9×9 cells ≈1.1° (was "~100 km mesoscale"); removed location-independent causal text.
* MLD: old code used 0.03 "PSU" (a density criterion) for salinity and a sign-unaware formula; now temperature ΔT=0.2 °C criterion, sign-aware (inversion test); model-level MLD only if ≥3 levels exist (none do) — the IBR MLD diagnostic is reported instead.
* "Scientific interpretation" asserted causes (heat flux, eddies) → deterministic factual summary, labelled no AI/ML.
* Labels fixed: "Operational Forecast Date", "5-Day Net Delta", "INCOIS NODC • MoES" footer, "Bio-ROMS 3.9".

## 9. Timeline Audit

New pure engine `frontend/src/timeline/timelineEngine.ts` (16 tests): only catalog timestamps; step → nearest real timestamp after the current one within range (never earlier, repeated or interpolated); speed only changes the tick interval; UTC inputs (old `datetime-local` drifted +5:30 in IST). Prompt example (1,2,3,5 June, step 2 d) visits 1,3,5 — VERIFIED. During browser verification my first rule ("first ≥ requested") skipped 4 of 12 IBR months (30-day cadence vs calendar month) — caught, fixed, regression-tested; live playback then visited all 12 steps with one tile request each (VERIFIED).

## 10. Cesium Audit

Fixed: hover readout and click-to-inspect never worked (`globe.pick` fails with globe translucency) → `camera.pickEllipsoid` (exact; no terrain); `selectedTime` missing from effect deps and stale in hover; stale async imagery could overwrite newer requests (sequence guard); EEZ/instrument/slice async init on destroyed viewer; EEZ outline disabled by needless ground clamping; current arrows screen-aligned (wrong heading when tilted) → aligned to local north; crude polygon land masks hid real ocean (Somali basin, Gulf of Aden) → removed; Esri/Cesium attribution was hidden → visible. Viewer is created once per mount; no reinitialisation on state changes.

## 11. Three.js Audit

Water-column modal: renderer/scene recreated on every variable switch, nothing disposed (GPU leak), Auto-Orbit toggle ineffective (stale closure), hardcoded 2024-06-01, fabricated walls/particles/strata, truncated Mackenzie formula (~5 m/s error). Rewritten: one renderer per open, full geometry/material/texture disposal, refs, ResizeObserver, Escape, real ±5° surface window, real Argo column with its own labelled range and observed MLD plane. 8 open/close cycles: canvas count back to 1, heap 63→61 MB, no warnings (VERIFIED). Landing hero (r3f) unchanged apart from copy.

## 12. Frontend Audit

Whole-store Zustand subscriptions caused every component (incl. the Cesium host) to re-render on each mouse move → `useShallow` selectors. Permalinks always opened Home (fixed). Static tile fallback path mismatch (`10.bin` vs `10.0.bin`) → canonical depth keys. Tile parser now validates var_code, data type and payload length. `VITE_API_BASE_URL` added (frontend previously could never reach a separate backend). API availability memoised on static hosting. Colour bars use the same scale geometry as tiles (log ticks were linear). Default "3D" buttons opened a point on land (78°E 12°N) → last clicked point or Bay of Bengal.

## 13. Backend Audit

Catalog-driven engine and routers; manifest previously returned the wrong grid (45–100°E, 550×450) and hardcoded dates; tiles only for catalogued (variable, date, depth) with date validation; WMS rewritten (dynamic capabilities, WMS 1.3.0 EPSG:4326 lat/lon order, EPSG:3857 no longer falsely advertised, no per-pixel polygon loop); NetCDF export previously squeezed the whole domain into any sub-bbox and invented depth levels → exact index subset; `/api/health` + `/api/catalog`; DB optional (no localhost default); GET no longer auto-seeds the DB; requirements trimmed (unused argopy/erddapy/copernicusmarine/scikit-image/xarray) and Pillow added (was only transitive).

## 14. API Audit (local, via gateway :4000 — VERIFIED)

`/health` 200 · `/api/health` 200 · `/api/catalog` 200 · `/api/variables` 200 · `/api/manifest/temperature` 200 · `/api/instruments` 200 · `/api/instruments/ARGO_2902120/profile` 200 · `/api/tiles/temperature/2019-07-28/0` 200 (582,432 B) · same at depth 100 → 404 JSON · `/api/tiles/currents/2024-12-31/0` 200 · `/api/comparison/ARGO_2902120?variable=temperature` 200 · `/api/comparison/ARGO_1902594?variable=salinity` 200 (available:false, reason) · analytics timeseries/anomalies/correlation/profile 200 · `/api/wms` GetCapabilities 200 XML, GetMap 200 PNG · `/api/export/netcdf` 200 · `POST /api/instruments/ingest` 503 (disabled) · `POST /api/auth/login` 503 (not configured). All < 150 ms.

## 15. Security Audit

Removed hardcoded `admin/password` (gateway) and browser auto-login (App.tsx). Scientific GETs public by design; mutating requests need HS256 JWT (disabled when `JWT_SECRET` unset) and data-service `X-Admin-Token` (constant-time compare, disabled when unset). Gateway CORS was `*` → env allow-list (foreign origin gets no ACAO header, VERIFIED); data-service no longer allows credentials. Compose: Postgres/Redis/MinIO/data-service bound to 127.0.0.1, hardcoded `JWT_SECRET: your_secure_secret_here` removed, anonymous MinIO bucket policy removed; default MinIO creds removed from code. Health no longer leaks filesystem paths. Instrument/profile IDs and tile dates validated (no path traversal). `upload_to_hf.py` reads `HF_TOKEN` from env. No secrets found in tracked files (grep).

## 16. Database / Storage Audit

PostGIS schema/models reviewed; Argo adapter now loads the catalogued QC'd profiles. MinIO only mirrors catalogued tiles. Redis only used by an empty Celery app. **NOT VERIFIED at runtime** (Docker daemon not running).

## 17. Docker Audit

`docker compose config -q` passes (VERIFIED). data-service image now builds from repo root and bundles the catalog (`OCEAN_DATA_ROOT=/app/data`, honours `$PORT`); root `.dockerignore` keeps the 9 GB `datasets/` out of the context; gateway healthcheck used `curl` (absent in node:alpine) → `wget`; `npm ci --only=production` → `--omit=dev`. Image builds **NOT VERIFIED** (daemon off).

## 18. Render Deployment Audit

No Render URL exists in the repo or any branch; common hostnames probed without a match — **NOT VERIFIED**. Root cause of the reported `/api/health` → "JWT_SECRET missing": gateway wrapped every `/api/*` in `requireAuth`, and no `/api/health` route existed; with a secret set it would have returned 401 to the public frontend. Old data-service image contained no tiles or profiles. Added `render.yaml` (data-service + gateway, health checks, env vars).

## 19. Vercel Deployment Audit

`sih-zeta-gilt.vercel.app`: static only (no vercel.json/functions since `5dd6cc20`); every dynamic `/api/*` 404; the app fell back to static synthetic tiles/profiles (VERIFIED by curl). `incois-ocean-3d.vercel.app` (cited in DEMO.md): older build with a Python function serving fabricated buoy profiles and synthetic tiles under a "STRICT_REAL_DATA_ZERO_SYNTHETIC" banner (VERIFIED). New static build tested locally on a plain static server: globe, timeline, tiles, profiles and comparisons work from static files; analytics show an explicit "API not deployed" state (VERIFIED).

## 20. Performance Audit

Entry JS 1,327 KB → 289 KB (gzip 373 → 86 KB) by lazy-loading the landing hero (three.js now a separate 746 KB chunk loaded only for the hero / water-column view). Tiles 93 MB → 28 MB. Removed per-mousemove full-app re-renders; instrument hover picking throttled to one per frame; tile LRU (48) with in-flight de-duplication; no duplicate API calls in a full session (VERIFIED). Not changed: Cesium.js is still loaded as a render-blocking script by vite-plugin-cesium.

## 21. Accessibility Audit

Added aria-labels to icon buttons, dialog roles/aria-modal, Escape to close all modals, tab/radio semantics, keyboard-operable timeline slider (←/→/Home/End, handled on the element so Cesium is unaffected), `aria-live` status bar, layer rows as buttons with `aria-pressed`, visible focus rings. Blue UI remnants (cyan/slate classes, slate chart chrome, neon-cyan arrows) replaced; blue remains only in data colour maps. Not audited: mobile layout (fixed side panels overlap at phone width).

## 22. Defects Found

P0 (10): synthetic tiles; ARMOR3D mislabelled as INCOIS ROMS; fabricated platforms; fabricated O₂/Chl/timestamps; synthetic & extrapolated currents; hardcoded credentials + client auto-login; temporally mismatched comparison with false QC/model claims; fabricated 3D stratification; C++ exporter fabricating dates; mock timeline. Plus public deployments serving synthetic data (not fixable from here).
P1 (19): Argo oldest-profile/QC/pressure/depth bugs; invalid NaN JSON; auth-blocked API & missing /api/health; wrong manifest grid/dates; NetCDF export misregistration; WMS defects; static tile path mismatch; imagery race; stale time deps; broken hover/click picking; permalinks; Three.js lifecycle/leaks; UTC drift; frontend unable to reach a backend; MLD method errors; timeseries slope; EEZ on destroyed viewer; modal bypassing fallback; C++ Bio-ROMS path.
P2 (17): log colour bar; Mackenzie truncation; O₂ units; Pearson n<3 / σ=0; tile var_code validation & date validation; CORS/compose exposure/default creds; hidden attribution; favicon 404; bundle size; speculative text & mislabels; gateway healthcheck; Dockerfile lacked data/PORT; hollow tests; misleading docs; polygon land masks; month-step skipping (own regression).
P3 (4): dead files; blue remnants; ARIA/keyboard; HF upload script.

## 23. Fixes Applied

All P0 except the live deployments, all P1 and P2, and the listed P3 items — see §5–§21 and `git diff` on the audit branch (87 tracked files changed, 71 new, 271 deleted incl. 160 synthetic tiles and old data copies).

## 24. Tests

| Suite | Result |
|---|---|
| data-service pytest (engine unit + real-catalog API) | **29 passed**, 0 failed, 3 library deprecation warnings |
| frontend vitest (timeline engine 16, colour scale 4, sound speed 3) | **23 passed** |
| C++ (g++ 16.2, C++20): TEOS10, QC filter, duplicate resolver, ENU, stride LOD, data integrity (real NetCDF) | **6/6 passed** |
| gateway `tsc` | pass |

Old tests were hollow: synthetic fixtures, assertions such as r > 0.90 on synthetic data, and skipped in CI via a path that never existed. CI now runs the real-data tests, frontend unit tests, the C++ ctest suite (except the dataset-dependent test) and `docker compose config`.

## 25. Browser Verification (built-in browser, local stack)

Landing → operational; real SST draped for 2019-12-25; 13 Argo markers; profile modal (2902120, cycle 262, 2021-05-02, MLD 27.3 m, thermocline 89.5 m, O₂/Chl correctly disabled); comparison modal (metrics above; no-overlap reason for BGC floats); analytics (12 monthly points, spatial z-score, correlation, summary); playback through all 12 months; currents status message off-date and vectors on 2024-12-31; water-column view; hover values equal tile bytes. Console: 0 errors, 0 uncaught exceptions; network: 0 unexplained 4xx/5xx, 0 duplicate API calls. Static-hosting build: 2 expected API probes, then static files only.

## 26. Build Verification

`tsc && vite build`: 3,346 modules, ~25 s; chunks: entry 289.7 KB (86 KB gz), `index` 54.5 KB, `demo` (hero) 289 KB, `LineChart` (Recharts) 384 KB, `three.module` 746 KB, `OceanWaterCubeModal` 37 KB, `InstrumentProfileModal` 12 KB. Lazy chunks load on demand (VERIFIED via network log).

## 27. Deployment Verification

Not deployed (outward-facing; requires your accounts). Both public URLs are **stale and serve synthetic data**. Render: URL unknown.

## 28. Final Acceptance Matrix

| Area | Status | Evidence | Fixed? |
|---|---|---|---|
| Git | VERIFIED | backup branch + audit branch, `git diff --check` clean | — |
| Data lineage | VERIFIED | catalog.json + 5 spot checks | yes |
| Zero-mock | VERIFIED (repo) / FALSE (public sites) | grep + tile forensics | yes (repo) |
| Argo | VERIFIED | source-level comparison | yes |
| QC | VERIFIED | per-parameter mode + flags | yes |
| TEOS-10 | VERIFIED | gsw; C++ within 4 mm | yes |
| Model | VERIFIED | IBR DOI, bilinear check | yes |
| Observation | VERIFIED | GDAC files | yes |
| Collocation | VERIFIED | ±15 d, native grid | yes |
| RMSE / MAE / Bias / Pearson / R² | VERIFIED | hand recomputation = served | yes |
| Timeline | VERIFIED | 16 tests + live playback | yes |
| Analytics | VERIFIED (API) | tests + UI | yes |
| Anomaly | VERIFIED | test; relabelled | yes |
| Correlation | VERIFIED | test | yes |
| Current vectors | VERIFIED | ARMOR3D, exact date | yes |
| Tiles | VERIFIED | header/var_code tests | yes |
| Cesium | VERIFIED | browser | yes |
| Three.js | VERIFIED | 8-cycle leak check | yes |
| Frontend | VERIFIED | build + browser | yes |
| Backend | VERIFIED | 29 tests | yes |
| Gateway | VERIFIED | smoke test | yes |
| Auth | VERIFIED | 503/401 paths | yes |
| CORS | VERIFIED | foreign origin refused | yes |
| Database / Redis / MinIO | NOT VERIFIED | daemon off | config fixed |
| WMS | VERIFIED | caps + PNG | yes |
| Docker | PARTIALLY VERIFIED | compose config only | yes |
| Render | NOT VERIFIED | no URL | blueprint added |
| Vercel | FALSE (current sites) | curl | needs redeploy |
| Performance | VERIFIED | bundle/network | yes |
| Security | VERIFIED (code) | review + tests | yes |
| Accessibility | PARTIALLY VERIFIED | keyboard/ARIA; mobile not done | partly |
| Tests | VERIFIED | 29 + 23 + 6 | yes |
| Build | VERIFIED | vite/tsc | yes |

## 29. Remaining Limitations

No subsurface gridded data (surface-only sources); model ends 2019-12 so only 2 floats have matchups; one current date; static hosting cannot run point analytics; mobile layout; Cesium.js render-blocking load; PostGIS/MinIO/Redis and Docker images not runtime-tested; public deployments unchanged; changes not committed.

## 30. Exact Next Steps

1. Review and commit the audit branch; merge when satisfied.
2. Take down or redeploy `incois-ocean-3d.vercel.app` (serves fabricated buoys) and redeploy `sih-zeta-gilt.vercel.app` from the merged branch.
3. Deploy `render.yaml` (data-service + gateway); set `CORS_ALLOWED_ORIGINS` to the Vercel origin and `DATA_SERVICE_URL`; rebuild Vercel with `VITE_API_BASE_URL=https://<gateway>.onrender.com`; verify `/api/health` and one tile, comparison and analytics call from the browser.
4. For subsurface or recent model fields, obtain a real 3D product (e.g. CMEMS GLORYS12 or INCOIS ROMS output with depth levels) and extend `build_authentic_dataset.py`; the frontend already lists depths from the catalog.
5. Start Docker and run `docker compose up --build`, then `seed_data.py`, to verify the PostGIS/MinIO paths.
6. Re-record the demo video (current one shows synthetic data).
