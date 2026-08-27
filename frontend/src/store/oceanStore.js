import { create } from 'zustand';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const VITAL_SIGNS_CATALOG = {
  surface: [
    {
      id: 'temp',
      name: 'Sea Surface Temperature',
      code: 'SST',
      category: 'surface',
      units: '°C',
      colormap: 'turbo',
      range: [18.5, 31.8],
      description: 'Synoptic upper-ocean thermal layer derived from INCOIS ROMS model assimilation and satellite infrared sensors.',
      source: 'INCOIS Bio-ROMS / INSAT-3D / NOAA AVHRR',
      resolution: '1/12° (approx. 9 km)',
    },
    {
      id: 'chl',
      name: 'Chlorophyll-a / Ocean Color',
      code: 'CHLA',
      category: 'surface',
      units: 'mg/m³',
      colormap: 'viridis',
      range: [0.02, 12.5],
      description: 'Photosynthetic pigment concentration indicating phytoplankton biomass, biological productivity, and marine food webs.',
      source: 'Oceansat-3 OCM-3 / MODIS Aqua',
      resolution: '1 km / 9 km',
    },
    {
      id: 'salt',
      name: 'Sea Surface Salinity',
      code: 'SSS',
      category: 'surface',
      units: 'PSU',
      colormap: 'thermal',
      range: [31.0, 36.8],
      description: 'Surface practical salinity highlighting freshwater runoff from the Ganges-Brahmaputra and high evaporation in the Arabian Sea.',
      source: 'SMAP / SMOS / INCOIS Model',
      resolution: '25 km / 9 km',
    },
    {
      id: 'ssh',
      name: 'Sea Surface Height Anomaly',
      code: 'SSHA',
      category: 'surface',
      units: 'cm',
      colormap: 'jet',
      range: [-35, 35],
      description: 'Altimeter-derived sea level deviations revealing geostrophic circulation, Kelvin waves, and Rossby wave propagation.',
      source: 'SARAL/AltiKa / Sentinel-6 / Jason-3',
      resolution: '1/4° gridded',
    },
    {
      id: 'currents',
      name: 'Surface Currents',
      code: 'CURR',
      category: 'surface',
      units: 'm/s',
      colormap: 'turbo',
      range: [0.0, 1.8],
      description: 'Upper ocean horizontal velocity streamlines depicting the Somali Current, Monsoon Current, and equatorial jets.',
      source: 'INCOIS High-Resolution ROMS',
      resolution: '1/12° vector field',
    },
    {
      id: 'waves',
      name: 'Significant Wave Height',
      code: 'SWH',
      category: 'surface',
      units: 'm',
      colormap: 'thermal',
      range: [0.5, 6.5],
      description: 'Directional spectral wave field predicting monsoonal swell and storm sea states across the Indian Ocean basin.',
      source: 'INCOIS WAVEWATCH III',
      resolution: '0.1° spectral',
    },
    {
      id: 'wind',
      name: 'Surface Wind Speed',
      code: 'WIND',
      category: 'surface',
      units: 'kts',
      colormap: 'turbo',
      range: [2.0, 45.0],
      description: 'Near-surface atmospheric vector winds driving coastal upwelling, monsoon currents, and evaporative cooling.',
      source: 'SCATSAT-1 / ASCAT / NCMRWF',
      resolution: '12.5 km',
    },
  ],
  subsurface: [
    {
      id: 'temp_depth',
      name: 'Temperature at Depth',
      code: 'T-Z',
      category: 'subsurface',
      units: '°C',
      colormap: 'turbo',
      range: [2.0, 31.0],
      description: 'Vertical thermal stratification from the surface through the main thermocline down to the abyssal plain (2000m).',
      source: 'Coriolis Argo Floats / ROMS 4D-Var',
      resolution: '40 depth levels',
    },
    {
      id: 'sal_depth',
      name: 'Salinity at Depth',
      code: 'S-Z',
      category: 'subsurface',
      units: 'PSU',
      colormap: 'thermal',
      range: [34.0, 36.2],
      description: 'Subsurface water mass signature tracking Persian Gulf Water, Red Sea Water, and Antarctic Intermediate Water.',
      source: 'In-situ Argo Array / ROMS',
      resolution: '40 depth levels',
    },
    {
      id: 'dox',
      name: 'Dissolved Oxygen / OMZ',
      code: 'DOX',
      category: 'subsurface',
      units: 'µmol/kg',
      colormap: 'viridis',
      range: [5.0, 240.0],
      description: 'Subsurface oxygen distribution highlighting the permanent Oxygen Minimum Zone (OMZ) in the northern Arabian Sea.',
      source: 'Biogeochemical-Argo / Bio-ROMS',
      resolution: '3D volume grid',
    },
    {
      id: 'mld',
      name: 'Mixed Layer Depth',
      code: 'MLD',
      category: 'subsurface',
      units: 'm',
      colormap: 'jet',
      range: [10, 140],
      description: 'Depth of active ocean-atmosphere turbulent mixing influencing biological bloom triggers and cyclone heat extraction.',
      source: 'INCOIS Ocean Analysis (Density 0.03 kg/m³ criterion)',
      resolution: '1/12°',
    },
    {
      id: 'ohc',
      name: 'Ocean Heat Content (0-700m)',
      code: 'OHC',
      category: 'subsurface',
      units: 'kJ/cm²',
      colormap: 'turbo',
      range: [40, 160],
      description: 'Thermal energy stored in the upper ocean column; key predictive indicator for tropical cyclone intensification.',
      source: 'Argo Climatology / ROMS',
      resolution: '1/4°',
    },
  ],
  dynamic: [
    {
      id: 'heatwaves',
      name: 'Marine Heatwaves',
      code: 'MHW',
      category: 'dynamic',
      units: '°C Anom',
      colormap: 'thermal',
      range: [1.0, 4.5],
      description: 'Prolonged discrete anomalously warm seawater events threatening coral reefs and pelagic fisheries.',
      source: 'INCOIS Marine Heatwave Early Warning System',
      resolution: 'Daily tracking',
    },
    {
      id: 'upwelling',
      name: 'Coastal Upwelling Index',
      code: 'CUI',
      category: 'dynamic',
      units: 'm²/s',
      colormap: 'viridis',
      range: [-2.0, 8.0],
      description: 'Wind-driven Ekman divergence bringing cold, nutrient-rich deep water to surface along the Malabar and Somali coasts.',
      source: 'INCOIS Upwelling Dynamics Tool',
      resolution: 'Coastline transects',
    },
    {
      id: 'eddies',
      name: 'Mesoscale Ocean Eddies',
      code: 'EDDY',
      category: 'dynamic',
      units: 'cm SLA',
      colormap: 'jet',
      range: [-30, 30],
      description: 'Coherent rotating vortices (cyclonic cold-core & anticyclonic warm-core) transporting heat, salt, and plankton.',
      source: 'Altimetry Geostrophic Tracking',
      resolution: 'Weekly eddy census',
    },
    {
      id: 'cyclones',
      name: 'Tropical Cyclones',
      code: 'TC',
      category: 'dynamic',
      units: 'kts / hPa',
      colormap: 'turbo',
      range: [30, 150],
      description: 'Active and historical tropical cyclone tracks with storm surge, central barometric pressure, and sea surface cooling wake.',
      source: 'IMD / INCOIS Joint Cyclone Warning Unit',
      resolution: 'Real-time 6h advisory',
    },
  ],
};

