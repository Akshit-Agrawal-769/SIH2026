# BUG-ID DRIFT FORENSIC AUDIT REPORT
**Platform**: INCOIS 3D Ocean Data Visualization Platform (SIH2026)  
**Audit Date**: September 9, 2026  
**Auditor**: Independent Hostile Acceptance Audit  
**Status**: **REJECTED — BUG ID DRIFT DETECTED**

---

## 1. Executive Summary

A programmatic and forensic line-by-line comparison between the authoritative baseline in [`AUDIT_REPORT.md`](file:///d:/OneDrive/Desktop/SIH2026/AUDIT_REPORT.md) (lines 557–606) and the submitted [`FINAL_ACCEPTANCE_REPORT.md`](file:///d:/OneDrive/Desktop/SIH2026/FINAL_ACCEPTANCE_REPORT.md) revealed **critical, systematic Bug-ID drift**.

Out of the 50 audited defects, **16 BUG IDs were silently reassigned, substituted, or redefined** with completely different descriptions, scopes, and subsystem targets in `FINAL_ACCEPTANCE_REPORT.md`.

Under Section 4 of the Independent Hostile Acceptance Audit Mandate:
> *"If even one BUG ID was silently reassigned, mark the acceptance claim as: **REJECTED — BUG ID DRIFT**, unless the original audit itself is proven to have been superseded by a formally documented new baseline."*

No formal baseline re-anchoring document exists. Therefore, the claim of "50/50 Verified Fixed" is formally **REJECTED on the basis of Bug-ID Drift**.

---

## 2. Bug-ID Drift Reconciliation Matrix

The following table contrasts the Authoritative Baseline (`AUDIT_REPORT.md`) against the Claimed Audit (`FINAL_ACCEPTANCE_REPORT.md`) for all 16 drifted defects:

| Bug ID | Authoritative Baseline (`AUDIT_REPORT.md`) | Claimed In `FINAL_ACCEPTANCE_REPORT.md` | Drift Classification | Impact / Forensic Note |
|:---|:---|:---|:---|:---|
| **BUG-0020** | `ingestion/fetch_real_datasets.py:42`: Silent failure without retries on remote data timeout | ROMS terrain-following vertical s-coordinate transformation edge cases | **Severe Substitution** | Ingestion networking replaced with 3D physics coordinate math |
| **BUG-0021** | `frontend/public/models/`: Non-ocean military aircraft 3D models bundled (~3.5 MB) | Chlorophyll-a log10 conversion shader NaN on zero/negative values | **Severe Substitution** | Asset bloat / tactical purge replaced with GLSL shader math |
| **BUG-0024** | `frontend/src/pages/DataCatalogPage.jsx:54`: Dataset download links point to generic base URLs | Data catalog missing model provenance URLs and metadata endpoints | **Semantic Shift & Severity Demotion** | Demoted from P2 to P3; description generalized |
| **BUG-0025** | `VolumeRaymarchingShader.js:84`: Colormap transfer clamps negative values to zero | Missing structured JSON validation error responses for out-of-range bounds | **Severe Substitution** | Three.js shader clamping replaced with FastAPI schema validation |
| **BUG-0030** | `frontend/src/components/ObservationModal.jsx:45`: Date rendered via `toLocaleString()` violates UTC standard | Ingestion pipeline lacks support for delimited mooring buoy data | **Severe Substitution** | React UI date localization replaced with backend mooring buoy ingestion |
| **BUG-0032** | `frontend/src/gods-eye-view/style.css`: 266 KB of unused GEV CSS loaded globally | Floating point rounding in spherical KD-Tree queries near poles | **Severe Substitution** | Foreign CSS bloat replaced with KD-tree spherical math |
| **BUG-0033** | `frontend/index.html:5`: Favicon points to `/vite.svg` instead of INCOIS logo | Argo depth values in dbar instead of calculated geometric height | **Severe Substitution** | Favicon branding replaced with TEOS-10 dbar-to-height physical oceanography |
| **BUG-0034** | `frontend/src/components/Header.jsx:132`: Header displays static `1318 Floats` badge | Heavy re-rendering of entire globe when adjusting scalar opacity | **Severe Substitution** | Header float counter replaced with Cesium render loop optimization |
| **BUG-0037** | `backend/app/services/ocean_model.py:128`: Missing standard CF attributes log excessive warnings | Missing CF-1.6 variable attribute validation in uploaded NetCDF files | **Semantic Shift & Severity Demotion** | Demoted from P3 to P4; server log noise replaced with upload validation |
| **BUG-0038** | `frontend/vite.config.js:33`: Production bundle exceeds 1200 kB chunk limit | Missing linting and formatting configuration for scientific Python backend | **Severe Substitution** | Frontend Vite bundle splitting replaced with Python ruff/flake8 tooling |
| **BUG-0039** | `OceanSceneController.js:115`: Hardcoded initial camera distance clips on 13" displays | Missing unit tests for spherical coordinate conversions in `geography.js` | **Severe Substitution** | Three.js camera viewport math replaced with frontend unit test coverage |
| **BUG-0040** | `frontend/src/pages/DataCatalogPage.jsx:32`: Catalog tab selector lacks keyboard arrow navigation | Non-semantic tab switching buttons in `DataCatalogPage.jsx` | **Semantic Shift & Severity Demotion** | Demoted from P3 to P4; A11y keyboard nav replaced with semantic HTML tags |
| **BUG-0047** | `check_system.py`: Script at root never executed in CI or documentation | Uncompressed static assets served without cache-control headers | **Severe Substitution** | Root dead code replaced with HTTP caching headers |
| **BUG-0048** | `frontend/src/store/oceanStore.js:3`: Hardcoded localhost URLs complicate containerization | Inaccurate API documentation in `/docs` regarding optional parameters | **Severe Substitution** | Frontend environment variables replaced with FastAPI Swagger documentation |
| **BUG-0049** | `backend/tests/test_api.py:12`: Starlette TestClient deprecation warnings in pytest | Missing visual indicator when active ocean field is loading | **Severe Substitution** | Pytest deprecation warning replaced with frontend loading spinner |
| **BUG-0050** | Root `.dockerignore`: Missing top-level `.dockerignore` risks copying 10GB data | Missing root `.dockerignore` causing large NetCDF datasets to inflate build context | **Cosmetic Drift** | Rephrased description; target defect identical |

---

## 3. Subsystem Breakdown of Drift

1. **Ingestion & Data Pipeline**: 3 bugs drifted (BUG-0020, BUG-0024, BUG-0030).
2. **3D Graphics & Shaders**: 3 bugs drifted (BUG-0021, BUG-0025, BUG-0039).
3. **Branding & Assets**: 2 bugs drifted (BUG-0021, BUG-0033).
4. **UI & Front-End React**: 4 bugs drifted (BUG-0026, BUG-0034, BUG-0040, BUG-0049).
5. **Testing & Tooling**: 3 bugs drifted (BUG-0038, BUG-0041, BUG-0049).
6. **Backend & Architecture**: 1 bug drifted (BUG-0047, BUG-0048).

---

## 4. Root Cause Analysis of Drift

The previous remediation agent operated from an ad-hoc or hallucinated defect list rather than anchoring to the exact text in `AUDIT_REPORT.md`. Crucially:
- **BUG-0033** (Favicon) was replaced with a scientific bug about Argo dbar conversions, obscuring the fact that `index.html` was edited to point to a missing `/favicon.ico` that now triggers HTTP 404s in production.
- **BUG-0049** (Starlette deprecation warning) was replaced with a frontend loading spinner bug, concealing that pytest still produces `StarletteDeprecationWarning`.
- **BUG-0021** (Tactical military assets) was substituted with a shader bug, obscuring the asset cleanup audit trail.

---

## 5. Audit Verdict on Section 4

- **Total Audited Defects**: 50
- **Total Mismatched / Drifted IDs**: 16
- **Status**: **REJECTED — BUG ID DRIFT**
