# Technical & Scientific Methodology

This document describes what the code in this repository actually does. Every method
named here is implemented in the files cited; limitations are listed in §9.

## 1. Data sources

| Dataset | File | Type | Coverage used | Provenance |
|---|---|---|---|---|
| INCOIS Bio-ROMS (IBR) surface fields | `datasets/model/INCOIS-BIO-ROMS.nc` | Numerical model (monthly) | SST, SSS, CHL, MLD; 1980-01-24 → 2019-12-25; **surface only** | INCOIS; P. K. Ghoshal, A. P. Joshi & K. Chakraborty; DOI [10.5281/zenodo.13802393](https://doi.org/10.5281/zenodo.13802393) |
| CMEMS ARMOR3D (MULTIOBS_GLO_PHY_TSUV_3D_MYNRT_015_012) | `datasets/cmems.nc` | Observation-based analysis (CLS) | `ugo`, `vgo` geostrophic surface velocity, 2024-12-31, depth 0 m | Copernicus Marine Service, dataset `cmems_obs-mob_glo_phy_my_0.125deg_P1D-m_202511` |
| Argo profiles | `datasets/coriolis/<WMO>/profiles/S*.nc`, `datasets/argo/incois_<WMO>_prof.nc` | In-situ observations | 13 floats | Argo GDAC (Coriolis / FR GDAC); data centre per float in the profile metadata |

`datasets/model/incois_roms_indian_ocean.nc` is byte-identical to `datasets/cmems.nc`
(ARMOR3D); it is **not** a ROMS output and is not used.

The source NetCDF files are not in git (size). Everything the application serves is
produced from them by one script:

```bash
pip install -r scripts/requirements-build.txt
python scripts/build_authentic_dataset.py --ibr-year 2019
```

Outputs (committed, served by both the API and static hosting) live in `frontend/public/`:
`tiles/`, `api/catalog.json`, `api/manifest/`, `api/variables.json`, `api/instruments.json`,
`api/profiles/`, `api/matchups/`, `api/comparison/`, `data/currents_uv.json`.

## 2. Gridded tiles

* **Grid:** 520 × 280 cells, 0.125°, cell centres 35.0625–99.9375°E, 9.9375°S–24.9375°N
  (identical to the ARMOR3D native grid subset). Row 0 is the southernmost row.
* **IBR regridding:** bilinear interpolation from the native 1/12° × ~0.072° grid to the
  0.125° cell centres (`scipy.interpolate.RegularGridInterpolator`, `method="linear"`). A
  target cell whose four source corners are not all ocean becomes NaN — no extrapolation.
* **Units:** IBR `CHL` is converted from kg m⁻³ to mg m⁻³ (× 10⁶). No other conversion.
* **Timesteps:** the twelve IBR timesteps of 2019, labelled with the dates stored in the
  source `TIME` variable (30-day spacing, e.g. 2019-01-29, 2019-02-28, …). ARMOR3D currents
  exist only for 2024-12-31.
* **Tile format:** 32-byte little-endian header (`INCO`, version, var_code, width, height,
  depth_count, data_type=1, min, max, 8 reserved) + float32 payload. Readers validate magic,
  data type, payload length and that `var_code` matches the requested variable
  (`data-service/app/analytics_engine.py::parse_tile`, `frontend/src/api/client.ts::parseOceanTileBuffer`).

## 3. Argo processing (`scripts/build_authentic_dataset.py`)

* **Profile acceptance:** ascending profiles (`DIRECTION = 'A'`) with `JULD_QC` and
  `POSITION_QC` equal to 1 or 2.
* **Parameter values:** for each parameter the data mode (`PARAMETER_DATA_MODE` in
  synthetic-profile files, `DATA_MODE` otherwise) decides the field: `*_ADJUSTED` for A/D,
  raw for R. Only QC flags **1 and 2** are kept, and the pressure at that level must also be
  QC 1/2. Values that fail are `null`; nothing is filled.
* **Depth:** TEOS-10 `gsw.z_from_p(pressure, latitude)`. The C++ core uses the UNESCO 1983
  (Saunders & Fofonoff) formula; the two agree to < 5 mm at 2000 dbar (checked in the audit).
* **Latest profile:** the acceptable profile with the greatest `JULD` for each float.
* **Levels served:** core levels are sub-sampled by a fixed stride to ≤ 200 (the deepest level
  is always kept); DOXY and CHLA levels to ≤ 150 each. Only measured levels are served.
* **Units:** temperature °C (ITS-90), salinity PSS-78, oxygen µmol kg⁻¹ (no conversion),
  chlorophyll mg m⁻³.

## 4. Model–observation comparison

Implemented in `analytics_engine.compute_model_vs_obs`; pairs are prepared by the build
script against the **native** IBR grid.

1. **Observation:** for every acceptable ascending profile of the float, the shallowest
   QC-good level with depth ≤ 10 m.
2. **Temporal matching:** nearest IBR timestep; the pair is kept only if |Δt| ≤ 15 days.
3. **Spatial matching:** bilinear interpolation between the four surrounding native cells;
   all four must be ocean or the pair is rejected.
4. **Vertical:** none — IBR has surface fields only, so the comparison is a surface matchup
   series, not a vertical profile comparison.
5. **Metrics** (model − observation): N, RMSE = √mean(r²), MAE = mean|r|, bias = mean(r),
   Pearson r (only when N ≥ 3 and both series have non-zero variance) and r² (the square
   of Pearson r, not a regression skill score).

Excluded profiles are counted by reason (outside model time coverage, no near-surface
observation, model has no data at the location). Floats without temporal overlap return
`available: false` with the two time spans. In this release two floats overlap the model:
WMO 2902120 (210 pairs, 2014–2020) and WMO 2902084 (52 pairs, 2012–2014).

## 5. Point analytics (`analytics_engine.py`)

* **Sampling:** cell-centre bilinear interpolation; `None` outside the domain or when the
  nearest cell is NaN. NaN corners are dropped and weights renormalised.
* **Time series:** every catalogued timestep; trend = ordinary least squares on the actual
  day offsets (reported per day and per 30 days). The seasonal cycle is not removed.
* **Spatial z-score:** z = (x − μ)/σ where μ, σ are over all valid cells of the same field
  (same date and depth). This is a spatial departure, not a climatological anomaly.
  Undefined when σ = 0.
* **Correlation:** Pearson r between co-temporal fields over a 9 × 9-cell (≈ 1.1°)
  window; requires ≥ 5 co-valid cells. Cells are autocorrelated, so no significance is claimed.
* **Vertical structure:** the gridded fields have one level, so this returns
  `available: false` and reports the IBR model's own MLD diagnostic at the point.
* **Observed MLD / thermocline (Argo):** MLD = first depth below 10 m where
  |T − T(10 m)| ≥ 0.2 °C (de Boyer Montégut et al., 2004), linearly interpolated between
  measured levels; thermocline = mid-depth of the largest downward temperature decrease
  rate between consecutive levels below the MLD (≤ 1000 m).

## 6. Timeline (`frontend/src/timeline/timelineEngine.ts`)

The timeline only ever selects timestamps listed in the catalog for the selected variable.
A time step moves the *requested* time; the result is the real timestamp nearest to the
request among those after the current one and inside the chosen range (never earlier,
never repeated, never interpolated). Playback speed only changes the interval between steps.
Date inputs are interpreted as UTC. Unit tests cover the gap example
(1, 2, 3, 5 June with a 2-day step visits 1, 3, 5 June) and the 30-day model cadence.

## 7. Rendering

* **Cesium globe:** the selected field is rendered to a canvas (linear or log₁₀ colour scale,
  NaN transparent) and draped as a single imagery layer over the grid bbox. Only the most
  recent request can replace the layer; a missing tile removes the old one and shows a
  status message. Current arrows are placed on the real 1° ARMOR3D vector grid, oriented to
  local north, coloured by speed, and shown only when the timeline is on 2024-12-31.
* **Colour bars** use the same scale geometry as the tiles (`frontend/src/rendering/scale.ts`).
* **Three.js water-column view:** a 0–2000 m reference frame. The top face shows the real
  surface field (±5° window); the depth plane is textured only on a real level; the nearest
  Argo profile is drawn as a column of measured levels with its observed MLD. Nothing is
  painted below the surface from the gridded data.

## 8. Services

* **data-service (FastAPI):** serves the catalog, tiles, profiles, comparison, analytics,
  WMS 1.3.0 (EPSG:4326 lat/lon axis order, CRS:84) and CF-1.8 NetCDF export (exact subset of
  catalogued tiles). PostGIS/MinIO are optional mirrors populated by `seed_data.py`.
* **gateway (Express):** public read-only proxy for `GET /api/*`; mutating requests require an
  HS256 JWT and are disabled when `JWT_SECRET` is unset; per-IP rate limit; env-driven CORS.

## 9. Limitations

* No subsurface gridded data: depth slicing below 0 m shows no data by design.
* IBR coverage ends 2019-12-25; recent Argo floats (2022–2026) have no model counterpart.
* The only current field is a single ARMOR3D day; geostrophic velocities near the equator
  are unreliable.
* Static hosting (Vercel) cannot compute point analytics; set `VITE_API_BASE_URL` to a
  running data-service/gateway.

## 10. Disaster Early Warning layers

Built by `scripts/build_authentic_dataset.py --hazards-only` (IBR monthly layers) and
`scripts/build_ext_products.py` (external datasets, downloaded by `scripts/download_external.py`),
served by `data-service/app/analytics_engine.py` and `data-service/app/ext_hazards.py` under
`/api/hazards/*`. Products live in the Hugging Face dataset repo under `ext_products/`; raw source
subsets under `ext_raw/`. `scripts/nrt_update.py` (daily GitHub Action `nrt-ingest.yml`) refreshes the
daily products and republishes them; the service re-checks Hugging Face every
`EXT_PRODUCTS_REFRESH_HOURS` (default 6).

| Layer | Data | Method | Main caveat |
|---|---|---|---|
| MHW, monthly, fixed | IBR SST 1980–2019 | Hobday et al. (2018) ratio vs per-cell monthly mean / p90, **1990–2019** baseline | No ≥5-day rule on monthly data |
| MHW, monthly, detrended | IBR SST | per-cell linear trend of the deseasonalised record removed relative to the baseline midpoint, then mean / p90 (Jacox et al. 2020) | Linear trend only |
| Chlorophyll bloom anomaly | IBR CHL | same ratio on log10(CHL), 1990–2019 | Biomass, not harmful species |
| MHW, daily | NOAA OISST v2.1 1982–present, 0.25° | Hobday et al. (2016): day-of-year climatology and 90th percentile (11-day window, 31-day smoothing), 1991–2020; events ≥ 5 days, gaps ≤ 2 days joined | Interpolated satellite analysis |
| Degree Heating Weeks | OISST | NOAA CRW v3.1: MMM from 1985–2012 monthly means recentred to 1988.2857; DHW = Σ HotSpot≥1 over 84 d / 7 | CRW uses 5 km CoralTemp |
| TCHP | HYCOM ESPC-D-V02 3-D temperature (00 UTC) | Leipper & Volgenau (1972), ρ = 1025 kg m⁻³, c_p = 3992 J kg⁻¹ K⁻¹ | Model analysis |
| GPI | NCEP/NCAR R1 monthly + OISST | Emanuel & Nolan (2004); potential intensity by tcpyPI (Bister & Emanuel 2002; Gilford 2021) | 2.5°; R1 humidity above 300 hPa treated as 0; R1 monthly updates end early 2026 |
| Eddy convergence, same day | OISST + daily-mean HYCOM total current | SST ≥ 26.5 °C and cyclonic relative vorticity | Ocean-only indicator |
| Cyclone tracks | IBTrACS v04r01 NI + SI | WMO-agency (IMD) winds, else JTWC | Recent seasons provisional |

**Drift.** RK4 (30 min) through 3-hourly HYCOM total surface currents plus *windage* × GFS 10 m wind
(0 %, 1 % or 3 % presets; the 3 % oil rule includes wave-induced drift empirically), bilinear in space and
linear in time. Ensemble: member 0 deterministic; others with a Gaussian start perturbation (σ = 1 km),
±30 % windage and a random walk dx = √(2KΔt)·N(0,1) (K = 50 m² s⁻¹ default). Windage, K and σ are
**assumptions** and are labelled as such in every response; the cone is the 2-σ covariance ellipse of the
members. Particles strand at the last ocean cell of the 1/8° grid.

**Drift skill.** 72-h segments of NOAA GDP 6-hourly drifters (Apr–May 2025) are hindcast with (a) the
previous static ARMOR3D geostrophic snapshot, (b) HYCOM currents, (c) HYCOM + 1 % NCEP R2 wind, and scored by
separation at 24/48/72 h and the Liu & Weisberg (2011) skill score (`/api/hazards/drift/skill`).

**Validation against storms.** `/api/hazards/validation`: GPI at IBTrACS genesis points (first fix ≥ 34 kt)
versus all North Indian Ocean cells of the same month; OISST at genesis versus 26.5 °C; monthly MHW indices
at genesis.

**Export.** `/api/hazards/advisories.geojson` (bounding boxes of flagged regions) and
`/api/hazards/advisories.cap.xml` (OASIS CAP 1.2, certainty "Observed", urgency "Unknown", with a note that
this is a research prototype, not an official INCOIS warning).

**Sources not used.** CMEMS (total currents, Stokes drift, ARMOR3D 3-D) and ERA5 need accounts; the CMEMS
credentials provided were rejected by the Copernicus login service ("Invalid user credentials"), so HYCOM,
GFS and NCEP R1/R2 (public, no login) were used instead.

## References

* de Boyer Montégut, C., et al. (2004). Mixed layer depth over the global ocean. *JGR*, 109, C12003.
* IOC, SCOR & IAPSO (2010). *TEOS-10*. Manuals and Guides No. 56, UNESCO.
* Argo Data Management Team. *Argo user's manual*. doi:10.13155/29825.
* Ghoshal, P. K., Joshi, A. P., & Chakraborty, K. INCOIS Bio-ROMS data. doi:10.5281/zenodo.13802393.
* Hobday, A. J., et al. (2016). A hierarchical approach to defining marine heatwaves. *Prog. Oceanogr.*, 141, 227–238.
* Hobday, A. J., et al. (2018). Categorizing and naming marine heatwaves. *Oceanography*, 31(2), 162–173.
* Jacox, M. G., et al. (2020). Thermal displacement by marine heatwaves. *Nature*, 584, 82–86.
* Huang, B., et al. (2021). Improvements of the Daily Optimum Interpolation SST (DOISST) v2.1. *J. Climate*, 34, 2923–2939.
* Liu, G., et al. (2014). Reef-scale thermal stress monitoring of coral ecosystems. *Remote Sens.*, 6, 11579–11606.
* Leipper, D. F., & Volgenau, D. (1972). Hurricane heat potential of the Gulf of Mexico. *J. Phys. Oceanogr.*, 2, 218–224.
* Mainelli, M., et al. (2008). Application of oceanic heat content estimation to operational forecasting. *Wea. Forecasting*, 23, 3–16.
* Emanuel, K., & Nolan, D. S. (2004). Tropical cyclone activity and the global climate system. *26th Conf. Hurricanes Trop. Meteor.*, AMS.
* Bister, M., & Emanuel, K. A. (2002). Low frequency variability of tropical cyclone potential intensity. *JGR*, 107(D24), 4801.
* Gilford, D. M. (2021). pyPI (v1.3): Tropical cyclone potential intensity calculations in Python. *Geosci. Model Dev.*, 14, 2351–2369.
* Kalnay, E., et al. (1996). The NCEP/NCAR 40-year reanalysis project. *BAMS*, 77, 437–471.
* Knapp, K. R., et al. (2010). The International Best Track Archive for Climate Stewardship (IBTrACS). *BAMS*, 91, 363–376.
* Liu, Y., & Weisberg, R. H. (2011). Evaluation of trajectory modeling in different dynamic regions using normalized cumulative Lagrangian separation. *JGR*, 116, C09013.
* ASCE Task Committee on Modeling of Oil Spills (1996). State-of-the-art review of modeling transport and fate of oil spills. *J. Hydraul. Eng.*, 122(11), 594–609.
* Lumpkin, R., & Centurioni, L. (2019). Global Drifter Program quality-controlled 6-hour interpolated data. NOAA NCEI. doi:10.25921/7ntx-z961.
