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
* **Sound speed** (water-column view): Mackenzie (1981) nine-term equation from the
  measured T, S and depth; check value 1550.744 m s⁻¹ at (25 °C, 35, 1000 m).

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

## References

* de Boyer Montégut, C., et al. (2004). Mixed layer depth over the global ocean. *JGR*, 109, C12003.
* Mackenzie, K. V. (1981). Nine-term equation for sound speed in the oceans. *JASA*, 70(3), 807–812.
* IOC, SCOR & IAPSO (2010). *TEOS-10*. Manuals and Guides No. 56, UNESCO.
* Argo Data Management Team. *Argo user's manual*. doi:10.13155/29825.
* Ghoshal, P. K., Joshi, A. P., & Chakraborty, K. INCOIS Bio-ROMS data. doi:10.5281/zenodo.13802393.
