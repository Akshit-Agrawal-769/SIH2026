import { create } from 'zustand';
import { fetchCatalog, DataCatalog } from '../api/client';
import { nearestTime, normalizeTimes, StepUnit, toMs } from '../timeline/timelineEngine';
import { configureGrid } from '../rendering/grid';
import { formatLatLon } from '../lib/geo';
import {
  Advisory, CycloneTracksDoc, DisasterLayerId, DriftMode, DriftOptions, DriftResult, DriftSkillDoc, DriftWindow,
  EddySummary, ExtLayerId, ExtLayerMeta, ExtSummary, MhwSummary, MonthlyLayerId, Unavailable, ValidationDoc,
  EXT_LAYERS, fetchAdvisories, fetchCycloneTracks, fetchDrift, fetchDriftSkill, fetchDriftWindow, fetchEddySummary,
  fetchExtCatalog, fetchExtSummary, fetchMhwSummary, fetchValidation, isExtLayer
} from '../api/hazardsClient';

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

  clickedGlobePoint: { lon: number; lat: number; screenX: number; screenY: number } | null;
  setClickedGlobePoint: (point: { lon: number; lat: number; screenX: number; screenY: number } | null) => void;

  // Model vs Observation comparison modal
  isComparisonModalOpen: boolean;
  comparisonInstrumentId: string | null;
  comparisonVariable: string;
  openComparisonModal: (instrumentId: string, variable?: string) => void;
  closeComparisonModal: () => void;
  setComparisonVariable: (variable: string) => void;

  // Disaster Early Warning (derived layers; every value comes from /api/hazards/*)
  activeDisasterLayers: DisasterLayerId[];
  toggleDisasterLayer: (id: DisasterLayerId) => void;
  driftSimulationCoordinates: { lat: number; lon: number } | null;
  setDriftSimulationCoordinates: (p: { lat: number; lon: number } | null) => void;
  driftMode: DriftMode;
  setDriftMode: (mode: DriftMode) => void;
  driftHours: number;
  setDriftHours: (hours: number) => void;
  isPickingDriftPoint: boolean;
  setIsPickingDriftPoint: (picking: boolean) => void;
  driftResult: DriftResult | Unavailable | null;
  driftLoading: boolean;
  driftOptions: DriftOptions;
  setDriftOptions: (patch: Partial<DriftOptions>) => void;
  driftWindow: DriftWindow | Unavailable | null;
  loadDriftWindow: () => Promise<void>;
  runDriftSimulation: () => Promise<void>;
  clearDrift: () => void;
  /** Monthly summaries for hazardDate (named for the indicator, not a risk score). */
  hazardIndicatorData: {
    date: string | null;
    mhw: MhwSummary | Unavailable | null;
    monthly: Partial<Record<MonthlyLayerId, MhwSummary | Unavailable>>;
    eddy: EddySummary | Unavailable | null;
  };
  /** Daily / near-real-time layers: catalog (dates per layer), selected date per layer, summaries. */
  extCatalog: Record<ExtLayerId, ExtLayerMeta> | null;
  loadExtCatalog: () => Promise<void>;
  extDates: Partial<Record<ExtLayerId, string>>;
  setExtDate: (layer: ExtLayerId, date: string) => void;
  extSummaries: Partial<Record<ExtLayerId, ExtSummary | Unavailable>>;
  refreshExtSummary: (layer: ExtLayerId) => Promise<void>;
  activeAdvisories: Advisory[];
  advisoriesUnavailable: Record<string, string>;
  hazardsLoading: boolean;
  refreshHazards: () => Promise<void>;
  // IBTrACS tracks, drift skill, validation (static documents with live fallbacks)
  showCycloneTracks: boolean;
  setShowCycloneTracks: (on: boolean) => void;
  cycloneTracks: CycloneTracksDoc | Unavailable | null;
  /** Season range shown; null until the tracks are loaded (defaults to the last 10 seasons in the data). */
  trackSeasons: [number, number] | null;
  setTrackSeasons: (range: [number, number]) => void;
  driftSkill: DriftSkillDoc | Unavailable | null;
  validation: ValidationDoc | Unavailable | null;
  loadHazardDocs: () => Promise<void>;

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
  landfall_time?: string;
  sid?: string;
  source?: string;
}

