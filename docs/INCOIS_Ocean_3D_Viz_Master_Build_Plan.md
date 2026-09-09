# INCOIS 3D Ocean Data Visualization Platform — Master Build Instructions

## 0. Ground Rules for the Building Agent

1. **Build incrementally, but never build a toy.** Every phase must end with something that runs (`docker compose up`) and does what it claims — no stubbed endpoints that only work in theory.
2. **Real data first, mock data only as fallback.** Use the real public datasets listed in Section 11 (Argo, Copernicus, INCOIS LAS) from Phase 2 onward. Mock/synthetic NetCDF is acceptable only in Phase 1 to unblock frontend work in parallel.
3. **Lock the stack below.** Do not substitute frameworks mid-build unless a phase explicitly says "evaluate." Consistency matters more than any individual library choice here.
4. **Every phase has a "Definition of Done."** Treat it as a checklist, not a suggestion.
5. **Comment and document as you go** — README per service, `.env.example` for every service that needs config, and a top-level `ARCHITECTURE.md` that gets updated as the system grows.

---

## 1. Problem Statement (Verbatim, as supplied)

> **Title:** Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations.
>
> **Background**
>
> India's vast Exclusive Economic Zone (EEZ) and coastline demand continuous, high-resolution monitoring of ocean state variables. INCOIS routinely generates and archives large volumes of ocean model outputs — including three-dimensional fields of temperature, salinity, current vectors, chlorophyll, etc. — as well as real-time and delayed-mode observations from autonomous instruments such as Argo profiling floats and underwater Gliders. These datasets are stored in NetCDF and ASCII/text formats and span multiple depth levels, spatial grids, and time steps.
>
> Despite the richness of this data, no integrated, web-based 3D visualization platform currently exists that can simultaneously render model fields and in-situ instrument observations in a single interactive environment. Existing tools are either desktop-bound, support only 2D plan views, or lack the ability to co-visualize model outputs alongside instrument profiles. Operational oceanographers and forecasters are therefore forced to toggle between disparate software packages, making it difficult to rapidly correlate model predictions with observational evidence.
>
> **Key gaps identified:**
> - No web-based, platform-independent 3D rendering of ocean model data (temperature, salinity, currents, etc.) with depth-resolved volumetric views.
> - No unified display of Argo float and Glider profile data (latitude, longitude, depth, time, temperature, salinity, chlorophyll) alongside model fields.
> - Absence of interactive controls for variable selection, depth-slice navigation, time-step animation, and customizable colorbars.
> - Inability to ingest new observational data streams or additional model variables without significant re-engineering.
> - Lack of tools to support intuitive, rapid understanding of complex 3D ocean phenomena for operational decision-making.
>
> The absence of such a system impedes timely hazard assessment, search-and-rescue support, fishery advisories, climate monitoring, etc. — all operational mandates of INCOIS.
>
> **Expected Solution**
>
> A web-based, browser-native 3D Ocean Data Visualization System integrating ocean model outputs with observational data on a single interactive platform.
>
> Core functional requirements:
> 1. **3D Volumetric Rendering** — Interactive visualization of ocean model fields (temperature, salinity, current vectors) across the full water column, with depth-slice views, isosurface extraction, and time-step animation using WebGL / Three.js or Cesium.js.
> 2. **Instrument Data Overlay** — Co-display of Argo float, Glider profile, CTD and BGC data using geospatially accurate markers; clicking a float/glider shows a depth-vs-variable profile chart with timestamps.
> 3. **Multi-format Data Ingestion** — Automated parsers for NetCDF (via xarray backend) and delimited text formats, modular architecture allowing new variables/sources with minimal code change.
> 4. **Customizable Colorbar & Variable Controls** — Dynamic colorbar editor (palette, min/max, log/linear), variable selector, layer opacity, vertical exaggeration slider.
> 5. **Web-based, Scalable Architecture** — Modern JS frontend, lightweight REST/OPeNDAP backend, deployable on INCOIS infrastructure with no client-side dependencies.
> 6. **Extensible Design** — Plugin-style module for future sensors (CTDs, moorings, HF-radar, ADCP), new model variables, ML-derived products.
> 7. Follow open standards (OGC WMS/WCS, CF Conventions for NetCDF) for interoperability with national/international ocean data portals.
>
> **Public Outreach & Science Communication** — The platform should also work as a science-communication tool: making model outputs accessible to students, the public, and policymakers; usable for outreach events, exhibitions, and e-learning.
>
> **Organization:** Ministry of Earth Sciences (MoES) — INCOIS Ocean Valley · **Category:** Software · **Theme:** Disaster Management
>
> **Dataset Links:**
> - Numerical Ocean Model Outputs: https://las.incois.gov.in/ and https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030/description
> - Argo Global Data: ftp://ftp.ifremer.fr/ifremer/argo
> - Glider Data: ftp://ftp.ifremer.fr/ifremer/glider/v2/
> - Collection of In-situ Data: (not specified in source PS)

---

## 2. Product Vision

A browser-based **"digital twin of the water column"**: a photorealistic 3D globe (not a flat map) that a forecaster, student, or policymaker can spin, zoom into the Indian Ocean/EEZ, and then dive *into the water* — literally travelling down through depth layers — to see temperature, salinity, currents, and chlorophyll fields rendered volumetrically, with real Argo floats and Gliders floating in the same space as clickable, live-data-backed entities.

Two audiences, one product:
- **Operational mode** — dense controls, multiple variables, depth/time scrubbers, colorbar precision, data export, side-by-side model-vs-observation comparison.
- **Outreach mode** — a simplified, guided, cinematic camera experience (inspired by the "fly to a location and show me what's interesting" pattern) for public exhibitions and school demos.

---

## 3. Technology Stack (Locked)

- **Frontend**: React 18, TypeScript, Vite, CesiumJS (Resium), TailwindCSS, Zustand, Recharts, Three.js (custom Cesium primitive for ray-marching).
- **Gateway**: Node.js, Express, TypeScript, JWT, WebSockets (`ws`), rate limiting, request proxy.
- **Data Service**: Python 3.11, FastAPI, xarray, netCDF4, argopy, erddapy, copernicusmarine, Celery, Redis, numpy, scipy.
- **Data & Infra**: PostgreSQL 15 + PostGIS + TimescaleDB, MinIO (S3-compatible), Redis 7, Docker Compose, Nginx.