export const OBSERVING_MISSIONS = [
  {
    id: 'oceansat3',
    name: 'Oceansat-3 (EOS-06)',
    type: 'satellite',
    agency: 'ISRO / INCOIS',
    status: 'Operational',
    altitude: '720 km',
    inclination: '98.28° Sun-synchronous',
    sensors: 'OCM-3 (13 bands), SSTM (Thermal IR), Ku-Band Scatterometer, ARGOS-4',
    cycle: '2 days repeat',
    lat: 16.5,
    lon: 72.0,
    description: 'Premier oceanographic satellite delivering daily ocean color, sea surface temperature, and wind vectors for operational fisheries and cyclone monitoring.',
  },
  {
    id: 'saral',
    name: 'SARAL / AltiKa',
    type: 'satellite',
    agency: 'ISRO / CNES',
    status: 'Operational (Drifting)',
    altitude: '790 km',
    inclination: '98.55°',
    sensors: 'Ka-band Radar Altimeter (AltiKa), DORIS, LRA, ARGOS-3',
    cycle: '35 days repeat',
    lat: -8.2,
    lon: 85.4,
    description: 'High-precision Ka-band radar altimetry mission measuring sea level anomalies, wave heights, and coastal mesoscale dynamics with millimeter accuracy.',
  },
  {
    id: 'scatsat1',
    name: 'SCATSAT-1',
    type: 'satellite',
    agency: 'ISRO',
    status: 'Operational',
    altitude: '720 km',
    inclination: '98.1°',
    sensors: 'Ku-band Pencil-beam Scatterometer (13.515 GHz)',
    cycle: 'Daily global coverage',
    lat: 5.0,
    lon: 65.0,
    description: 'Dedicated scatterometer providing high-resolution ocean surface vector winds for monsoon forecasting, numerical weather prediction, and cyclone tracking.',
  },
  {
    id: 'argo_array',
    name: 'Indian Ocean Argo Array',
    type: 'insitu_network',
    agency: 'INCOIS / MoES / Coriolis',
    status: 'Active Network (~200 Floats)',
    depthRange: '0 — 2000 m',
    cycle: '10-day profiling cycle',
    sensors: 'CTD (Conductivity, Temperature, Depth), Bio-Optical Sensors (DOX, Chl-a, Nitrate)',
    lat: 12.8,
    lon: 69.0,
    description: 'Autonomous robotic profiling floats descending to 2000m and surfacing every 10 days to transmit CTD profiles via satellite, forming the backbone of subsurface ocean monitoring.',
  },
  {
    id: 'rama_buoys',
    name: 'RAMA Moored Buoy Array',
    type: 'moored_buoys',
    agency: 'INCOIS / NOAA / JAMSTEC',
    status: 'Operational (46 Stations)',
    depthRange: 'Surface to 500 m',
    sensors: 'ATLAS / T-Flex meteorological & upper-ocean temperature/salinity/current moorings',
    lat: 0.0,
    lon: 80.5,
    description: 'Research Moored Array for African-Asian-Australian Monsoon Analysis and Prediction, anchored along the equator and tropical Indian Ocean for climate studies.',
  },
  {
    id: 'incois_station',
    name: 'INCOIS Marine Intelligence Station',
    type: 'moored_station',
    agency: 'INCOIS Coastal Observatory',
    status: 'Operational (Station 01)',
    lat: 14.50,
    lon: 68.20,
    sensors: 'Directional Wave Rider, ADCP, Micro-meteorological sensor, SST & Salinity sonde',
    description: 'Deep-ocean moored marine station providing continuous real-time high-frequency sea state, wave spectra, and atmospheric telemetry.',
  },
  {
    id: 'sagar_nidhi',
    name: 'ORV Sagar Nidhi',
    type: 'research_vessel',
    agency: 'MoES / NIOT / INCOIS',
    status: 'On Scientific Cruise',
    lat: 8.5,
    lon: 76.8,
    speed: '10.5 kts',
    destination: 'Southern Indian Ocean Transect',
    description: 'Ice-class oceanographic research vessel equipped with deep-sea CTD rosettes, multibeam bathymetry, dynamic positioning, and atmospheric profiling labs.',
  },
];

