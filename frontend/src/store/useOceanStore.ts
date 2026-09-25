import { create } from 'zustand';
import { fetchCatalog, DataCatalog, VariableCatalogEntry } from '../api/client';
import { nearestTime, normalizeTimes, StepUnit, toMs } from '../timeline/timelineEngine';
import { configureGrid } from '../rendering/grid';

export const MODEL_FIELDS = ['temperature', 'salinity', 'chlorophyll', 'mld', 'currents'] as const;

export type LayerState = 'loading' | 'ok' | 'nodata' | 'error';
export interface LayerStatus {
  state: LayerState;
  message?: string;
}

export interface OceanState {
  // Mode
  mode: 'home' | 'operational' | 'outreach';
  setMode: (mode: 'home' | 'operational' | 'outreach') => void;

  // Data catalog (real variables, depths, timesteps, provenance)
  catalog: DataCatalog | null;
  catalogError: string | null;
  loadCatalog: () => Promise<void>;
  layerStatus: Record<string, LayerStatus>;
  setLayerStatus: (layerId: string, status: LayerStatus) => void;

  // Active layer toggles
  activeLayers: string[];
  toggleLayer: (layerId: string) => void;
  setLayers: (layers: string[]) => void;

  // Active gridded variable
  selectedVariable: string;
  setSelectedVariable: (variable: string) => void;

  // Depth-slice & vertical axis
  depthLevel: number;
  setDepthLevel: (depth: number) => void;
  verticalExaggeration: number;
  setVerticalExaggeration: (exagg: number) => void;
  is3DVolumeBlockEnabled: boolean;
  setIs3DVolumeBlockEnabled: (enabled: boolean) => void;
  toggle3DVolumeBlock: () => void;

