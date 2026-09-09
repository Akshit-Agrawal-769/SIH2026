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
    let defaultPalette = 'turbo';
    let defaultRange: [number, number] = [20.0, 32.0];
    let defaultScaleType: 'linear' | 'log' = 'linear';

    if (selectedVariable === 'salinity') {
      defaultPalette = 'viridis';
      defaultRange = [29.5, 37.5];
      defaultScaleType = 'linear';
    } else if (selectedVariable === 'chlorophyll') {
      defaultPalette = 'chlorophyll';
      defaultRange = [0.05, 10.0];
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

  colorPalette: 'turbo',
  setColorPalette: (colorPalette) => set({ colorPalette }),
  colorRange: [20.0, 32.0],
  setColorRange: (colorRange) => set({ colorRange }),

  scaleType: 'linear',
  setScaleType: (scaleType) => set({ scaleType }),
  vectorArrowScale: 1.0,
  setVectorArrowScale: (vectorArrowScale) => set({ vectorArrowScale }),

  autoCalibrateRange: () => {
    set((state) => {
      let range: [number, number] = [20.0, 32.0];
      if (state.selectedVariable === 'salinity') range = [29.5, 37.5];
      else if (state.selectedVariable === 'chlorophyll') range = [0.05, 10.0];
      else if (state.selectedVariable === 'currents') range = [0.0, 2.2];
      else {
        if (state.depthLevel <= 15.0) range = [20.0, 32.0];
        else if (state.depthLevel <= 75.0) range = [17.0, 29.0];
        else if (state.depthLevel <= 150.0) range = [13.0, 24.0];
        else if (state.depthLevel <= 300.0) range = [9.0, 19.0];
        else if (state.depthLevel <= 800.0) range = [5.0, 13.0];
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
        if (depthLevel <= 15.0) range = [20.0, 32.0];
        else if (depthLevel <= 75.0) range = [17.0, 29.0];
        else if (depthLevel <= 150.0) range = [13.0, 24.0];
        else if (depthLevel <= 300.0) range = [9.0, 19.0];
        else if (depthLevel <= 800.0) range = [5.0, 13.0];
        else range = [2.0, 6.0];
      }
      return { depthLevel, colorRange: range };
    });
  },
  verticalExaggeration: 100.0,
  setVerticalExaggeration: (verticalExaggeration) => set({ verticalExaggeration }),

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
  toggleBottomBar: () => set((s) => ({ showBottomBar: !s.showBottomBar }))
}));