export const OCEAN_EVENTS = [
  {
    id: 'cyclone_mocha',
    name: 'Tropical Cyclone Mocha',
    type: 'cyclone',
    category: 'Category 5 Equivalent',
    basin: 'Bay of Bengal',
    maxWinds: '277 km/h (150 kts)',
    minPressure: '938 hPa',
    lat: 16.5,
    lon: 90.2,
    date: 'May 2023',
    status: 'Benchmark Event',
    description: 'Extremely severe cyclonic storm generating peak wave heights of 11.5m and substantial cold wake SST depression (-3.2°C) across the central Bay of Bengal.',
  },
  {
    id: 'cyclone_biparjoy',
    name: 'Cyclone Biparjoy',
    type: 'cyclone',
    category: 'Very Severe Cyclonic Storm',
    basin: 'Arabian Sea',
    maxWinds: '165 km/h (90 kts)',
    minPressure: '956 hPa',
    lat: 20.8,
    lon: 66.5,
    date: 'June 2023',
    status: 'Benchmark Event',
    description: 'Exceptionally long-duration cyclone with 13-day lifespan in the Arabian Sea, causing extreme storm surge and intense upper ocean mixing.',
  },
  {
    id: 'mhw_arabian',
    name: 'Arabian Sea Extreme Marine Heatwave',
    type: 'heatwave',
    category: 'Category IV (Extreme)',
    basin: 'Central Arabian Sea',
    anomaly: '+3.4 °C above baseline',
    duration: '28 Days',
    lat: 15.0,
    lon: 67.0,
    status: 'Active Phenomenon',
    description: 'Severe thermal anomaly linked to suppressed pre-monsoonal wind-mixing and high solar insolation, triggering coral bleaching in Lakshadweep.',
  },
  {
    id: 'somali_upwelling',
    name: 'Somali-Oman Coastal Upwelling',
    type: 'upwelling',
    category: 'Western Boundary Dynamics',
    basin: 'Western Arabian Sea',
    sstDepression: '-5.8 °C',
    lat: 11.5,
    lon: 52.0,
    status: 'Seasonal Upwelling',
    description: 'Strong Southwest Monsoon low-level Findlater Jet driving intense coastal divergence and cold, nutrient-rich deep water entrainment.',
  },
  {
    id: 'great_whirl_eddy',
    name: 'Great Whirl Mesoscale Eddy',
    type: 'eddy',
    category: 'Anticyclonic Eddy',
    basin: 'Horn of Africa',
    diameter: '420 km',
    slaPeak: '+32 cm',
    lat: 9.0,
    lon: 53.5,
    status: 'Persistent Structure',
    description: 'Energetic anticyclonic gyre with rotational velocities exceeding 2.2 m/s, forming annual seasonal clockwise circulation off the Somali coast.',
  },
  {
    id: 'noctiluca_bloom',
    name: 'Noctiluca Scintillans Green Tide',
    type: 'bloom',
    category: 'Harmful Algae Event',
    basin: 'Northern Arabian Sea',
    chlPeak: '18.4 mg/m³',
    lat: 21.5,
    lon: 64.0,
    status: 'Winter Bloom',
    description: 'Widespread dinoflagellate green algal bloom replacing traditional diatom populations due to oxygen-deficient subsurface waters.',
  },
];