  // Time navigation (all times are real dataset timestamps, ISO UTC)
  timelineStart: string;
  timelineEnd: string;
  timelineStep: { value: number; unit: StepUnit };
  selectedTime: string;
  availableTimes: string[];
  lastRequestedTime: string | null;
  isPlaying: boolean;
  playbackSpeed: number;
  setTimelineStart: (start: string) => void;
  setTimelineEnd: (end: string) => void;
  setTimelineStep: (step: { value: number; unit: StepUnit }) => void;
  setSelectedTime: (time: string, requested?: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  fetchTimelineMetadata: (variable: string) => void;

  // Visual parameters
  opacity: number;
  setOpacity: (opacity: number) => void;
  colorPalette: string;
  setColorPalette: (palette: string) => void;
  colorRange: [number, number];
  setColorRange: (range: [number, number]) => void;
  scaleType: 'linear' | 'log';
  setScaleType: (type: 'linear' | 'log') => void;
  vectorArrowScale: number;
  setVectorArrowScale: (scale: number) => void;
  currentsSpeed: number;
  setCurrentsSpeed: (speed: number) => void;
  autoCalibrateRange: () => void;

  // Selected observation instrument
  selectedInstrumentId: string | null;
  setSelectedInstrumentId: (id: string | null) => void;

  // Live sampled ocean point (mouse hover)
  hoveredOceanInfo: HoveredOceanInfo | null;
  setHoveredOceanInfo: (info: HoveredOceanInfo | null) => void;

  hoveredCyclone: HoveredCycloneInfo | null;
  setHoveredCyclone: (info: HoveredCycloneInfo | null) => void;

  showLeftPanel: boolean;
  setShowLeftPanel: (show: boolean) => void;
  toggleLeftPanel: () => void;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;
  toggleRightPanel: () => void;

  // Three.js water-column inspector
  activeWaterBlockTarget: WaterBlockTarget | null;
  openWaterBlock: (target: WaterBlockTarget) => void;
  closeWaterBlock: () => void;

  isGraticuleEnabled: boolean;
  setIsGraticuleEnabled: (enabled: boolean) => void;
  toggleGraticule: () => void;

  clickedGlobePoint: { lon: number; lat: number; screenX: number; screenY: number; basin?: string } | null;
  setClickedGlobePoint: (point: { lon: number; lat: number; screenX: number; screenY: number; basin?: string } | null) => void;

  // Model vs Observation comparison modal
  isComparisonModalOpen: boolean;
  comparisonInstrumentId: string | null;
  comparisonVariable: string;
  openComparisonModal: (instrumentId: string, variable?: string) => void;
  closeComparisonModal: () => void;
  setComparisonVariable: (variable: string) => void;

  // Analytics modal
  isAnalyticsModalOpen: boolean;
  analyticsTarget: AnalyticsTarget | null;
  openAnalyticsModal: (target?: AnalyticsTarget) => void;
  closeAnalyticsModal: () => void;
}

export interface AnalyticsTarget {
  lat: number;
  lon: number;
  depth?: number;
  variable?: string;
  name?: string;
}

export interface WaterBlockTarget {
  lon: number;
  lat: number;
  name?: string;
  instrumentId?: string;
  platformType?: string;
  defaultVar?: string;
}

export interface HoveredOceanInfo {
  lon: number;
  lat: number;
  variable: string;
  depth: number;
  value: number;
  unit: string;
  minVal: number;
  maxVal: number;
  screenX: number;
  screenY: number;
  currentSpeed?: number;
  currentHeading?: number;
}

export interface HoveredCycloneInfo {
  name: string;
  location: string;
  lat: number;
  lon: number;
  date: string;
  intensity: string;
  screenX: number;
  screenY: number;
}

/** Default open-ocean location used when no point/instrument is selected (Bay of Bengal). */
export const DEFAULT_OCEAN_POINT = { lat: 15.0, lon: 88.0, name: 'Bay of Bengal (15°N, 88°E)' };

const PALETTES: Record<string, { palette: string; scale: 'linear' | 'log' }> = {
  temperature: { palette: 'noaa_sst', scale: 'linear' },
  salinity: { palette: 'viridis', scale: 'linear' },
  chlorophyll: { palette: 'gfdl_chl', scale: 'log' },
  mld: { palette: 'viridis', scale: 'linear' },
  currents: { palette: 'turbo', scale: 'linear' }
};

export function variableMeta(state: Pick<OceanState, 'catalog'>, variable: string): VariableCatalogEntry | null {
  return state.catalog?.variables[variable] ?? null;
}

function timesFor(catalog: DataCatalog | null, variable: string): string[] {
  const meta = catalog?.variables[variable];
  return meta ? normalizeTimes(meta.timesteps) : [];
}

function resolveTimeline(catalog: DataCatalog | null, variable: string, previous: string) {
  const times = timesFor(catalog, variable);
  if (!times.length) {
    return { availableTimes: [], timelineStart: '', timelineEnd: '', selectedTime: '', lastRequestedTime: null };
  }
  const selected = previous && times.includes(previous)
    ? previous
    : previous
      ? (nearestTime(times, toMs(previous)) as string)
      : times[times.length - 1];
  return {
    availableTimes: times,
    timelineStart: times[0],
    timelineEnd: times[times.length - 1],
    selectedTime: selected,
    lastRequestedTime: previous && previous !== selected ? previous : null
  };
}

function rangeFor(catalog: DataCatalog | null, variable: string): [number, number] {
  const meta = catalog?.variables[variable];
  return meta ? [meta.display_range[0], meta.display_range[1]] : [0, 1];
}

export const useOceanStore = create<OceanState>((set, get) => ({
  mode: 'home',
  setMode: (mode) => set({ mode }),

  catalog: null,
  catalogError: null,
  loadCatalog: async () => {
    if (get().catalog) return;
    try {
      const catalog = await fetchCatalog();
      configureGrid(catalog.grid);
      const variable = catalog.variables[get().selectedVariable] ? get().selectedVariable : 'temperature';
      const meta = catalog.variables[variable];
      set({
        catalog,
        catalogError: null,
        selectedVariable: variable,
        depthLevel: meta.depths.includes(get().depthLevel) ? get().depthLevel : meta.depths[0],
        colorRange: rangeFor(catalog, variable),
        colorPalette: PALETTES[variable]?.palette ?? 'turbo',
        scaleType: PALETTES[variable]?.scale ?? 'linear',
        ...resolveTimeline(catalog, variable, get().selectedTime)
      });
    } catch (err) {
      set({ catalogError: `Data catalog unavailable: ${(err as Error).message}` });
    }
  },
  layerStatus: {},
  setLayerStatus: (layerId, status) =>
    set((s) => {
      const prev = s.layerStatus[layerId];
      if (prev && prev.state === status.state && prev.message === status.message) return {};
      return { layerStatus: { ...s.layerStatus, [layerId]: status } };
    }),

  activeLayers: ['temperature', 'argo', 'india_eez'],
  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layerId)
        ? state.activeLayers.filter((id) => id !== layerId)
        : [...state.activeLayers, layerId]
    })),
  setLayers: (activeLayers) => set({ activeLayers: activeLayers.filter((id) => id !== 'glider' && id !== 'moored_buoy') }),

  selectedVariable: 'temperature',
  setSelectedVariable: (selectedVariable) => {
    const { catalog, selectedTime, activeLayers, depthLevel } = get();
    const meta = catalog?.variables[selectedVariable];
    // Only one gridded field is rendered as the depth slice; currents keep their own vector layer.
    const others = activeLayers.filter((id) => id === 'currents' || !(MODEL_FIELDS as readonly string[]).includes(id));
    set({
      selectedVariable,
      colorPalette: PALETTES[selectedVariable]?.palette ?? 'turbo',
      scaleType: PALETTES[selectedVariable]?.scale ?? 'linear',
      colorRange: rangeFor(catalog, selectedVariable),
      activeLayers: others.includes(selectedVariable) ? others : [...others, selectedVariable],
      depthLevel: meta && !meta.depths.includes(depthLevel) ? meta.depths[0] : depthLevel,
      ...(catalog ? resolveTimeline(catalog, selectedVariable, selectedTime) : {})
    });
  },

  colorPalette: 'noaa_sst',
  setColorPalette: (colorPalette) => set({ colorPalette }),
  colorRange: [0, 1],
  setColorRange: (colorRange) => set({ colorRange }),
  scaleType: 'linear',
  setScaleType: (scaleType) => set({ scaleType }),
  vectorArrowScale: 1.0,
  setVectorArrowScale: (vectorArrowScale) => set({ vectorArrowScale }),
  currentsSpeed: 1.0,
  setCurrentsSpeed: (currentsSpeed) => set({ currentsSpeed }),
  autoCalibrateRange: () => set((s) => ({ colorRange: rangeFor(s.catalog, s.selectedVariable) })),

  depthLevel: 0,
  setDepthLevel: (depthLevel) => set({ depthLevel }),
  verticalExaggeration: 250.0,
  setVerticalExaggeration: (verticalExaggeration) => set({ verticalExaggeration }),
  is3DVolumeBlockEnabled: false,
  setIs3DVolumeBlockEnabled: (is3DVolumeBlockEnabled) => set({ is3DVolumeBlockEnabled }),
  toggle3DVolumeBlock: () => set((s) => ({ is3DVolumeBlockEnabled: !s.is3DVolumeBlockEnabled })),

  activeWaterBlockTarget: null,
  openWaterBlock: (target) => set({ activeWaterBlockTarget: target, clickedGlobePoint: null }),
  closeWaterBlock: () => set({ activeWaterBlockTarget: null }),

  clickedGlobePoint: null,
  setClickedGlobePoint: (clickedGlobePoint) => set({ clickedGlobePoint }),

  timelineStart: '',
  timelineEnd: '',
  timelineStep: { value: 1, unit: 'months' },
  selectedTime: '',
  availableTimes: [],
  lastRequestedTime: null,
  isPlaying: false,
  playbackSpeed: 1,
  setTimelineStart: (timelineStart) => set({ timelineStart }),
  setTimelineEnd: (timelineEnd) => set({ timelineEnd }),
  setTimelineStep: (timelineStep) => set({ timelineStep }),
  setSelectedTime: (selectedTime, requested = null) =>
    set((s) => (s.availableTimes.includes(selectedTime)
      ? { selectedTime, lastRequestedTime: requested && requested !== selectedTime ? requested : null }
      : {})),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  fetchTimelineMetadata: (variable) => {
    const { catalog, selectedTime } = get();
    if (catalog) set(resolveTimeline(catalog, variable, selectedTime));
  },

  opacity: 0.85,
  setOpacity: (opacity) => set({ opacity }),

  selectedInstrumentId: null,
  setSelectedInstrumentId: (selectedInstrumentId) => set({ selectedInstrumentId }),

  hoveredOceanInfo: null,
  setHoveredOceanInfo: (hoveredOceanInfo) => set({ hoveredOceanInfo }),

  hoveredCyclone: null,
  setHoveredCyclone: (hoveredCyclone) => set({ hoveredCyclone }),

  showLeftPanel: true,
  setShowLeftPanel: (showLeftPanel) => set({ showLeftPanel }),
  toggleLeftPanel: () => set((s) => ({ showLeftPanel: !s.showLeftPanel })),

  showRightPanel: true,
  setShowRightPanel: (showRightPanel) => set({ showRightPanel }),
  toggleRightPanel: () => set((s) => ({ showRightPanel: !s.showRightPanel })),

  isGraticuleEnabled: true,
  setIsGraticuleEnabled: (isGraticuleEnabled) => set({ isGraticuleEnabled }),
  toggleGraticule: () => set((s) => ({ isGraticuleEnabled: !s.isGraticuleEnabled })),

  isComparisonModalOpen: false,
  comparisonInstrumentId: null,
  comparisonVariable: 'temperature',
  openComparisonModal: (instrumentId, variable = 'temperature') =>
    set({
      isComparisonModalOpen: true,
      comparisonInstrumentId: instrumentId,
      comparisonVariable: ['temperature', 'salinity'].includes(variable) ? variable : 'temperature'
    }),
  closeComparisonModal: () => set({ isComparisonModalOpen: false, comparisonInstrumentId: null }),
  setComparisonVariable: (comparisonVariable) => set({ comparisonVariable }),

  isAnalyticsModalOpen: false,
  analyticsTarget: null,
  openAnalyticsModal: (target) =>
    set((s) => ({
      isAnalyticsModalOpen: true,
      analyticsTarget: target || (s.clickedGlobePoint
        ? { lat: s.clickedGlobePoint.lat, lon: s.clickedGlobePoint.lon, name: s.clickedGlobePoint.basin }
        : { ...DEFAULT_OCEAN_POINT }),
    })),
  closeAnalyticsModal: () => set({ isAnalyticsModalOpen: false })
}));

if (typeof window !== 'undefined') {
  (window as any).__OCEAN_STORE__ = useOceanStore;
}
