# Project Presentation: INCOIS 3D Ocean Data Visualization Platform

**Problem Statement ID:** SIH2026-26067  
**Organization:** Ministry of Earth Sciences (MoES) — INCOIS  
**Project Title:** Web-Based 3D Ocean Data Visualization Platform Integrating Numerical Ocean Models and In-Situ Observations  

---

## 1. Presentation File

Upload the team's final SIH PowerPoint presentation (`.pptx`) or PDF to this folder:

- **Presentation Document:** `[Open Final Presentation](./INCOIS_Ocean3D_SIH2026_Final_Presentation.pptx)` *(Or PDF version)*

---

## 2. External Presentation Link (Cloud Viewer)

If the PowerPoint file contains embedded video or exceeds GitHub's 25MB file upload limit, access the presentation directly via the cloud viewer:

- **Google Drive / OneDrive Link:** `https://drive.google.com/file/d/1_INCOIS_3D_OCEAN_VIZ_SIH2026_PRESENTATION/view?usp=sharing` *(Replace with your team's public link before submission)*

> **Note to Evaluators:** The cloud viewer link is configured with **Public (Anyone with link can view)** permissions and requires no login.

---

## 3. Slide Deck Structure & Overview

The final presentation covers the following 10 evaluation slides:

1. **Title Slide:** Project Name, Problem Statement ID (`SIH2026-26067`), Ministry (MoES - INCOIS), Team Name & Member Details.
2. **Problem Analysis:** The operational disconnect between 2D gridded model NetCDF outputs and 1D/profile in-situ observations (Argo/Gliders/Buoys).
3. **Proposed Innovation:** A unified browser-native 3D Digital Twin combining a CesiumJS global navigation canvas with a Three.js volumetric water column studio.
4. **Authoritative C++ Core (`ocean_core`):** High-performance C++ NetCDF ingestion, UNESCO QC filtering, TEOS-10 conversions, and sub-millisecond Float32 binary tile export.
5. **System Architecture:** End-to-end data pipeline from NetCDF source datasets to WebGL shaders, FastAPI microservices, and Node gateway.
6. **Key Features & Capabilities:**
   - 60 FPS GPU-accelerated ocean current streamlines
   - Volumetric laser depth slicing (-0m surface to -2000m abyssal basin)
   - Interactive CTD profile inspection with real-time temperature/salinity soundings
   - Standard OGC WMS 1.3.0 and CF-1.8 NetCDF export endpoints
7. **Scientific Data Integrity & Zero-Mock Policy:**
   - Strict elimination of synthetic/mock data
   - Explicit HTTP 404 / no-data handling for unobserved coordinates
   - Side-by-side numerical verification matching raw NetCDF files to 3 decimal places
8. **Scalability & Deployment:** Docker Compose orchestration, PostGIS spatial indexing, MinIO S3 object caching, and Kubernetes readiness.
9. **Impact & Beneficiaries:** Marine fisheries advisories (PFZ), Indian Coast Guard search-and-rescue, cyclone/tsunami operational forecasting, and public ocean literacy.
10. **Future Roadmap:** AI-powered thermocline eddy detection, HF Radar surface current streaming, and satellite altimetry fusion.
