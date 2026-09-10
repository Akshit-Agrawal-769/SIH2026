import { create } from 'zustand';

export interface OceanState {
  // Mode
  mode: 'operational' | 'outreach';
  setMode: (mode: 'operational' | 'outreach') => void;

  // Active layer toggles
  activeLayers: string[];
  toggleLayer: (layerId: string) => void;
  setLayers: (layers: string[]) => void;

  // Active 3D model variable
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

  // Time navigation
  currentTime: string;
  setCurrentTime: (time: string) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

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
  currentsStyle: 'streamlines' | 'arrows' | 'hybrid';
  setCurrentsStyle: (style: 'streamlines' | 'arrows' | 'hybrid') => void;
  currentsSpeed: number;
  setCurrentsSpeed: (speed: number) => void;
  currentsDensity: number;
  setCurrentsDensity: (density: number) => void;
  currentsTrailLength: 'short' | 'medium' | 'long';
  setCurrentsTrailLength: (length: 'short' | 'medium' | 'long') => void;
  currentsColorTheme: 'neon' | 'thermal' | 'glacier';
  setCurrentsColorTheme: (theme: 'neon' | 'thermal' | 'glacier') => void;
  autoCalibrateRange: () => void;

  // Selected observation instrument
  selectedInstrumentId: string | null;
  setSelectedInstrumentId: (id: string | null) => void;

  // Live sampled ocean point (from mouse hover over globe)
  hoveredOceanInfo: HoveredOceanInfo | null;
  setHoveredOceanInfo: (info: HoveredOceanInfo | null) => void;

  // Panel visibility toggles for unobstructed full-globe view
  showLeftPanel: boolean;
  setShowLeftPanel: (show: boolean) => void;
  toggleLeftPanel: () => void;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;
  toggleRightPanel: () => void;
  showBottomBar: boolean;
  setShowBottomBar: (show: boolean) => void;
  toggleBottomBar: () => void;

  // On-demand 3D Volumetric Water Column Cube Inspector
  activeWaterBlockTarget: WaterBlockTarget | null;
  openWaterBlock: (target: WaterBlockTarget) => void;
  closeWaterBlock: () => void;

  // Scientific cartographic graticule overlay
  isGraticuleEnabled: boolean;
  setIsGraticuleEnabled: (enabled: boolean) => void;
  toggleGraticule: () => void;

