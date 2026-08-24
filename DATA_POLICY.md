# INCOIS 3D Ocean Data System — Data Policy & Quality Standards

**Problem Statement:** Smart India Hackathon (SIH 2026) — PS 26067  
**Operating Policy:** STRICT REAL OCEANOGRAPHIC DATA (NO MOCK DATA)

---

## 1. Core Principles

1. **Authentic Primary Sources**:
   - Numerical model datasets are sourced from INCOIS INDOFOS / ROMS operational forecasts.
   - In-situ observations are sourced from the international **Argo Global Data Assembly Centre (GDAC)** via Coriolis / Ifremer and USGODAE.

2. **Zero Synthetic / Mock Data**:
   - The platform never fabricates temperature, salinity, current vectors, or float tracks.
   - If an authentic dataset fails download or is absent, the pipeline halts with a `RuntimeError: REAL DATASET REQUIRED`.

3. **Mandatory Quality Control (QC) Filtering**:
   - In accordance with the international Argo Data Management format:
     - **QC Flag 1 (Good)**: Retained.
     - **QC Flag 2 (Probably Good)**: Retained.
     - **QC Flag 3 (Probably Bad)**: Strictly rejected from metric calculations.
     - **QC Flag 4 (Bad)**: Strictly rejected from metric calculations.
     - **QC Flag 9 (Missing Value)**: Strictly rejected from metric calculations.

4. **Thermodynamic Depth Conversion**:
   - Pressure is converted to depth using **TEOS-10** (`gsw.z_from_p`) taking into account local latitude and compressibility.

---

## 2. Dataset Manifest & Provenance

All ingested files are registered in [`datasets/manifest.json`](file:///home/hasney12/SIH2026/datasets/manifest.json) with:
- WMO Identifier / Model ID
- Authoritative GDAC URL
- Target variables and dimensions
- Quality Control requirements
- Data provider citation & licensing