/**
 * IBR month used by the hazard layers: the selected time when it is an SST timestep,
 * otherwise the latest SST month (e.g. while the 2024-12-31 currents field is selected).
 */
export function hazardDate(state: Pick<OceanState, 'catalog' | 'selectedTime'>): string | null {
  const ts = state.catalog?.variables.temperature?.timesteps ?? [];
  if (!ts.length) return null;
  const sel = state.selectedTime ? state.selectedTime.slice(0, 10) : '';
  return ts.includes(sel) ? sel : ts[ts.length - 1];
}

let hazardAbort: AbortController | null = null;

/** Default open-ocean location used when no point/instrument is selected (Bay of Bengal). */
export const DEFAULT_OCEAN_POINT = { lat: 15.0, lon: 88.0, name: 'Bay of Bengal (15°N, 88°E)' };

const PALETTES: Record<string, { palette: string; scale: 'linear' | 'log' }> = {
  temperature: { palette: 'noaa_sst', scale: 'linear' },
  salinity: { palette: 'viridis', scale: 'linear' },
  chlorophyll: { palette: 'gfdl_chl', scale: 'log' },
  mld: { palette: 'viridis', scale: 'linear' },
  currents: { palette: 'turbo', scale: 'linear' }
};

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
  // The full IBR record is 480 monthly steps (1980-2019): open on the 12 steps ending at the
  // selection; the Start/End pickers still reach any available month.
  const selIdx = times.indexOf(selected);
  const endIdx = Math.max(selIdx, Math.min(times.length - 1, selIdx + 11), Math.min(times.length - 1, 11));
  const startIdx = Math.max(0, Math.min(selIdx, endIdx - 11));
  return {
    availableTimes: times,
    timelineStart: times[startIdx],
    timelineEnd: times[endIdx],
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

  activeDisasterLayers: [],
  toggleDisasterLayer: (id) =>
    set((s) => ({
      activeDisasterLayers: s.activeDisasterLayers.includes(id)
        ? s.activeDisasterLayers.filter((x) => x !== id)
        : [...s.activeDisasterLayers, id]
    })),
  driftSimulationCoordinates: null,
  setDriftSimulationCoordinates: (driftSimulationCoordinates) =>
    set({ driftSimulationCoordinates, isPickingDriftPoint: false, driftResult: null }),
  driftMode: 'forward',
  setDriftMode: (driftMode) => set({ driftMode, driftResult: null }),
  driftHours: 48,
  setDriftHours: (driftHours) => set({ driftHours, driftResult: null }),
  isPickingDriftPoint: false,
  setIsPickingDriftPoint: (isPickingDriftPoint) => set({ isPickingDriftPoint }),
  driftResult: null,
  driftLoading: false,
  driftOptions: { engine: 'ensemble', windage: 'oil', members: 50, diffusivity: null, start: null },
  setDriftOptions: (patch) => set((s) => ({ driftOptions: { ...s.driftOptions, ...patch }, driftResult: null })),
  driftWindow: null,
  loadDriftWindow: async () => {
    if (get().driftWindow) return;
    set({ driftWindow: await fetchDriftWindow() });
  },
  runDriftSimulation: async () => {
    const { driftSimulationCoordinates: p, driftMode, driftHours, driftOptions } = get();
    if (!p) return;
    set({ driftLoading: true, driftResult: null });
    try {
      const r = await fetchDrift(p.lat, p.lon, driftMode, driftHours, driftOptions);
      set({ driftResult: r });
    } catch (err) {
      set({ driftResult: { available: false, reason: (err as Error).message } });
    } finally {
      set({ driftLoading: false });
    }
  },
  clearDrift: () => set({ driftResult: null, driftSimulationCoordinates: null, isPickingDriftPoint: false }),
  hazardIndicatorData: { date: null, mhw: null, monthly: {}, eddy: null },
  extCatalog: null,
  loadExtCatalog: async () => {
    const cat = await fetchExtCatalog().catch(() => null);
    if (!cat) return;
    const dates: Partial<Record<ExtLayerId, string>> = { ...get().extDates };
    for (const id of EXT_LAYERS) {
      const ds = cat[id]?.dates ?? [];
      if (ds.length && !(dates[id] && ds.includes(dates[id]!))) dates[id] = ds[ds.length - 1];
    }
    set({ extCatalog: cat, extDates: dates });
  },
  extDates: {},
  setExtDate: (layer, date) => {
    set((s) => ({ extDates: { ...s.extDates, [layer]: date } }));
    if (get().activeDisasterLayers.includes(layer)) void get().refreshExtSummary(layer);
  },
  extSummaries: {},
  refreshExtSummary: async (layer) => {
    const date = get().extDates[layer] ?? null;
    const r = await fetchExtSummary(layer, date).catch((err) => ({ available: false as const, reason: (err as Error).message }));
    set((s) => ({ extSummaries: { ...s.extSummaries, [layer]: r } }));
  },
  activeAdvisories: [],
  advisoriesUnavailable: {},
  hazardsLoading: false,
  refreshHazards: async () => {
    const date = hazardDate(get());
    hazardAbort?.abort();
    const ac = new AbortController();
    hazardAbort = ac;
    set({ hazardsLoading: true });
    const active = get().activeDisasterLayers;
    try {
      const monthlyIds = (['mhw_intensity', 'mhw_detrended', 'chl_bloom'] as MonthlyLayerId[]).filter((id) => active.includes(id));
      const [monthlyRes, eddy, adv] = await Promise.all([
        date ? Promise.all(monthlyIds.map((id) => fetchMhwSummary(date, id, ac.signal))) : Promise.resolve([]),
        date && active.includes('eddy_convergence') ? fetchEddySummary(date, ac.signal) : Promise.resolve(null),
        fetchAdvisories(date, ac.signal)
      ]);
      for (const id of active) if (isExtLayer(id)) void get().refreshExtSummary(id);
      if (ac.signal.aborted) return;
      const monthly: Partial<Record<MonthlyLayerId, MhwSummary | Unavailable>> = {};
      monthlyIds.forEach((id, i) => { monthly[id] = monthlyRes[i]; });
      set({
        hazardIndicatorData: { date, mhw: monthly.mhw_intensity ?? null, monthly, eddy },
        activeAdvisories: 'advisories' in adv ? adv.advisories : [],
        advisoriesUnavailable: 'advisories' in adv ? adv.unavailable : { advisories: adv.reason }
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        set({ advisoriesUnavailable: { advisories: (err as Error).message } });
      }
    } finally {
      if (hazardAbort === ac) set({ hazardsLoading: false });
    }
  },
  showCycloneTracks: false,
  setShowCycloneTracks: (showCycloneTracks) => {
    set({ showCycloneTracks });
    if (showCycloneTracks && !get().cycloneTracks) {
      void fetchCycloneTracks().then((cycloneTracks) => {
        const seasons = 'storms' in cycloneTracks ? cycloneTracks.storms.map((st) => st.season) : [];
        const last = seasons.length ? Math.max(...seasons) : null;
        set({
          cycloneTracks,
          trackSeasons: get().trackSeasons ?? (last !== null ? [Math.max(Math.min(...seasons), last - 9), last] : null)
        });
      });
    }
  },
  cycloneTracks: null,
  trackSeasons: null,
  setTrackSeasons: (trackSeasons) => set({ trackSeasons }),
  driftSkill: null,
  validation: null,
  loadHazardDocs: async () => {
    if (get().driftSkill && get().validation) return;
    const [driftSkill, validation] = await Promise.all([fetchDriftSkill(), fetchValidation()]);
    set({ driftSkill, validation });
  },

  isAnalyticsModalOpen: false,
  analyticsTarget: null,
  openAnalyticsModal: (target) =>
    set((s) => ({
      isAnalyticsModalOpen: true,
      analyticsTarget: target || (s.clickedGlobePoint
        ? { lat: s.clickedGlobePoint.lat, lon: s.clickedGlobePoint.lon, name: formatLatLon(s.clickedGlobePoint.lat, s.clickedGlobePoint.lon) }
        : { ...DEFAULT_OCEAN_POINT }),
    })),
  closeAnalyticsModal: () => set({ isAnalyticsModalOpen: false })
}));

if (typeof window !== 'undefined') {
  (window as any).__OCEAN_STORE__ = useOceanStore;
}