export const useOceanStore = create((set, get) => ({
  // Active Page / Viewport Mode
  activePage: 'home', // 'home' (3D Hero Globe) | 'explorer' | 'comparison' | 'analytics' | 'data' | 'methodology'
  setActivePage: (activePage) => {
    set({ activePage });
    window.scrollTo(0, 0);
  },

  // Floating Contextual Overlays:
  // null | 'vitalSigns' | 'missions' | 'events' | 'depth' | 'layers' | 'workspaces' | 'info' | 'search'
  activeOverlay: null,
  toggleOverlay: (name) => set((state) => ({
    activeOverlay: state.activeOverlay === name ? null : name,
  })),
  closeAllOverlays: () => set({ activeOverlay: null }),

  // Contextual Selected Entity for Floating Inspector Card
  selectedEntity: {
    type: 'dataset',
    id: 'temp',
    title: 'Sea Surface Temperature',
    subtitle: 'Global & Indian Ocean Surface Thermal Layer',
    range: '18.5°C — 31.8°C',
    resolution: '1/12° (approx. 9 km)',
    source: 'INCOIS Bio-ROMS / INSAT-3D Satellite Assimilation',
    description: 'High-resolution surface temperature field driving air-sea heat exchange and monsoon thermodynamics across the Indian Ocean basin.',
  },
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  // Ocean Vital Signs State
  activeVitalSign: 'temp',
  vitalSignCategory: 'surface', // 'surface' | 'subsurface' | 'dynamic'
  selectVitalSign: (signId) => {
    const allSigns = [
      ...VITAL_SIGNS_CATALOG.surface,
      ...VITAL_SIGNS_CATALOG.subsurface,
      ...VITAL_SIGNS_CATALOG.dynamic,
    ];
    const sign = allSigns.find((s) => s.id === signId) || allSigns[0];

    // Set variable and colormap
    set({
      activeVitalSign: sign.id,
      variable: (sign.id === 'salt' || sign.id === 'sal_depth') ? 'salt' : (sign.id === 'chl' || sign.id === 'blooms') ? 'chl' : 'temp',
      colormap: sign.colormap,
      selectedEntity: {
        type: 'dataset',
        id: sign.id,
        title: sign.name,
        subtitle: `${sign.source} (${sign.units})`,
        range: `${sign.range[0]} — ${sign.range[1]} ${sign.units}`,
        resolution: sign.resolution,
        source: sign.source,
        description: sign.description,
      },
    });

    // Update 3D volume/shader if in model
    get().fetchVolumeData();
  },

  // Depth Exploration State
  depthLevelMeters: 0,
  setDepthLevelMeters: (depth) => {
    set({
      depthLevelMeters: depth,
      sliceDepthMeters: depth,
      enableSlice: depth > 0,
    });
    // Trigger update in scene controller
    if (get().layers.depthSlice !== (depth > 0)) {
      get().setLayer('depthSlice', depth > 0);
    }
  },

  // Observing Missions State
  activeMissionId: null,
  selectMission: (missionId) => {
    const mission = OBSERVING_MISSIONS.find((m) => m.id === missionId);
    if (!mission) return;
    set({
      activeMissionId: mission.id,
      selectedEntity: {
        type: 'mission',
        id: mission.id,
        title: mission.name,
        subtitle: `${mission.agency} · ${mission.status}`,
        details: mission.sensors || mission.depthRange,
        coordinates: `${mission.lat.toFixed(2)}°N, ${mission.lon.toFixed(2)}°E`,
        source: mission.agency,
        description: mission.description,
      },
    });
    get().focusCoordinateInExplorer(mission.lat, mission.lon, mission.name);
  },

  // Ocean Events State
  activeEventId: null,
  selectOceanEvent: (eventId) => {
    const ev = OCEAN_EVENTS.find((e) => e.id === eventId);
    if (!ev) return;
    set({
      activeEventId: ev.id,
      selectedEntity: {
        type: 'event',
        id: ev.id,
        title: ev.name,
        subtitle: `${ev.category} · ${ev.basin}`,
        details: ev.maxWinds || ev.anomaly || ev.sstDepression || ev.chlPeak,
        coordinates: `${ev.lat.toFixed(2)}°N, ${ev.lon.toFixed(2)}°E`,
        source: ev.date || 'Active Event',
        description: ev.description,
      },
    });
    get().focusCoordinateInExplorer(ev.lat, ev.lon, ev.name);
  },

  // Coordinate Search & Location Focusing
  isGoToLocationOpen: false,
  toggleGoToLocationModal: () => set((state) => ({ isGoToLocationOpen: !state.isGoToLocationOpen })),
  targetCoordinate: null, // { lat, lon, label }

  // Datasets & System Health
  health: null,
  datasets: [],
  activeDataset: '',
  metadata: null,

  // Scientific Controls
  variable: 'temp',
  renderMode: 'volume', // 'volume' | 'iso'
  colormap: 'turbo',    // 'turbo' | 'viridis' | 'thermal' | 'jet'
  timeIndex: 0,
  depthIndex: 0,
  opacity: 1.2,
  threshold: 0.05,
  isoValue: 0.65,
  sliceDepthMeters: 0,
  enableSlice: false,
  verticalExaggeration: 1.0,

  // View Mode: 'globe' (3D Interactive Earth) | 'ocean3d' (Volumetric Raymarching)
  viewMode: 'globe',
  setViewMode: (viewMode) => set({ viewMode }),

  // Environmental & Planetary 3D Layers
  layers: {
    earthGlobe: true,
    coastlines: true,
    land: true,
    countryBorders: true,
    graticule: true,
    modelCoverage: true,
    argoSensors: true,
    volumeRaymarch: false,
    atmosphere: true,
    oceanSurface: true,
    depthSlice: false,
    currentVectors: true,
    satellites: true,
    events: true,
    bathymetricFloor: false,
    marinePlatform: true,
    weatherOverlay: false,
  },

  // Marine Station Telemetry
  platformTelemetry: {
    id: 'INCOIS_OCEAN_STATION_01',
    name: 'INCOIS Moored Marine Intelligence Station (Arabian Sea)',
    type: 'moored_station',
    latitude: 14.50,
    longitude: 68.20,
    depth: 0.0,
    status: 'operational',
    battery_level: 98,
    sea_surface_temp: 28.45,
    salinity: 35.82,
    wave_height_hs: 1.65,
    wave_period_tp: 7.2,
    current_speed: 0.42,
    current_direction: 245,
    wind_speed: 14.2,
    wind_direction: 230,
    atmospheric_pressure: 1012.4,
    last_transmission_utc: '2026-08-25T18:00:00Z',
  },
  selectedPlatform: null,

  // 3D Volume Binary Buffer & Headers Metadata
  volumeBuffer: null,
  volumeMeta: null,

  // Real-Time 3D Cursor Probe Sample
  cursorProbe: null, // { lon, lat, depth, scalarVal, unit }

  // Argo In-Situ Floats & Inspection
  argoFloats: [],
  argoSources: [],
  argoMetadata: null,
  activeArgoSource: 'all',
  argoFilterQC: true,
  activeArgoProfile: null,
  selectedFloat: null,
  selectedCycle: null,
  activeInspectorTab: 'argo', // 'argo' | 'telemetry' | 'metadata'

  // Model vs Observation Validation Profile
  comparisonData: null,
  isModalOpen: false,
  isLoading: false,
  loadingMessage: 'INITIALIZING SCIENTIFIC WORKSTATION',
  errorState: null,

  // Timeline & Playback
  isPlayingTimeline: false,
  playbackSpeed: 1.0, // 0.5, 1.0, 2.0

  // Viewport Settings & Camera Presets
  cameraAction: null, // 'cinematic' | 'operational' | 'geospatial' | 'subsurface' | 'platform' | 'top' | 'front' | 'side' | 'reset'
  showGrid: true,
  showBoundingBox: true,
  cursorCoords: null, // { lon, lat, depth }

  // Panels, Drawers & Shortcuts
  isDiagnosticsOpen: false,
  isControlPanelOpen: false,
  isInspectorOpen: false,
  isShortcutsModalOpen: false,

  // Actions
  setSeaState: (seaState) => set({ seaState }),

  toggleLayer: (layerId) => set((state) => ({
    layers: { ...state.layers, [layerId]: !state.layers[layerId] }
  })),

  setLayer: (layerId, enabled) => set((state) => ({
    layers: { ...state.layers, [layerId]: enabled }
  })),

  selectPlatform: (platform) => set({
    selectedPlatform: platform,
    activeInspectorTab: 'telemetry',
    selectedEntity: {
      type: 'station',
      id: platform.id,
      title: platform.name,
      subtitle: `Moored Observation Station (${platform.status.toUpperCase()})`,
      coordinates: `${platform.latitude.toFixed(2)}°N, ${platform.longitude.toFixed(2)}°E`,
      details: `SST: ${platform.sea_surface_temp}°C | Sal: ${platform.salinity} PSU | Hs: ${platform.wave_height_hs}m`,
      source: 'INCOIS Marine Observation Network',
      description: 'Real-time telemetry buoy capturing continuous air-sea fluxes, directional wave spectra, and subsurface ocean temperature.',
    },
  }),

  setCursorProbe: (probe) => set({ cursorProbe: probe }),

  toggleShortcutsModal: () => set((state) => ({ isShortcutsModalOpen: !state.isShortcutsModalOpen })),

  fetchInitialData: async () => {
    try {
      set({ isLoading: true, loadingMessage: 'INITIALIZING EYES ON THE OCEAN', errorState: null });

      // 1. Health check
      let health = null;
      try {
        const healthRes = await fetch(`${API_BASE}/api/v1/health`);
        if (healthRes.ok) {
          health = await healthRes.json();
          set({ health });
        }
      } catch (e) {
        console.warn('Health check unreachable:', e);
      }

      // 2. Available model datasets
      let datasets = [];
      try {
        const modelRes = await fetch(`${API_BASE}/api/v1/model/datasets`);
        if (modelRes.ok) {
          const modelData = await modelRes.json();
          datasets = modelData.datasets || [];
          set({ datasets });
        }
      } catch (e) {
        console.warn('Model datasets unreachable:', e);
      }

      // 3. Argo in-situ floats
      try {
        const argoRes = await fetch(`${API_BASE}/api/v1/observations/argo`);
        if (argoRes.ok) {
          const argoData = await argoRes.json();
          const argoFloats = Array.isArray(argoData) ? argoData : [];
          set({ argoFloats });
          if (argoFloats.length > 0) {
            set({ selectedFloat: argoFloats[0], selectedCycle: argoFloats[0].cycles?.[0] || null });
          }
        }
      } catch (e) {
        console.warn('Argo floats unreachable:', e);
      }

      if (datasets.length > 0) {
        const active = datasets[0];
        set({ activeDataset: active });
        await get().selectDataset(active);
      } else {
        set({
          isLoading: false,
          errorState: health?.missing_datasets?.length > 0
            ? 'REAL DATASET REQUIRED: ' + health.missing_datasets.join(', ')
            : 'REAL DATASET REQUIRED: No model NetCDF files in datasets/model/'
        });
      }
    } catch (err) {
      console.error('Error fetching initial ocean data:', err);
      set({ isLoading: false, errorState: 'BACKEND CONNECTION LOST' });
    }
  },

  selectDataset: async (dataset) => {
    if (!dataset) return;
    try {
      set({ activeDataset: dataset, isLoading: true, loadingMessage: `LOADING MODEL METADATA: ${dataset}`, errorState: null });
      const metaRes = await fetch(`${API_BASE}/api/v1/model/metadata?filename=${encodeURIComponent(dataset)}`);
      if (!metaRes.ok) {
        throw new Error(`Model metadata fetch failed with status ${metaRes.status}`);
      }
      const metadata = await metaRes.json();
      set({ metadata, timeIndex: 0 });
      await get().fetchVolumeData();
      set({ isLoading: false });
    } catch (err) {
      console.error('Error selecting dataset:', err);
      set({ isLoading: false, errorState: 'MODEL METADATA UNAVAILABLE' });
    }
  },

  fetchVolumeData: async () => {
    const { activeDataset, variable, timeIndex, metadata } = get();
    if (!activeDataset) return;
    try {
      const timeLabel = metadata?.time_range?.[timeIndex] || `Step ${timeIndex + 1}`;
      set({ isLoading: true, loadingMessage: `STREAMING SCIENTIFIC FLOAT32 BUFFER (${variable.toUpperCase()}, ${timeLabel})` });
      const url = `${API_BASE}/api/v1/model/volume3d?filename=${encodeURIComponent(activeDataset)}&variable=${variable}&time_idx=${timeIndex}&dim_x=64&dim_y=64&dim_z=32`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Volume fetch failed with status ${res.status}`);
      }

      const currentBounds = metadata?.bounds || {};
      const minVal = parseFloat(res.headers.get('X-Data-Min') || '0');
      const maxVal = parseFloat(res.headers.get('X-Data-Max') || '1');
      const dimX = parseInt(res.headers.get('X-Dim-X') || '64', 10);
      const dimY = parseInt(res.headers.get('X-Dim-Y') || '64', 10);
      const dimZ = parseInt(res.headers.get('X-Dim-Z') || '32', 10);
      const minLon = parseFloat(res.headers.get('X-Min-Lon') || String(currentBounds.min_lon ?? 30.0));
      const maxLon = parseFloat(res.headers.get('X-Max-Lon') || String(currentBounds.max_lon ?? 120.0));
      const minLat = parseFloat(res.headers.get('X-Min-Lat') || String(currentBounds.min_lat ?? -30.0));
      const maxLat = parseFloat(res.headers.get('X-Max-Lat') || String(currentBounds.max_lat ?? 30.0));
      const minDepth = parseFloat(res.headers.get('X-Min-Depth') || '0');
      const maxDepth = parseFloat(res.headers.get('X-Max-Depth') || '2000');
      const hasNan = res.headers.get('X-Has-Nan') === 'True';
      const nanValue = parseFloat(res.headers.get('X-Nan-Value') || '-1.0');
      const units = res.headers.get('X-Units') || '';

      const arrayBuffer = await res.arrayBuffer();
      const float32 = new Float32Array(arrayBuffer);

      set({
        volumeBuffer: float32,
        volumeMeta: {
          minVal, maxVal, dimX, dimY, dimZ,
          minLon, maxLon, minLat, maxLat, minDepth, maxDepth,
          hasNan, nanValue, variable, units
        },
        isLoading: false,
        errorState: null,
      });
    } catch (err) {
      console.error('Error fetching 3D volume buffer:', err);
      set({ isLoading: false, errorState: 'MODEL 3D VOLUME DATA UNAVAILABLE' });
    }
  },

  setVariable: (variable) => {
    set({ variable });
    get().fetchVolumeData();
    if (get().isModalOpen && get().selectedFloat) {
      get().fetchComparison(get().selectedFloat.platform_number, get().selectedCycle || undefined);
    }
  },

  setRenderMode: (renderMode) => set({ renderMode }),
  setColormap: (colormap) => set({ colormap }),

  setTimeIndex: (timeIndex) => {
    set({ timeIndex });
    get().fetchVolumeData();
  },

  stepTimeIndex: (delta) => {
    const { timeIndex, metadata } = get();
    const maxTime = metadata?.time_range?.length || 5;
    let nextIndex = timeIndex + delta;
    if (nextIndex < 0) nextIndex = maxTime - 1;
    if (nextIndex >= maxTime) nextIndex = 0;
    get().setTimeIndex(nextIndex);
  },

  setDepthIndex: (depthIndex) => set({ depthIndex }),
  setOpacity: (opacity) => set({ opacity }),
  setThreshold: (threshold) => set({ threshold }),
  setIsoValue: (isoValue) => set({ isoValue }),
  setSliceDepthMeters: (sliceDepthMeters) => set({ sliceDepthMeters }),
  setEnableSlice: (enableSlice) => set({ enableSlice }),
  setVerticalExaggeration: (verticalExaggeration) => set({ verticalExaggeration }),

  toggleTimelinePlayback: () => {
    const isPlaying = !get().isPlayingTimeline;
    set({ isPlayingTimeline: isPlaying });
  },

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  fetchArgoSources: async () => {
    try {
      const [srcRes, metaRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/observations/sources`),
        fetch(`${API_BASE}/api/v1/observations/metadata`),
      ]);
      if (srcRes.ok) {
        const argoSources = await srcRes.json();
        set({ argoSources: Array.isArray(argoSources) ? argoSources : [] });
      }
      if (metaRes.ok) {
        const argoMetadata = await metaRes.json();
        set({ argoMetadata });
      }
    } catch (e) {
      console.warn('Failed to fetch Argo sources or metadata:', e);
    }
  },

  setActiveArgoSource: async (source) => {
    set({ activeArgoSource: source });
    await get().fetchArgoFloats(source);
  },

  setArgoFilterQC: (argoFilterQC) => {
    set({ argoFilterQC });
    const { selectedFloat, selectedCycle } = get();
    if (selectedFloat) {
      get().fetchArgoProfile(selectedFloat.platform_number, selectedCycle, argoFilterQC);
    }
  },

  fetchArgoFloats: async (source = null) => {
    try {
      const activeSrc = source || get().activeArgoSource;
      let url = `${API_BASE}/api/v1/observations/argo?limit=500`;
      if (activeSrc && activeSrc !== 'all') {
        url += `&source=${encodeURIComponent(activeSrc)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const argoData = await res.json();
        const argoFloats = Array.isArray(argoData) ? argoData : [];
        set({ argoFloats });
        if (argoFloats.length > 0 && !get().selectedFloat) {
          get().selectFloat(argoFloats[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Argo floats:', e);
    }
  },

  fetchArgoProfile: async (platformNumber, cycle = null, filterQC = true) => {
    if (!platformNumber) return;
    try {
      let url = `${API_BASE}/api/v1/observations/argo/${encodeURIComponent(platformNumber)}/profile?filter_qc=${filterQC}`;
      if (cycle !== null && cycle !== undefined) {
        url += `&cycle_number=${cycle}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const profile = await res.json();
        set({ activeArgoProfile: profile });
        return profile;
      }
    } catch (e) {
      console.warn(`Failed to fetch Argo profile for ${platformNumber}:`, e);
    }
    return null;
  },

  selectFloat: async (float) => {
    if (!float) return;
    const firstCycle = float.cycles?.[0] ?? float.latest_cycle ?? null;
    const isCoriolis = String(float.source || '').toLowerCase() === 'coriolis' || String(float.dac || '').toLowerCase().includes('coriolis');
    set({
      selectedFloat: float,
      selectedCycle: firstCycle,
      activeInspectorTab: 'argo',
      selectedEntity: {
        type: 'float',
        id: float.platform_number,
        title: `${isCoriolis ? 'Coriolis / Euro-Argo' : 'INCOIS Argo'} Float ${float.platform_number}`,
        subtitle: `Autonomous CTD Profiler (${float.profiles_count} Recorded Cycles)`,
        coordinates: `${float.latest_position.latitude.toFixed(2)}°N, ${float.latest_position.longitude.toFixed(2)}°E`,
        details: `${float.dac || 'Coriolis GDAC'} Quality Controlled Data (TEOS-10 Calibrated)`,
        source: isCoriolis ? 'Coriolis / Euro-Argo GDAC (Ifremer)' : 'INCOIS Ocean Observing Array',
        description: 'Conductivity-Temperature-Depth autonomous robotic profiler sampling from 2000m depth to surface every 10 days.',
      },
    });
    get().fetchArgoProfile(float.platform_number, firstCycle, get().argoFilterQC);
  },

  selectFloatAndCompare: async (float) => {
    if (!float) return;
    const firstCycle = float.cycles?.[0] ?? float.latest_cycle ?? null;
    set({ selectedFloat: float, selectedCycle: firstCycle, activeInspectorTab: 'argo' });
    get().fetchArgoProfile(float.platform_number, firstCycle, get().argoFilterQC);
    await get().fetchComparison(float.platform_number, firstCycle);
  },

  setSelectedCycle: (cycle) => {
    set({ selectedCycle: cycle });
    const { selectedFloat, isModalOpen, argoFilterQC } = get();
    if (selectedFloat) {
      get().fetchArgoProfile(selectedFloat.platform_number, cycle, argoFilterQC);
      if (isModalOpen) {
        get().fetchComparison(selectedFloat.platform_number, cycle);
      }
    }
  },

  fetchComparison: async (platformNumber, cycle) => {
    const { variable, activeDataset } = get();
    // Comparison endpoint only supports temp and salt
    const compVar = (variable === 'salt' || variable === 'temp') ? variable : 'temp';
    try {
      set({ isLoading: true, loadingMessage: `CALCULATING 4D RESIDUALS FOR WMO ${platformNumber}` });
      let url = `${API_BASE}/api/v1/comparison/profile?platform_number=${encodeURIComponent(platformNumber)}&variable=${compVar}`;
      if (activeDataset) {
        url += `&model_filename=${encodeURIComponent(activeDataset)}`;
      }
      if (cycle !== undefined && cycle !== null) {
        url += `&cycle_number=${cycle}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Comparison failed with status ${res.status}`);
      }
      const comparisonData = await res.json();
      set({ comparisonData, isModalOpen: true, isLoading: false, errorState: null });
    } catch (err) {
      console.error('Error fetching comparison profile:', err);
      set({ isLoading: false, errorState: 'ARGO PROFILE COMPARISON UNAVAILABLE' });
    }
  },

  closeModal: () => set({ isModalOpen: false }),
  openModal: () => {
    const { selectedFloat, selectedCycle } = get();
    if (selectedFloat) {
      get().fetchComparison(selectedFloat.platform_number, selectedCycle);
    }
  },

  triggerCameraAction: (action) => {
    set({ cameraAction: action });
  },
  clearCameraAction: () => set({ cameraAction: null }),

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleBoundingBox: () => set((state) => ({ showBoundingBox: !state.showBoundingBox })),
  setCursorCoords: (coords) => set({ cursorCoords: coords }),

  setTargetCoordinate: (coord) => set({ targetCoordinate: coord }),
  
  focusCoordinateInExplorer: (lat, lon, label) => {
    set({
      targetCoordinate: { lat, lon, label: label || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E` },
      isGoToLocationOpen: false,
    });
  },

  setActiveInspectorTab: (tab) => set({ activeInspectorTab: tab }),
  toggleDiagnostics: () => set((state) => ({ isDiagnosticsOpen: !state.isDiagnosticsOpen })),
  toggleControlPanel: () => set((state) => ({ isControlPanelOpen: !state.isControlPanelOpen })),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
}));
