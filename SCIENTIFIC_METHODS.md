# Scientific Methods & Oceanographic Formulations
**INCOIS 3D Ocean Data Visualization Platform (SIH 2026 PS 26067)**

This document details the scientific foundations, thermodynamic equations, vertical coordinate transformations, and statistical metrics implemented in this system.

---

## 1. Thermodynamic Equation of Seawater (TEOS-10)

Argo profiling floats record in-situ sea water pressure ($P$, decibars) and ITS-90 temperature ($T$, $^\circ\text{C}$). Because sea water is compressible and the gravitational acceleration $g(\phi)$ varies with latitude $\phi$, physical depth $z$ (meters) cannot be computed by a simple linear division.

We implement the official **TEOS-10** thermodynamic formulation via `gsw.z_from_p(p, lat)`:

\[
z = - \int_{0}^{P} \frac{1}{\rho(S_A, \Theta, P') \cdot g(\phi)} dP'
\]

Where:
- $P$ is pressure in $\text{dbar}$
- $\phi$ is latitude in degrees north
- $\rho$ is the in-situ density of seawater calculated from Absolute Salinity $S_A$ and Conservative Temperature $\Theta$
- $g(\phi) = 9.780327 \cdot (1 + 0.0053024 \sin^2\phi - 0.0000058 \sin^2 2\phi) \ \text{m/s}^2$

Calculated depths are expressed as positive meters downward ($z \ge 0$).

---

## 2. ROMS Terrain-Following $s$-Coordinate Transformation

Regional Ocean Modeling System (**ROMS**) uses terrain-following vertical coordinates ($s_\rho \in [-1, 0]$), allowing high vertical resolution near the sea surface and the ocean floor.

Physical depth $z(x, y, s, t)$ (in meters, negative below sea level) is calculated using the following formulations:

### $V_{\text{transform}} = 1$ (ROMS Original):
\[
S(x, y, s) = h_c \cdot s + (h(x, y) - h_c) \cdot C(s)
\]
\[
z(x, y, s, t) = S(x, y, s) + \zeta(x, y, t) \cdot \left(1 + \frac{S(x, y, s)}{h(x, y)}\right)
\]

### $V_{\text{transform}} = 2$ (ROMS Modern Default):
\[
S(x, y, s) = \frac{h_c \cdot s + h(x, y) \cdot C(s)}{h_c + h(x, y)}
\]
\[
z(x, y, s, t) = \zeta(x, y, t) + (\zeta(x, y, t) + h(x, y)) \cdot S(x, y, s)
\]

Where:
- $h(x, y)$ is ocean bathymetry (sea floor depth, positive meters)
- $\zeta(x, y, t)$ is free surface elevation (meters)
- $h_c$ is the user-defined critical / minimum stretching depth (`hc`)
- $C(s)$ is the dimensionless vertical stretching function (`Cs_r`)

---

## 3. 4D Spatio-Temporal Colocation Engine

To validate numerical forecasts against in-situ instruments, the system collocates 4D model arrays $\mathcal{M}(x, y, z, t)$ onto the observation point $(x_{\text{obs}}, y_{\text{obs}}, z_{\text{obs}}, t_{\text{obs}})$.

### Step 1: Temporal Weighting
Given model forecast time steps $t_0 \le t_{\text{obs}} \le t_1$:
\[
\alpha = \frac{t_{\text{obs}} - t_0}{t_1 - t_0}, \quad \alpha \in [0, 1]
\]

### Step 2: Spatial Interpolation
- **Curvilinear Grids** (2D `lon_rho`, `lat_rho`): Uses $k$-d tree nearest neighbor query on the unit sphere $(X, Y, Z)$ with inverse-distance weighting across the 4 surrounding ocean grid cells.
- **Rectilinear Grids** (1D `lon`, `lat`): Uses 2D bilinear interpolation.

### Step 3: 4D Blending
\[
\mathcal{M}_{\text{colocated}}(z) = (1 - \alpha) \cdot \mathcal{M}_{t_0}(x_{\text{obs}}, y_{\text{obs}}, z) + \alpha \cdot \mathcal{M}_{t_1}(x_{\text{obs}}, y_{\text{obs}}, z)
\]

### Step 4: Vertical Interpolation
Linear 1D interpolation along monotonic depth levels onto the exact Argo observation depths $z_{\text{obs}}$.

---

## 4. Statistical Model Validation Metrics

Let $M_i = \text{Model}(z_i)$ and $O_i = \text{Obs}(z_i)$ for $N$ valid depth levels with Quality Control flags $QC_i \in \{1, 2\}$.

### Depth-wise Residuals:
\[
\Delta_i = M_i - O_i
\]

### Forecast Bias:
\[
\text{Bias} = \frac{1}{N} \sum_{i=1}^{N} (M_i - O_i)
\]

### Mean Absolute Error (MAE):
\[
\text{MAE} = \frac{1}{N} \sum_{i=1}^{N} |M_i - O_i|
\]

### Root Mean Square Error (RMSE):
\[
\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (M_i - O_i)^2}
\]

### Pearson Correlation Coefficient ($r$):
\[
r = \frac{\sum_{i=1}^{N} (M_i - \bar{M})(O_i - \bar{O})}{\sqrt{\sum_{i=1}^{N} (M_i - \bar{M})^2} \sqrt{\sum_{i=1}^{N} (O_i - \bar{O})^2}}
\]
*Note: If $\sigma_M = 0$ or $\sigma_O = 0$ (constant field), $r$ is mathematically undefined and returns `null`.*
