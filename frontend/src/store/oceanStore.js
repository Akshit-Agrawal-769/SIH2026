import { create } from 'zustand';

export const useOceanStore = create((set, get) => ({
  // Datasets & Health
  health: null,
  datasets: [],
  activeDataset: '',
  metadata: null,

  // Scientific Controls
  variable: 'temp',
  renderMode: 'volume',
  colormap: 'turbo',
  timeIndex: 0,
  depthIndex: 0,
  opacity: 1.2,
  threshold: 0.05,
  isoValue: 0.65,
  sliceDepthMeters: 50,
  enableSlice: false,
  verticalExaggeration: 1.0,

  // 3D Volume Binary Buffer
  volumeBuffer: null,
  volumeMeta: null,

  // Argo In-Situ Floats
  argoFloats: [],
  selectedFloat: null,
  selectedCycle: null,

  // Validation & Profiling Modal
  comparisonData: null,
  isModalOpen: false,
  isLoading: false,
  isPlayingTimeline: false,

  // Actions
  fetchInitialData: async () => {
    try {
      set({ isLoading: true });
      // 1. Health check
      const healthRes = await fetch('/api/v1/health');
      const health = await healthRes.json();
      set({ health });

      // 2. Available model datasets
      const modelRes = await fetch('/api/v1/model/datasets');
      const modelData = await modelRes.json();
      const datasets = modelData.datasets || [];
      set({ datasets });

      if (datasets.length > 0) {
        const active = datasets[0];
        set({ activeDataset: active });
        await get().selectDataset(active);
      }

      // 3. Argo floats
      const argoRes = await fetch('/api/v1/observations/argo');
      const argoFloats = await argoRes.json();
      set({ argoFloats, isLoading: false });
    } catch (err) {
      console.error('Error fetching initial ocean data:', err);
      set({ isLoading: false });
    }
  },

  selectDataset: async (dataset) => {
    try {
      set({ activeDataset: dataset, isLoading: true });
      const metaRes = await fetch(`/api/v1/model/metadata?filename=${encodeURIComponent(dataset)}`);
      const metadata = await metaRes.json();
      set({ metadata });
      await get().fetchVolumeData();
      set({ isLoading: false });
    } catch (err) {
      console.error('Error selecting dataset:', err);
      set({ isLoading: false });
    }
  },

  fetchVolumeData: async () => {
    const { activeDataset, variable, timeIndex } = get();
    if (!activeDataset) return;
    try {
      const url = `/api/v1/model/volume3d?filename=${encodeURIComponent(activeDataset)}&variable=${variable}&time_idx=${timeIndex}&dim_x=64&dim_y=64&dim_z=32`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Volume fetch failed');

      const minVal = parseFloat(res.headers.get('X-Data-Min') || '0');
      const maxVal = parseFloat(res.headers.get('X-Data-Max') || '1');
      const dimX = parseInt(res.headers.get('X-Dim-X') || '64');
      const dimY = parseInt(res.headers.get('X-Dim-Y') || '64');
      const dimZ = parseInt(res.headers.get('X-Dim-Z') || '32');
      const units = res.headers.get('X-Units') || '';

      const arrayBuffer = await res.arrayBuffer();
      const float32 = new Float32Array(arrayBuffer);

      set({
        volumeBuffer: float32,
        volumeMeta: { minVal, maxVal, dimX, dimY, dimZ, variable, units },
      });
    } catch (err) {
      console.error('Error fetching 3D volume buffer:', err);
    }
  },

  setVariable: (variable) => {
    set({ variable });
    get().fetchVolumeData();
    if (get().selectedFloat) {
      get().fetchComparison(get().selectedFloat.platform_number, get().selectedCycle || undefined);
    }
  },

  setRenderMode: (renderMode) => set({ renderMode }),
  setColormap: (colormap) => set({ colormap }),
  setTimeIndex: (timeIndex) => {
    set({ timeIndex });
    get().fetchVolumeData();
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

  selectFloat: async (float) => {
    set({ selectedFloat: float, selectedCycle: float.cycles[0] || null });
    await get().fetchComparison(float.platform_number, float.cycles[0]);
  },

  fetchComparison: async (platformNumber, cycle) => {
    const { variable, activeDataset } = get();
    try {
      set({ isLoading: true });
      let url = `/api/v1/comparison/profile?platform_number=${encodeURIComponent(platformNumber)}&variable=${variable}&model_filename=${encodeURIComponent(activeDataset)}`;
      if (cycle !== undefined && cycle !== null) {
        url += `&cycle_number=${cycle}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch comparison');
      const comparisonData = await res.json();
      set({ comparisonData, isModalOpen: true, isLoading: false });
    } catch (err) {
      console.error('Error fetching comparison profile:', err);
      set({ isLoading: false });
    }
  },

  closeModal: () => set({ isModalOpen: false }),
}));
