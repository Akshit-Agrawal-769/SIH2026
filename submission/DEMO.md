# Demo Video: INCOIS 3D Ocean Data Visualization Platform

**Problem Statement ID:** SIH2026-26067  
**Organization:** Ministry of Earth Sciences (MoES) — INCOIS  
**System Name:** Digital Twin of the Water Column (3D Interactive Ocean Visualizer)  

---

## 1. Demo Video Link

Watch the full end-to-end working demonstration of the platform:

- **YouTube Demonstration Link:** `https://youtu.be/INCOIS_3D_OCEAN_DEMO_2026` *(Replace with your team's live video URL before submission)*
- **Alternative Google Drive Link:** `https://drive.google.com/file/d/1_INCOIS_3D_OCEAN_DEMO_VIDEO/view?usp=sharing`

> **Note:** The video is accessible publicly without requiring permissions or sign-in.

---

## 2. Video Demonstration Breakdown

The demonstration video highlights the core operational capabilities of the platform in 5 key segments:

### Segment 1: Global Geospatial Context (0:00 – 1:00)
- **Cesium 3D Globe Navigation:** Fluid orbit, zoom, and panning across the Arabian Sea, Bay of Bengal, and equatorial Indian Ocean.
- **Ocean Current Streamlines:** Real-time 60 FPS particle advection visualizing monsoon surface currents and gyres.
- **Atmospheric & Bathymetric Overlays:** Real-time day/night terminators, cartographic graticules, and seafloor topography.

### Segment 2: Multi-Variable Dynamic Depth Slicing (1:00 – 2:00)
- **Variable Selector:** Seamless switching between Sea Surface Temperature (°C), Practical Salinity (PSU), Current Velocity (m/s), and Chlorophyll-a (mg/m³).
- **Interactive Depth Slider:** Scrubbing through the water column from the euphotic surface layer down to intermediate and abyssal depths.
- **Dynamic Palette Controls:** Switching colormaps (NOAA SST, Turbo, Viridis, GFDL Chlorophyll) with real-time range auto-calibration.

### Segment 3: 3D Volumetric Water Column Studio (2:00 – 3:15)
- **On-Demand Water Block Extraction:** Selecting any point in the Indian Ocean to open the Three.js 3D Volumetric Ocean Block Studio.
- **Laser Depth Scanning:** Animated laser scan plane slicing through stratification layers.
- **Physical Telemetry Readings:** Sound velocity calculation (Mackenzie equation), mixed layer depth (MLD), and pycnocline gradients.

### Segment 4: In-Situ Observation Co-Visualization (3:15 – 4:15)
- **Active Platform Markers:** Real-time spatial locations of INCOIS Argo profiling floats, autonomous gliders, and moored OMNI buoys.
- **CTD Profile HUD:** Clicking an Argo float (e.g., WMO `2902084`) to pull authentic vertical CTD soundings with temperature and salinity curves.
- **Model vs. Observation Validation:** Side-by-side comparison of model forecasts against real sensor measurements.

### Segment 5: Interoperability & Scientific Export (4:15 – 5:00)
- **OGC WMS 1.3.0 Live Stream:** Demonstrating live layer import into external GIS platforms (QGIS/ArcGIS).
- **CF-1.8 NetCDF Download:** On-the-fly export of volumetric netCDF-4 files for scientific researchers.
- **Data Integrity Guarantee:** Zero-mock policy confirmation with strict HTTP 404 handling on missing data.
