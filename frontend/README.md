# INCOIS Frontend Client

React 18 + Vite + TypeScript, CesiumJS globe and a Three.js water-column view.

- Globe with Esri World Imagery (attribution shown), India EEZ, graticule, Argo markers.
- Gridded fields from the data catalog: Bio-ROMS SST, SSS, chlorophyll-a, MLD (2019 monthly,
  surface only) and ARMOR3D surface geostrophic currents (2024-12-31).
- Timeline over the real catalog timesteps (custom UTC range, step, playback speed, keyboard).
- Argo profile panel, model-vs-observation matchups, point analytics, water-column view.
- Works on static hosting using the files in `public/`; set `VITE_API_BASE_URL` at build time to
  use a remote API (needed for point analytics, WMS and NetCDF export).

```bash
npm ci
npm run dev          # http://localhost:3000, proxies /api to VITE_GATEWAY_URL (default :4000)
npx vitest run       # unit tests
npm run build
```
