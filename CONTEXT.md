# Ocean Visualization Domain Context

Real-time scientific visualization and 4D validation of ocean numerical models against in-situ observation instruments.

## Language

**OceanModel**:
A deep module encapsulating a 3D/4D gridded numerical ocean model dataset (e.g., ROMS or INDOFOS), managing horizontal grid projection, terrain-following $s$-coordinate transformations, and 4D spatio-temporal sampling behind a minimal query interface.
_Avoid_: Model service, xarray wrapper, backend data source

**OceanModelRegistry**:
An in-process registry that resolves, validates, and caches active `OceanModel` instances and spatial KD-trees to prevent redundant coordinate indexing.
_Avoid_: Dataset manager, file loader

**InSituStore**:
A deep in-memory observation index that ingests authentic in-situ NetCDF profiles (e.g., Argo profiling floats), decodes Quality Control flags, converts thermodynamic pressure to physical depth (TEOS-10), and delivers indexed profile trajectories without repeated disk I/O.
_Avoid_: Float service, argo adapter, obs reader

**ValidationEngine**:
A deep statistical and colocation module that interpolates 4D numerical model fields onto in-situ observation trajectories, calculating depth-resolved residuals and quantitative error metrics (RMSE, MAE, Bias, Pearson $r$) behind a unified interface.
_Avoid_: Comparison service, model-obs evaluator, matching helper

**StatisticalValidationScorecard**:
A depth-resolved statistical summary detailing model-vs-observation residual errors ($\Delta(z) = \text{Model}(z) - \text{Obs}(z)$), Root Mean Square Error (RMSE), Mean Absolute Error (MAE), forecast Bias, and Pearson correlation coefficient ($r$).
_Avoid_: Error report, diff summary

**OceanSceneController**:
A deep graphics controller encapsulating the Three.js WebGL2 scene graph, volumetric raymarching shader pipelines, 3D texture binding, depth-slicing planes, and interactive raycasting behind a declarative control interface.
_Avoid_: Canvas helper, three wrapper, render hook

**QualityControlPolicy**:
A strict validation rule that accepts only Good ($QC=1$) and Probably Good ($QC=2$) oceanographic measurements, rejecting uncalibrated or bad data ($QC \in \{3, 4, 9, 0\}$).
_Avoid_: Data filter, clean check

**Terrain-Following Coordinate**:
A vertical coordinate system ($s$-coordinate) where vertical layers adjust dynamically to local ocean bathymetry and sea surface height elevation.
_Avoid_: Sigma level, depth layer

**Curvilinear Grid**:
An orthogonal horizontal grid system whose coordinate lines follow curved geographic trajectories ($lon\_\rho, lat\_\rho$).
_Avoid_: Non-standard grid, 2D mesh

**4D Colocation**:
The process of interpolating gridded numerical model state variables in space ($x, y, z$) and time ($t$) onto the exact coordinate and timestamp of an in-situ observation profile.
_Avoid_: Model-obs matching, time blending
