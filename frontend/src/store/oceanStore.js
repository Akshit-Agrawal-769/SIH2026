import { create } from 'zustand';

export const useOceanStore = create((set, get) => ({
  // Multi-Page Navigation
  // 'home' | 'explorer' | 'coordinates' | 'argo' | 'comparison' | 'analytics' | 'data' | 'methodology'
  activePage: 'home',
  setActivePage: (activePage) => {
    set({ activePage });
    window.scrollTo(0, 0);
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
  sliceDepthMeters: 50,
  enableSlice: false,
  verticalExaggeration: 1.0,

  // Sea State Environmental Simulation
  seaState: 'moderate', // 'calm' | 'moderate' | 'rough' | 'storm'

  // Environmental & Marine Infrastructure Layers
  layers: {
    oceanSurface: true,
    currentVectors: true,
    volumeRaymarch: true,
    depthSlice: false,
    bathymetricFloor: true,
    argoSensors: true,
    marinePlatform: true,
    weatherOverlay: false,
    coastlines: true,
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
  isControlPanelOpen: true,
  isInspectorOpen: true,
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
  }),

  setCursorProbe: (probe) => set({ cursorProbe: probe }),

  toggleShortcutsModal: () => set((state) => ({ isShortcutsModalOpen: !state.isShortcutsModalOpen })),

  fetchInitialData: async () => {
    try {
      set({ isLoading: true, loadingMessage: 'VERIFYING SYSTEM HEALTH AND DATASETS', errorState: null });

      // 1. Health check
      let health = null;
      try {
        const healthRes = await fetch('/api/v1/health');
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
        const modelRes = await fetch('/api/v1/model/datasets');
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
        const argoRes = await fetch('/api/v1/observations/argo');
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
      const metaRes = await fetch(`/api/v1/model/metadata?filename=${encodeURIComponent(dataset)}`);
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
      const url = `/api/v1/model/volume3d?filename=${encodeURIComponent(activeDataset)}&variable=${variable}&time_idx=${timeIndex}&dim_x=64&dim_y=64&dim_z=32`;
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

  selectFloat: async (float) => {
    if (!float) return;
    const firstCycle = float.cycles?.[0] ?? null;
    set({ selectedFloat: float, selectedCycle: firstCycle, activeInspectorTab: 'argo' });
  },

  selectFloatAndCompare: async (float) => {
    if (!float) return;
    const firstCycle = float.cycles?.[0] ?? null;
    set({ selectedFloat: float, selectedCycle: firstCycle, activeInspectorTab: 'argo' });
    await get().fetchComparison(float.platform_number, firstCycle);
  },

  setSelectedCycle: (cycle) => {
    set({ selectedCycle: cycle });
    const { selectedFloat, isModalOpen } = get();
    if (isModalOpen && selectedFloat) {
      get().fetchComparison(selectedFloat.platform_number, cycle);
    }
  },

  fetchComparison: async (platformNumber, cycle) => {
    const { variable, activeDataset } = get();
    // Comparison endpoint only supports temp and salt
    const compVar = (variable === 'salt' || variable === 'temp') ? variable : 'temp';
    try {
      set({ isLoading: true, loadingMessage: `CALCULATING 4D RESIDUALS FOR WMO ${platformNumber}` });
      let url = `/api/v1/comparison/profile?platform_number=${encodeURIComponent(platformNumber)}&variable=${compVar}`;
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
      activePage: 'explorer',
      targetCoordinate: { lat, lon, label: label || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E` },
      isGoToLocationOpen: false,
    });
  },

  setActiveInspectorTab: (tab) => set({ activeInspectorTab: tab }),
  toggleDiagnostics: () => set((state) => ({ isDiagnosticsOpen: !state.isDiagnosticsOpen })),
  toggleControlPanel: () => set((state) => ({ isControlPanelOpen: !state.isControlPanelOpen })),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
}));
