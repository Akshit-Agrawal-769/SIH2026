# Real Oceanographic Datasets Storage

This directory contains real ocean model outputs (ROMS/INDOFOS NetCDF files) and in-situ observation profiles (Argo profiling floats, Gliders, CTD/BGC data).

> [!IMPORTANT]
> **STRICT NO MOCK DATA POLICY**
> - DO NOT place synthetic, hardcoded, or fake `.json` / `.nc` files in this directory.
> - Actual `.nc` / `.nc4` data files placed here are ignored by `.gitignore` to prevent committing massive binary files to Git.
> - To acquire real datasets, download sample NetCDF files from [INCOIS ERDDAP](https://erddap.incois.gov.in/) or [Ifremer Argo GDAC](ftp://ftp.ifremer.fr/ifremer/argo).

## Directory Organization

- `model/`: Place INCOIS ROMS / INDOFOS forecast NetCDF files here (`.nc`, `.nc4`).
- `argo/`: Place Argo profiling float NetCDF profile files here (`.nc`).
- `glider/`: Place underwater Glider trajectory NetCDF files here (`.nc`).
