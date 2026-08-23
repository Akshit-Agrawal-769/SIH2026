import { create } from 'zustand';
import { 
  OceanVariable, 
  ColormapType, 
  RenderMode, 
  DatasetHealth, 
  DatasetMetadata, 
  VolumeMetadata, 
  ArgoFloatSummary, 
  ModelVsObsComparison 
} from '../types/ocean';

interface OceanState {
  // Datasets & Health
  health: DatasetHealth | null;
  datasets: string[];
  activeDataset: string;
  metadata: DatasetMetadata | null;

  // Scientific Controls
  variable: OceanVariable;
  renderMode: RenderMode;
  colormap: ColormapType;
  timeIndex: number;
  depthIndex: number;
  opacity: number;
  threshold: number;
  isoValue: number;
  sliceDepthMeters: number;
  enableSlice: boolean;

  // 3D Volume Binary Buffer
  volumeBuffer: Float32Array | null;
  volumeMeta: VolumeMetadata | null;

  // Argo In-Situ Floats
  argoFloats: ArgoFloatSummary[];
  selectedFloat: ArgoFloatSummary | null;
  selectedCycle: number | null;

  // Validation & Profiling Modal
  comparisonData: ModelVsObsComparison | null;
  isModalOpen: boolean;
  isLoading: boolean;
  isPlayingTimeline: boolean;

  // Actions
  fetchInitialData: () => Promise<void>;
  selectDataset: (dataset: string) => Promise<void>;
  setVariable: (v: OceanVariable) => void;
  setRenderMode: (m: RenderMode) => void;
  setColormap: (c: ColormapType) => void;
  setTimeIndex: (t: number) => void;
  setDepthIndex: (d: number) => void;
  setOpacity: (o: number) => void;
  setThreshold: (th: number) => void;
  setIsoValue: (iso: number) => void;
  setSliceDepthMeters: (m: number) => void;
  setEnableSlice: (e: boolean) => void;
  toggleTimelinePlayback: () => void;
  selectFloat: (float: ArgoFloatSummary) => Promise<void>;
  fetchComparison: (platformNumber: string, cycle?: number) => Promise<void>;
  closeModal: () => void;
  fetchVolumeData: () => Promise<void>;
}

export const useOceanStore = create<OceanState>((set, get) => ({
  health: null,
  datasets: [],
  activeDataset: '',
  metadata: null,

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

  volumeBuffer: null,
  volumeMeta: null,

  argoFloats: [],
  selectedFloat: null,
  selectedCycle: null,

  comparisonData: null,
  isModalOpen: false,
  isLoading: false,
  isPlayingTimeline: false,

  fetchInitialData: async () => {
    try {
      set({ isLoading: true });
      // 1. Health check
      const healthRes = await fetch('/api/v1/health');
      const health: DatasetHealth = await healthRes.json();
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
      const argoFloats: ArgoFloatSummary[] = await argoRes.json();
      set({ argoFloats, isLoading: false });
    } catch (err) {
      console.error('Error fetching initial ocean data:', err);
      set({ isLoading: false });
    }
  },

  selectDataset: async (dataset: string) => {
    try {
      set({ activeDataset: dataset, isLoading: true });
      const metaRes = await fetch(`/api/v1/model/metadata?filename=${encodeURIComponent(dataset)}`);
      const metadata: DatasetMetadata = await metaRes.json();
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

  setVariable: (variable: OceanVariable) => {
    set({ variable });
    get().fetchVolumeData();
    if (get().selectedFloat) {
      get().fetchComparison(get().selectedFloat!.platform_number, get().selectedCycle || undefined);
    }
  },

  setRenderMode: (renderMode: RenderMode) => set({ renderMode }),
  setColormap: (colormap: ColormapType) => set({ colormap }),
  setTimeIndex: (timeIndex: number) => {
    set({ timeIndex });
    get().fetchVolumeData();
  },
  setDepthIndex: (depthIndex: number) => set({ depthIndex }),
  setOpacity: (opacity: number) => set({ opacity }),
  setThreshold: (threshold: number) => set({ threshold }),
  setIsoValue: (isoValue: number) => set({ isoValue }),
  setSliceDepthMeters: (sliceDepthMeters: number) => set({ sliceDepthMeters }),
  setEnableSlice: (enableSlice: boolean) => set({ enableSlice }),

  toggleTimelinePlayback: () => {
    const isPlaying = !get().isPlayingTimeline;
    set({ isPlayingTimeline: isPlaying });
  },

  selectFloat: async (float: ArgoFloatSummary) => {
    set({ selectedFloat: float, selectedCycle: float.cycles[0] || null });
    await get().fetchComparison(float.platform_number, float.cycles[0]);
  },

  fetchComparison: async (platformNumber: string, cycle?: number) => {
    const { variable, activeDataset } = get();
    try {
      set({ isLoading: true });
      let url = `/api/v1/comparison/profile?platform_number=${encodeURIComponent(platformNumber)}&variable=${variable}&model_filename=${encodeURIComponent(activeDataset)}`;
      if (cycle !== undefined && cycle !== null) {
        url += `&cycle_number=${cycle}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch comparison');
      const comparisonData: ModelVsObsComparison = await res.json();
      set({ comparisonData, isModalOpen: true, isLoading: false });
    } catch (err) {
      console.error('Error fetching comparison profile:', err);
      set({ isLoading: false });
    }
  },

  closeModal: () => set({ isModalOpen: false }),
}));
