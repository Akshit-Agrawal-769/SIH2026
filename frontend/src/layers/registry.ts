import * as Cesium from 'cesium';

export type LayerCategory = 'model_field' | 'vector_field' | 'observation' | 'boundary';

export interface LayerDefinition {
  id: string;
  name: string;
  category: LayerCategory;
  description: string;
  units?: string;
  defaultVisible: boolean;
  color: string;
  badge?: string;
  iconName?: 'waves' | 'droplets' | 'wind' | 'activity' | 'radio' | 'anchor' | 'compass' | 'layers';
  render?: (viewer: Cesium.Viewer, isVisible: boolean) => void;
}

// Internal map storing all registered layer definitions
const registeredLayers = new Map<string, LayerDefinition>();

/**
 * Register a new data layer dynamically at runtime.
 * Enables zero-touch plug-and-play frontend extensibility.
 */
export function registerLayer(layer: LayerDefinition): void {
  registeredLayers.set(layer.id, layer);
}

/**
 * Unregister a layer by ID.
 */
export function unregisterLayer(layerId: string): boolean {
  return registeredLayers.delete(layerId);
}

/**
 * Retrieve all currently registered layers.
 */
export function getAllLayers(): LayerDefinition[] {
  return Array.from(registeredLayers.values());
}

/**
 * Retrieve a specific layer definition by ID.
 */
export function getLayer(layerId: string): LayerDefinition | undefined {
  return registeredLayers.get(layerId);
}

/**
 * Filter layers by category.
 */
export function getLayersByCategory(category: LayerCategory): LayerDefinition[] {
  return getAllLayers().filter((l) => l.category === category);
}

// Register Built-in Default Layers
const DEFAULT_LAYERS: LayerDefinition[] = [
  // 1. Gridded fields (surface only in this release; see data catalog)
  {
    id: 'temperature',
    name: 'Sea Surface Temperature',
    category: 'model_field',
    description: 'INCOIS Bio-ROMS (IBR) monthly surface temperature',
    units: '°C',
    defaultVisible: true,
    color: '#ef4444',
    badge: 'IBR · monthly',
    iconName: 'waves'
  },
  {
    id: 'salinity',
    name: 'Sea Surface Salinity',
    category: 'model_field',
    description: 'INCOIS Bio-ROMS (IBR) monthly surface salinity',
    units: 'PSU',
    defaultVisible: false,
    color: '#14b8a6',
    badge: 'IBR · monthly',
    iconName: 'droplets'
  },
  {
    id: 'chlorophyll',
    name: 'Surface Chlorophyll-a',
    category: 'model_field',
    description: 'INCOIS Bio-ROMS (IBR) monthly surface chlorophyll-a',
    units: 'mg/m³',
    defaultVisible: false,
    color: '#22c55e',
    badge: 'IBR · BGC',
    iconName: 'activity'
  },
  {
    id: 'mld',
    name: 'Mixed Layer Depth',
    category: 'model_field',
    description: 'INCOIS Bio-ROMS (IBR) model-diagnosed mixed layer depth',
    units: 'm',
    defaultVisible: false,
    color: '#a3a3a3',
    badge: 'IBR · monthly',
    iconName: 'layers'
  },

  // 2. Currents
  {
    id: 'currents',
    name: 'Surface Geostrophic Currents',
    category: 'vector_field',
    description: 'CMEMS ARMOR3D surface geostrophic velocity, 2024-12-31 only',
    units: 'm/s',
    defaultVisible: false,
    color: '#f59e0b',
    badge: 'ARMOR3D · 1 date',
    iconName: 'wind'
  },

  // 3. In-situ observations
  {
    id: 'argo',
    name: 'Argo Profiling Floats',
    category: 'observation',
    description: 'Latest QC-filtered profile per float (Argo GDAC)',
    defaultVisible: true,
    color: '#f59e0b',
    badge: 'QC 1/2',
    iconName: 'radio'
  },

  // 4. Maritime boundary
  {
    id: 'india_eez',
    name: 'India EEZ Boundary',
    category: 'boundary',
    description: 'Exclusive Economic Zone boundary',
    defaultVisible: true,
    color: '#14b8a6',
    badge: 'Boundary',
    iconName: 'layers'
  }
];

// Initialize default layers
for (const layer of DEFAULT_LAYERS) {
  registerLayer(layer);
}

// Backward-compatibility export
export const LAYER_REGISTRY = getAllLayers();