  // Globe click prompt point for ocean water block extraction
  clickedGlobePoint: { lon: number; lat: number; screenX: number; screenY: number; basin?: string } | null;
  setClickedGlobePoint: (point: { lon: number; lat: number; screenX: number; screenY: number; basin?: string } | null) => void;
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

export const useOceanStore = create<OceanState>((set) => ({
  mode: 'operational',
  setMode: (mode) => set({ mode }),

  activeLayers: ['temperature', 'currents', 'argo', 'glider', 'moored_buoy', 'india_eez'],
  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layerId)
        ? state.activeLayers.filter((id) => id !== layerId)
        : [...state.activeLayers, layerId]
    })),
  setLayers: (activeLayers) => set({ activeLayers }),

  selectedVariable: 'temperature',
  setSelectedVariable: (selectedVariable) => {
    let defaultPalette = 'noaa_sst';
    let defaultRange: [number, number] = [18.0, 32.0];
    let defaultScaleType: 'linear' | 'log' = 'linear';

    if (selectedVariable === 'salinity') {
      defaultPalette = 'viridis';
      defaultRange = [29.5, 37.5];
      defaultScaleType = 'linear';
    } else if (selectedVariable === 'chlorophyll') {
      defaultPalette = 'gfdl_chl';
      defaultRange = [0.03, 12.0];
      defaultScaleType = 'log';
    } else if (selectedVariable === 'currents') {
      defaultPalette = 'turbo';
      defaultRange = [0.0, 2.2];
      defaultScaleType = 'linear';
    }

    set((state) => ({
      selectedVariable,
      colorPalette: defaultPalette,
      colorRange: defaultRange,
      scaleType: defaultScaleType,
      activeLayers: state.activeLayers.includes(selectedVariable)
        ? state.activeLayers
        : [...state.activeLayers, selectedVariable]
    }));
  },

  colorPalette: 'noaa_sst',
  setColorPalette: (colorPalette) => set({ colorPalette }),
  colorRange: [18.0, 32.0],
  setColorRange: (colorRange) => set({ colorRange }),

  scaleType: 'linear',
  setScaleType: (scaleType) => set({ scaleType }),
  vectorArrowScale: 1.0,
  setVectorArrowScale: (vectorArrowScale) => set({ vectorArrowScale }),
  currentsStyle: 'streamlines',
  setCurrentsStyle: (currentsStyle) => set({ currentsStyle }),
  currentsSpeed: 1.2,
  setCurrentsSpeed: (currentsSpeed) => set({ currentsSpeed }),
  currentsDensity: 3000,
  setCurrentsDensity: (currentsDensity) => set({ currentsDensity }),
  currentsTrailLength: 'medium',
  setCurrentsTrailLength: (currentsTrailLength) => set({ currentsTrailLength }),
  currentsColorTheme: 'neon',
  setCurrentsColorTheme: (currentsColorTheme) => set({ currentsColorTheme }),

  autoCalibrateRange: () => {
    set((state) => {
      let range: [number, number] = [18.0, 32.0];
      if (state.selectedVariable === 'salinity') range = [29.5, 37.5];
      else if (state.selectedVariable === 'chlorophyll') range = [0.03, 12.0];
      else if (state.selectedVariable === 'currents') range = [0.0, 2.2];
      else {
        if (state.depthLevel <= 15.0) range = [18.0, 32.0];
        else if (state.depthLevel <= 75.0) range = [15.0, 29.0];
        else if (state.depthLevel <= 150.0) range = [12.0, 24.0];
        else if (state.depthLevel <= 300.0) range = [8.0, 19.0];
        else if (state.depthLevel <= 800.0) range = [4.0, 13.0];
        else range = [2.0, 6.0];
      }
      return { colorRange: range };
    });
  },

  depthLevel: 0.5,
  setDepthLevel: (depthLevel) => {
    set((state) => {
      let range = state.colorRange;
      if (state.selectedVariable === 'temperature') {
        if (depthLevel <= 15.0) range = [18.0, 32.0];
        else if (depthLevel <= 75.0) range = [15.0, 29.0];
        else if (depthLevel <= 150.0) range = [12.0, 24.0];
        else if (depthLevel <= 300.0) range = [8.0, 19.0];
        else if (depthLevel <= 800.0) range = [4.0, 13.0];
        else range = [2.0, 6.0];
      }
      return { depthLevel, colorRange: range };
    });
  },
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

  currentTime: '2024-06-01',
  setCurrentTime: (currentTime) => set({ currentTime }),
  isPlaying: false,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  playbackSpeed: 1.0,
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  opacity: 0.8,
  setOpacity: (opacity) => set({ opacity }),

  selectedInstrumentId: null,
  setSelectedInstrumentId: (selectedInstrumentId) => set({ selectedInstrumentId }),

  hoveredOceanInfo: null,
  setHoveredOceanInfo: (hoveredOceanInfo) => set({ hoveredOceanInfo }),

  showLeftPanel: true,
  setShowLeftPanel: (showLeftPanel) => set({ showLeftPanel }),
  toggleLeftPanel: () => set((s) => ({ showLeftPanel: !s.showLeftPanel })),

  showRightPanel: true,
  setShowRightPanel: (showRightPanel) => set({ showRightPanel }),
  toggleRightPanel: () => set((s) => ({ showRightPanel: !s.showRightPanel })),

  showBottomBar: true,
  setShowBottomBar: (showBottomBar) => set({ showBottomBar }),
  toggleBottomBar: () => set((s) => ({ showBottomBar: !s.showBottomBar })),

  isGraticuleEnabled: true,
  setIsGraticuleEnabled: (isGraticuleEnabled) => set({ isGraticuleEnabled }),
  toggleGraticule: () => set((s) => ({ isGraticuleEnabled: !s.isGraticuleEnabled }))
}));
