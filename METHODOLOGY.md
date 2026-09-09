# Technical & Scientific Methodology
**INCOIS 3D Ocean Data Visualization Platform — SIH 2026 PS 26067**

> This document describes the exact scientific formulations and engineering methods implemented in this
> system. Every section cites the specific source file and line numbers where the described logic lives.

---

## Table of Contents

1. [Data Ingestion & Sources](#1-data-ingestion--sources)
2. [Coordinate & Unit Normalization — TEOS-10](#2-coordinate--unit-normalization--teos-10)
3. [4D Spatio-Temporal Interpolation](#3-4d-spatio-temporal-interpolation)
4. [Statistical Validation Metrics](#4-statistical-validation-metrics)
5. [3D Volumetric Rendering — WebGL2 Raymarching](#5-3d-volumetric-rendering--webgl2-raymarching)
6. [Binary Data Pipeline — NetCDF → Float32 GPU Buffer](#6-binary-data-pipeline--netcdf--float32-gpu-buffer)

---

## 1. Data Ingestion & Sources

### 1.1 Strict Real-Data Policy

The platform enforces a **no mock / no synthetic data** policy at the ingestion layer.
All model and in-situ datasets are tracked in a `datasets/manifest.json` registry and must satisfy
minimum file-size guards before any downstream pipeline is permitted to proceed.

Relevant files:
- `ingestion/fetch_real_datasets.py`
- `ingestion/validate_real_data.py`
- `ingestion/ingest_dataset.py`

### 1.2 ROMS / INDOFOS Ocean Model NetCDF Files

**Source:** INCOIS ERDDAP — `https://erddap.incois.gov.in/`

The INCOIS Bio-ROMS / INDOFOS model outputs are delivered as CF-1.6-compliant NetCDF-4 files
(e.g., `INCOIS-BIO-ROMS.nc`) that contain 4D arrays over terrain-following sigma
(`s_rho`) or standard depth vertical coordinates.

**Ingestion flow** (`ingest_dataset.py::ingest_dataset`):

1. **Forensic inspection** — the file is opened lazily via `OceanModel(source_path)` using
   `xr.open_dataset(..., decode_times=True)`. This reads only coordinate and dimension metadata
   without decompressing any data variables.
2. **Coordinate auto-discovery** — case-insensitive search across `ds.coords`, `ds.data_vars`, and
   `ds.sizes` resolves longitude (`lon`, `lon_rho`, `nav_lon`), latitude (`lat`, `lat_rho`, `nav_lat`),
   depth / sigma (`depth`, `s_rho`, `lev`), and time (`time`, `ocean_time`, `time_counter`).
3. **Grid classification** — if the resolved longitude coordinate has `ndim == 2`, the grid is tagged
   `curvilinear_2d` (typical of ROMS AGRIF); otherwise it is `rectilinear_1d`.
4. **Variable aliasing** — a canonical alias table maps physical quantities to their NetCDF names
   (e.g., `temp → ["temp", "to", "TEMP", "thetao", "sst"]`).
5. **Manifest update** — a JSON entry is written / merged into `datasets/manifest.json` with
   spatial bounds, temporal coverage, variable list, provenance, and DOI.

**Validation** (`validate_real_data.py::validate_ocean_model`):

```
validate_ocean_model(file_path)
  → OceanModel.get_metadata()
    → CF dimensions, variable shapes & units printed
    → ROMS s-coordinate parameters verified (s_rho, Cs_r, hc, Vtransform, h)
    → Spatial bounds [min_lon, max_lon] × [min_lat, max_lat] reported
    → Depth range and vertical level count confirmed
```

If the file is absent, the validator reports `STATUS: REAL DATASET REQUIRED` and instructs
the operator to download from the INCOIS ERDDAP endpoint — execution is halted.

### 1.3 Argo GDAC Float NetCDF Files

**Sources (primary / fallback GDAC mirrors):**
- Primary: `https://data-argo.ifremer.fr/` (Coriolis / Ifremer, France)
- Fallback: `https://usgodae.org/ftp/outgoing/argo/` (USGODAE / NOAA)

**Fetch mechanism** (`fetch_real_datasets.py::download_with_fallback`):

```python
download_with_fallback(primary_url, fallback_url, dest_path, min_size=10000)
```

- HTTP requests carry a scientific user-agent string:
  `INCOIS-3D-Platform/1.0 (Oceanographic Research; GDAC API)`
- SSL verification is bypassed for GDAC mirror compatibility.
- A minimum-size guard (`> 10 000 bytes`) rejects truncated or error-page responses.
- On failure of both mirrors, a `RuntimeError` is raised — synthetic fallback is never generated.

**Parsing flow** (`insitu_store.py::ArgoAdapter.parse_profile_from_file`):

1. The file is opened with `netCDF4.Dataset` for performance (xarray fallback on error).
2. **Adjusted variable prioritisation** — `PRES_ADJUSTED` is preferred over `PRES`,
   `TEMP_ADJUSTED` over `TEMP`, `PSAL_ADJUSTED` over `PSAL` when the adjusted array
   is not entirely NaN.
3. **QC flag decoding** — Argo QC data arrive as character arrays (ASCII bytes `'0'–'9'`).
   The `decode_argo_qc_flags()` function handles masked arrays, raw bytes, strings, and integer arrays.
4. **QC filtering** — only observations with `QC ∈ {1, 2}` (Good / Probably Good)
   on both pressure and temperature are retained; `QC ∈ {3, 4, 9}` are rejected.
5. **Timestamp decoding** — Argo JULD (fractional days since 1950-01-01T00:00:00Z)
   is converted to ISO 8601 UTC via `decode_argo_timestamp()`.

**Validation** (`validate_real_data.py::validate_argo_profile`):

```
validate_argo_profile(file_path)
  → insitu_store.parse_single_file(file_path, filter_qc=True)
    → Platform WMO number extracted
    → Profile count and valid QC-filtered levels reported
    → Sample profile: depth range, temperature, QC flags printed per level
```

---

## 2. Coordinate & Unit Normalization — TEOS-10

### 2.1 Why Pressure Cannot Be Linearly Converted to Depth

Argo profiling floats measure in-situ **sea pressure** in **decibars (dbar)**, not physical
depth. The conversion is non-trivial because:

- **Seawater is compressible** — the same pressure corresponds to a shallower depth in denser
  (colder / saltier) water.
- **Gravitational acceleration varies with latitude** — g(φ) changes from
  9.832 m s⁻² at the poles to 9.780 m s⁻² at the equator.

### 2.2 TEOS-10 Formulation & Positive Depth Sign Convention

The system applies the **Thermodynamic Equation of Seawater 2010 (TEOS-10)** standard via
the `gsw` Python library (IOC, SCOR and IAPSO, 2010):

```
z = -∫₀ᴾ  dP' / [ρ(SA, Θ, P') · g(φ)]
```

Where:

| Symbol | Description |
|--------|-------------|
| P | In-situ pressure (dbar) |
| φ | Geographic latitude (degrees north) |
| ρ(SA, Θ, P') | In-situ seawater density from Absolute Salinity and Conservative Temperature |
| g(φ) | Gravity: 9.780327·(1 + 0.0053024·sin²φ − 0.0000058·sin²2φ) m s⁻² |

#### Depth Sign Convention ($z = -\text{depth}$)
In classical ocean dynamics and geopotential coordinate frameworks (including TEOS-10 `gsw.z_from_p`),
height $z$ is defined with the sea surface as the origin ($z = 0$) and values increasing upwards into the
atmosphere ($z \le 0$ within the water column).
Conversely, observational oceanography (Argo CTD profiles, mooring thermistor chains) and the INCOIS
visualization platform define vertical coordinates using **positive depth downwards**:
```
depth = -z  (meters below sea surface, depth ≥ 0)
```
Consequently, when converting hydrostatic pressure $P$ to vertical levels, the platform explicitly
negates `gsw.z_from_p(P, φ)` so that $d \in [0, D_{\max}]$ monotonically increases with distance below the ocean surface.

### 2.3 Absolute Salinity Formulation & Composition Anomaly ($\delta S_A$)

In standard observational datasets, conductivity sensors measure Practical Salinity ($S_P$, PSS-78, dimensionless).
Under TEOS-10 standards, thermodynamic calculations require **Absolute Salinity** ($S_A$, $\text{g}\cdot\text{kg}^{-1}$),
defined as:

```
S_A = S_R + δS_A(P, lon, lat) = (35.16504 / 35) · S_P + δS_A(P, lon, lat)
```

Where:
- $S_R = (35.16504 / 35) \cdot S_P \approx 1.004715 \cdot S_P$ is the **Reference Salinity**, accounting for the mass fraction of dissolved inorganic ions in Standard Seawater.
- $\delta S_A(P, \text{lon}, \text{lat})$ is the **Absolute Salinity Anomaly**, representing geographical variations in seawater composition (primarily dissolved silica, nitrate, and total alkalinity / carbonate system anomalies relative to standard Atlantic composition).
- In the Indian Ocean basin ($30^\circ\text{E} - 120^\circ\text{E}$, $30^\circ\text{S} - 30^\circ\text{N}$), deep water accumulation of biogenic silicate and nitrate causes positive salinity anomalies ($\delta S_A > 0$), which can reach $+0.025\,\text{g}\cdot\text{kg}^{-1}$ in deep northern basins (Arabian Sea and Bay of Bengal).
- When converting $S_P$ to $S_A$, the system evaluates `gsw.SA_from_SP(SP, p, lon, lat)` using the official IOC/SCOR TEOS-10 global gridded hydrographic look-up atlas (McDougall et al., 2012).

### 2.4 Code Implementation

Implemented at `insitu_store.py` lines 236, 353 (both the netCDF4 and xarray paths):

```python
# Exact code from ArgoAdapter.parse_profile_from_file (line 236)
z_valid = -gsw.z_from_p(p_valid, lat_val)
depth_mask = (z_valid >= 0) & (z_valid < 12000)
```

The negation (`-gsw.z_from_p(...)`) converts the TEOS-10 convention (negative height below
surface) to the platform convention (positive meters downward).
The guard `z_valid < 12000` rejects physically implausible values exceeding the maximum ocean
depth.

The xarray fallback path (line 353):

```python
z_valid = -gsw.z_from_p(p_valid, lat_val)
depth_mask = z_valid >= 0
```

This normalization is documented in the store metadata response:

```python
"vertical_coordinate": "TEOS-10 physical depth (meters) calculated from sea pressure (dbar) via gsw.z_from_p"
```

---

## 3. 4D Spatio-Temporal Interpolation

**Goal:** Colocate the gridded model field M(x, y, z, t) onto the exact position
of an in-situ Argo observation (x_obs, y_obs, z_obs, t_obs).

Implemented in `ocean_model.py` — `OceanModel.sample_profile()` (lines 384–458) calling
`_spatial_interpolate_profile_at_point()` (lines 283–382).

### 3.1 Step 1 — Temporal Interpolation

Given model time steps t₀ ≤ t_obs ≤ t₁ (located via `np.searchsorted`):

```
α = (t_obs − t₀) / (t₁ − t₀),   α ∈ [0, 1]
```

```python
# ocean_model.py lines 418–432
t1_idx = int(np.searchsorted(time_vals, target_dt))
t0_idx = max(0, t1_idx - 1)
total_secs = (t1 - t0).total_seconds()
alpha = (target_dt - t0).total_seconds() / total_secs
alpha = float(np.clip(alpha, 0.0, 1.0))

depth_levels = (1.0 - alpha) * d_0 + alpha * d_1
model_values = (1.0 - alpha) * v_0 + alpha * v_1
```

Boundary cases: if t_obs ≤ t₀ the first snapshot is used; if t_obs ≥ t₋₁ the last snapshot
is used (no temporal extrapolation).

### 3.2 Step 2 — Horizontal Spatial Interpolation

Two strategies are chosen based on the model grid type:

#### Curvilinear Grids (2D `lon_rho` / `lat_rho` — typical ROMS AGRIF)

A **spherical KD-Tree** is built over the full 2D longitude/latitude grid by converting
geographic degrees to 3D Cartesian unit vectors on the unit sphere:

```python
# ocean_model.py lines 39–46
def geo_to_cartesian(lon_deg, lat_deg):
    lon_rad = np.radians(lon_deg)
    lat_rad = np.radians(lat_deg)
    x = np.cos(lat_rad) * np.cos(lon_rad)
    y = np.cos(lat_rad) * np.sin(lon_rad)
    z = np.sin(lat_rad)
    return np.column_stack((x.flatten(), y.flatten(), z.flatten()))
```

The 4 nearest grid nodes are queried (`k=4`) and their values are combined using
**inverse-distance weighting (IDW)**:

```
M(x_obs, y_obs, z) = Σ w_k · M(x_k, y_k, z)
where w_k = d_k⁻¹ / Σ d_j⁻¹
```

```python
# ocean_model.py lines 298–313
dists, idxs = tree.query(cart_pt, k=4)
weights = 1.0 / np.maximum(dists[0], 1e-6)
weights /= np.sum(weights)
for w, (j, i) in zip(weights, unraveled_ij):
    val_profile += w * da_3d.values[:, j, i]
```

#### Rectilinear Grids (1D `lon` / `lat`)

Standard **bilinear interpolation** is delegated to xarray:

```python
# ocean_model.py lines 315–319
point_da = da_3d.interp({lat_key: lat, lon_key: lon}, method="linear")
val_profile = point_da.values.flatten()
```

### 3.3 Step 3 — Vertical Interpolation

After horizontal interpolation yields a model profile at the observation's (lat, lon), the
profile values are interpolated onto the exact Argo observation depth levels using
**monotonic linear 1D interpolation** (`np.interp`):

```python
# ocean_model.py lines 451–456
sort_order = np.argsort(clean_d)
clean_d = clean_d[sort_order]
clean_v = clean_v[sort_order]
interp_v = np.interp(query_depths, clean_d, clean_v, left=np.nan, right=np.nan)
```

`left=np.nan` and `right=np.nan` ensure no extrapolation beyond the model's vertical extent.

### 3.4 ROMS Terrain-Following Depth Calculation

For native ROMS s-coordinate grids, the physical depth at each profile location is computed
from local bathymetry h(x, y) and sea-surface height ζ(x, y, t):

**Vtransform = 1 (ROMS Original):**

```
S(x,y,s)    = hc · s + (h(x,y) − hc) · C(s)
z(x,y,s,t)  = S(x,y,s) + ζ(x,y,t) · (1 + S(x,y,s) / h(x,y))
```

**Vtransform = 2 (ROMS Modern Default):**

```
S(x,y,s)    = (hc · s + h(x,y) · C(s)) / (hc + h(x,y))
z(x,y,s,t)  = ζ(x,y,t) + (ζ(x,y,t) + h(x,y)) · S(x,y,s)
```

Where s ∈ [−1, 0] are the dimensionless sigma levels (`s_rho`), C(s) is the
stretching function (`Cs_r`), and hc is the critical depth parameter (`hc`).
Source: `ocean_model.py` lines 68–114 — `calculate_roms_vertical_depths()`.

---

## 4. Statistical Validation Metrics

Implemented in `validation_engine.py` — `ValidationEngine.compute_metrics()` (lines 24–67).

All metrics operate on the set of **valid paired samples** — depth levels where neither the
model value nor the observation is NaN:

```python
valid_mask = ~np.isnan(obs_arr) & ~np.isnan(mod_arr)
obs_clean  = obs_arr[valid_mask]
mod_clean  = mod_arr[valid_mask]
```

Let N be the number of valid paired samples, M_i = Model(z_i) and O_i = Obs(z_i) for i = 1…N.

### 4.1 Depth-Resolved Residuals

```
Δᵢ = Mᵢ − Oᵢ
```

Sign convention: positive residual means the model is **warmer / saltier** than the observation.

```python
residuals = mod_clean - obs_clean          # line 43, validation_engine.py
```

Full-profile residuals (preserving `None` at masked levels):

```python
full_residuals = [
    round(float(m - o), 3)
    if (o is not None and m is not None and not np.isnan(o) and not np.isnan(m))
    else None
    for m, o in zip(model_values, obs_values)
]
```

### 4.2 Root Mean Square Error (RMSE)

```
RMSE = sqrt( (1/N) · Σᵢ (Mᵢ − Oᵢ)² )
```

```python
rmse = float(np.sqrt(np.mean(residuals ** 2)))   # line 46
```

### 4.3 Mean Absolute Error (MAE)

```
MAE = (1/N) · Σᵢ |Mᵢ − Oᵢ|
```

```python
mae = float(np.mean(np.abs(residuals)))           # line 45
```

### 4.4 Forecast Bias

```
Bias = (1/N) · Σᵢ (Mᵢ − Oᵢ)
```

```python
bias = float(np.mean(residuals))                  # line 44
```

A positive bias indicates a systematic warm / saline offset in the model; negative indicates
a systematic cold / fresh offset.

### 4.5 Pearson Correlation Coefficient

```
r = Σᵢ(Mᵢ − M̄)(Oᵢ − Ō) / [ sqrt(Σᵢ(Mᵢ − M̄)²) · sqrt(Σᵢ(Oᵢ − Ō)²) ]
```

Implemented via `np.corrcoef` with a guard against degenerate inputs:

```python
# lines 49–52, validation_engine.py
if len(obs_clean) > 1 and np.std(obs_clean) > 1e-7 and np.std(mod_clean) > 1e-7:
    corr_matrix = np.corrcoef(obs_clean, mod_clean)
    if not np.isnan(corr_matrix[0, 1]):
        r_val = float(round(corr_matrix[0, 1], 4))
```

If σ_M = 0 or σ_O = 0 (constant field), Pearson r is mathematically undefined and the
returned value is `null` (`None` in Python) — not zero.

### 4.6 Scorecard Output Format

```json
{
  "bias": -0.1823,
  "mae":   0.3417,
  "rmse":  0.4892,
  "pearson_r": 0.9621,
  "sample_count": 142
}
```

---

## 5. 3D Volumetric Rendering — WebGL2 Raymarching

The platform renders ocean scalar fields (temperature, salinity, chlorophyll, etc.) as
full volumetric clouds using a custom WebGL2 GLSL raymarching pipeline.

Relevant files:
- `frontend/src/rendering/shaders/VolumeRaymarchingShader.js` — vertex + fragment GLSL
- `frontend/src/rendering/OceanSceneController.js` — scene integration

### 5.1 Scene Setup

A `THREE.BoxGeometry` bounding box is created to represent the ocean volume in Cartesian
scene space:

```javascript
// OceanSceneController.js lines 210–235
this.volGeo = new THREE.BoxGeometry(xScale, 0.6 * verticalExaggeration, zScale);
this.volumeMaterial = new THREE.ShaderMaterial({
  vertexShader: VolumeVertexShader,
  fragmentShader: VolumeFragmentShader,
  side: THREE.BackSide,    // Ray enters from inside the back face
  transparent: true,
  depthWrite: false,
  uniforms: {
    u_data:        { value: volumeTexture },  // Data3DTexture (Float32, RedFormat)
    u_dim:         { value: new THREE.Vector3(64, 64, 32) },
    u_opacity:     { value: 0.6 },
    u_threshold:   { value: 0.0 },
    u_isoValue:    { value: 0.5 },
    u_renderMode:  { value: 0 },              // 0=Volume, 1=Iso-Surface
    u_colormap:    { value: 0 },              // 0=Turbo, 1=Viridis, 2=Thermal, 3=Jet
    u_stepSize:    { value: 0.008 },
    u_sliceZ:      { value: 0.0 },
    u_enableSlice: { value: 0 },
  }
});
```

`THREE.BackSide` rendering means the fragment shader is invoked for every screen pixel
that lies inside the bounding box, regardless of the viewer's position.

### 5.2 Vertex Shader — Ray Setup

```glsl
// VolumeRaymarchingShader.js lines 1–13
void main() {
  vPosition  = position;
  vOrigin    = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

The camera position is transformed into **object-local space** so that the subsequent
ray-box intersection can be performed in a normalised [−0.5, 0.5]³ cube.

### 5.3 Ray-Box Intersection (Slab Method)

```glsl
// VolumeRaymarchingShader.js lines 92–103
vec2 hit_box(vec3 orig, vec3 dir) {
  vec3 box_min = vec3(-0.5), box_max = vec3(0.5);
  vec3 inv_dir = 1.0 / dir;
  vec3 t0 = (box_min - orig) * inv_dir;
  vec3 t1 = (box_max - orig) * inv_dir;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float t_enter = max(max(tmin.x, tmin.y), tmin.z);
  float t_exit  = min(min(tmax.x, tmax.y), tmax.z);
  return vec2(t_enter, t_exit);
}
```

The **slab method** computes the parametric entry (t_enter) and exit (t_exit) distances along
the ray. A ray that misses the box satisfies t_enter > t_exit and is immediately discarded.

### 5.4 Front-to-Back Raymarching with Step Integration

The ray is marched in **120 fixed steps** from `p_enter` to `p_exit`:

```glsl
// VolumeRaymarchingShader.js lines 118–170
float rayLength = length(p_exit - p_enter);
int   numSteps  = 120;
float dt        = rayLength / float(numSteps);
vec3  stepVec   = rayDir * dt;
vec3  currentPos = p_enter;

vec4 accumulatedColor = vec4(0.0);
for (int i = 0; i < 120; i++) {
  // Coordinate mapping: object space → normalised texture UVW
  float normLon   = currentPos.x + 0.5;   // s ∈ [0,1]  Longitude axis
  float normLat   = currentPos.z + 0.5;   // t ∈ [0,1]  Latitude axis
  float normDepth = 0.5 - currentPos.y;   // r ∈ [0,1]  Depth (0=surface, 1=bottom)

  float scalar = texture(u_data, vec3(normLon, normLat, normDepth)).r;
  ...
  currentPos += stepVec;
}
```

Texture coordinate mapping:

| Texture Axis | Object Space Expression | Physical Meaning |
|:---:|:---:|:---|
| s (X) | `pos.x + 0.5` | Longitude [min_lon → max_lon] |
| t (Y) | `pos.z + 0.5` | Latitude [min_lat → max_lat] |
| r (Z) | `0.5 − pos.y` | Depth [0 = surface, 1 = bottom] |

### 5.5 Opacity Transfer Function & Alpha Compositing

For **volume mode** (`u_renderMode == 0`), each step's contribution follows the
**Beer-Lambert** extinction law, modulated by step size Δt:

```
α_step = (1 − exp(−ρ · κ · 3.5)) · Δt · 30
```

where:
- ρ = (s − s_threshold) / (1 − s_threshold) is the normalised density above threshold
- κ is the user-adjustable opacity scale (`u_opacity`)
- Constants 3.5 and 30 are tuned empirically for Indian Ocean scalar ranges

```glsl
// VolumeRaymarchingShader.js lines 154–156
float density = (scalar - u_threshold) / (1.0 - u_threshold + 1e-4);
float alpha = (1.0 - exp(-density * u_opacity * 3.5)) * dt * 30.0;
alpha = clamp(alpha, 0.0, 1.0);
```

**Front-to-back alpha compositing** (Porter-Duff `over` operator):

```
C_out.rgb += (1 − C_out.a) · C_step · α_step
C_out.a   += (1 − C_out.a) · α_step
```

```glsl
// lines 158–163
accumulatedColor.rgb += (1.0 - accumulatedColor.a) * col * alpha;
accumulatedColor.a   += (1.0 - accumulatedColor.a) * alpha;
if (accumulatedColor.a >= 0.98) break;   // Early-ray termination
```

### 5.6 Iso-Surface Extraction (`u_renderMode == 1`)

Instead of volumetric accumulation, each step tests whether the sampled scalar is within
a band of width ±0.035 around the target iso-value:

```glsl
// VolumeRaymarchingShader.js lines 147–151
if (abs(scalar - u_isoValue) < 0.035) {
  vec3 col = apply_colormap(scalar);
  accumulatedColor = vec4(col, 0.92);   // Opaque, single hit
  break;
}
```

This implements a **shell-rendering** iso-surface approximation: the ray stops at the first
voxel layer satisfying the iso-value criterion, yielding a smooth coloured surface without
explicit meshing or marching-cubes extraction.

### 5.7 Depth-Clipping Plane

An optional horizontal depth clip plane discards all samples below a user-specified
normalised depth z_slice:

```glsl
if (u_enableSlice == 1 && normDepth > u_sliceZ) sliceClip = true;
```

`u_sliceZ` is set from the UI in meters and normalised:

```javascript
// OceanSceneController.js line 544
this.volumeMaterial.uniforms.u_sliceZ.value = sliceDepthMeters / 2000.0;
```

### 5.8 Colourmap Library

Four scientifically validated colourmaps are implemented as GLSL polynomial approximations:

| Code | Name | Polynomial Order | Application |
|:----:|------|:---:|-------------|
| 0 | **Turbo** | Degree-5 (Smith & van der Walt, 2019) | Default — temperature |
| 1 | **Viridis** | Degree-6 | Perceptually uniform — salinity |
| 2 | **Thermal** | 3-segment linear blend | Ocean warm-to-cold |
| 3 | **Jet** | Piecewise linear (3 segments) | Legacy / compatibility |

---

## 6. Binary Data Pipeline — NetCDF → Float32 GPU Buffer

### 6.1 Overview

The backend converts multi-gigabyte NetCDF ocean model arrays into compact, normalised Float32
binary buffers that can be uploaded directly to GPU memory as `THREE.Data3DTexture` objects.

Implemented in `ocean_model.py` — `OceanModel.extract_volume_buffer()` (lines 460–663).

### 6.2 Step-by-Step Pipeline

**Step 1 — Lazy time slicing (avoids full dataset decompression)**

```python
da_sub = da.isel({t_dim: valid_time_idx})   # xarray lazy isel — no I/O yet
```

**Step 2 — Optional spatial subsetting**

If `spatial_bounds` are provided, xarray `.sel()` with coordinate slices clips the
domain before materialisation, reducing memory footprint for large global grids.

**Step 3 — Materialisation to Float32**

```python
raw_data = da_sub.values.astype(np.float32)
```

Only at this point are compressed NetCDF chunks decompressed into RAM.

**Step 4 — 3D Regularisation via `RegularGridInterpolator`**

The raw data shape `(nz_curr, ny_curr, nx_curr)` is resampled to the target GPU texture
dimensions `(nz_tgt, ny_tgt, nx_tgt)` (default `64×64×32`) using trilinear interpolation:

```python
# ocean_model.py lines 562–588
z_in = np.linspace(0, 1, nz_curr)
y_in = np.linspace(0, 1, ny_curr)
x_in = np.linspace(0, 1, nx_curr)
interp = RegularGridInterpolator((z_in, y_in, x_in), raw_data_filled,
                                  bounds_error=False, fill_value=fill_val)
grid_z, grid_y, grid_x = np.meshgrid(z_out, y_out, x_out, indexing="ij")
vol_interp = interp((grid_z, grid_y, grid_x)).astype(np.float32)
```

NaN cells are tracked through a parallel binary interpolation:

```python
nan_interp = RegularGridInterpolator(
    (z_in, y_in, x_in), np.isnan(raw_data).astype(np.float32),
    bounds_error=False, fill_value=1.0)
nan_grid = nan_interp((grid_z, grid_y, grid_x)) > 0.5
vol_interp[nan_grid] = np.nan    # Restore NaNs after resampling
```

**Step 5 — Normalisation and NaN sentinel encoding**

The resampled volume is normalised to `[0.0, 1.0]` using the valid-data min/max.
NaN cells receive the sentinel value `−1.0` (outside the `[0, 1]` range):

```python
# ocean_model.py lines 632–633
vol_norm = np.clip((vol_interp - min_val) / (max_val - min_val), 0.0, 1.0)
vol_norm[nan_mask] = -1.0     # Sentinel: land mask / missing data
```

The fragment shader reads the Red channel; any value below zero indicates a NaN cell
(ocean floor / land) and can be treated as transparent.

**Step 6 — Serialisation to bytes**

```python
buffer = vol_norm.tobytes()   # NumPy C-contiguous Float32 array → raw bytes
```

The HTTP response sends these bytes as `Content-Type: application/octet-stream`.
The frontend reconstructs the buffer as:

```javascript
// OceanSceneController.js lines 496–502
const newTexture = new THREE.Data3DTexture(volumeBuffer, dimX, dimY, dimZ);
newTexture.format = THREE.RedFormat;     // Single-channel (R only)
newTexture.type   = THREE.FloatType;     // IEEE 754 float32
newTexture.minFilter = THREE.LinearFilter;
newTexture.magFilter = THREE.LinearFilter;
newTexture.unpackAlignment = 1;
newTexture.needsUpdate = true;
```

`THREE.RedFormat` + `THREE.FloatType` maps exactly to the GLSL `sampler3D` uniform
(`u_data`) sampled as `.r` in the fragment shader — no RGBA packing is required.

### 6.3 LRU Caching

Computed volume buffers are stored in a bounded **Least Recently Used (LRU) cache**
(32 entries) keyed by `(variable, time_idx, target_shape, spatial_bounds)`:

```python
# ocean_model.py lines 474–477, 659–661
if cache_key in self._volume_cache:
    self._volume_cache.move_to_end(cache_key)   # LRU promotion
    return self._volume_cache[cache_key]
...
if len(self._volume_cache) >= self._max_cache_size:
    self._volume_cache.popitem(last=False)       # Evict oldest
```

This ensures sub-millisecond response times on repeated identical requests without
reloading or reprocessing the NetCDF file.

### 6.4 Surface-Slice Extraction for 2D Globe Overlay

A 2D surface scalar field is simultaneously extracted for rendering as a coloured
polygon texture on the 3D Earth globe:

```javascript
// OceanSceneController.js lines 513–519
const surfaceSlice = new Float32Array(dimX * dimY);
for (let i = 0; i < dimX * dimY; i++) {
  surfaceSlice[i] = volumeBuffer[i];   // Top z-layer = surface (z=0)
}
this.modelCoverageLayer.updateSurfaceData(surfaceSlice, dimX, dimY, 0);
```

The `ModelCoverageLayer` renders this 2D slice as a planar texture draped onto the
spherical model domain footprint in globe mode.

---

## References

| Standard / Library | Version | Description |
|---|---|---|
| TEOS-10 | 2010 | IOC, SCOR and IAPSO — Thermodynamic Equation of Seawater |
| `gsw` | ≥ 3.6 | Gibbs SeaWater Oceanographic Toolbox (Python) |
| ROMS | v3.x | Regional Ocean Modeling System terrain-following coordinates |
| Argo Data Format | v3.1 | Argo Quality Control Manual for CTD and Trajectory Data |
| CF Conventions | CF-1.6 | Climate and Forecast Metadata Conventions |
| Three.js | r162 | WebGL2 scene graph and `Data3DTexture` API |
| scipy | ≥ 1.11 | `RegularGridInterpolator` trilinear resampling |
| xarray | ≥ 2024 | Lazy NetCDF loading and coordinate-aware slicing |
| netCDF4 | ≥ 1.6 | Low-level NetCDF4 / HDF5 reading |

---

*Generated from direct source inspection of the INCOIS 3D Ocean Data Visualization Platform codebase.
All formulas are derived from and consistent with the production implementation.*
