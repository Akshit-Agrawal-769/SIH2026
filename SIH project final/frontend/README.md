# INCOIS Frontend Client

React 18 + Vite + TypeScript + CesiumJS 3D visualization client for the INCOIS Ocean Data Visualization Platform.

## Features
- **Keyless 3D Globe**: Renders Earth with high-resolution Esri World Imagery with **zero API keys** required.
- **Ocean-first Layout**: Focused over the Indian Ocean & Indian EEZ with quick-fly presets.
- **Data Layers Panel**: Toggles for 3D numerical model variables (temperature, salinity, currents, chlorophyll) and in-situ instruments (Argo floats, gliders).
- **Interactive Controls**: Colorbar editor (palettes, min/max), layer opacity slider, vertical exaggeration multiplier.
- **Depth & Time Scrubber**: Depth-slice level selector and temporal playback.
- **Dual Modes**: Operational (advanced analytics) vs. Outreach (guided public tours).

## Development

```bash
npm install
npm run dev
```

Runs on port `3000` by default.
