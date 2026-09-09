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
  console.log(`[LayerRegistry] Registered layer: ${layer.id} (${layer.category})`);
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
  // 1. Numerical Model Fields
  {
    id: 'temperature',
    name: 'Ocean Temperature (3D)',
    category: 'model_field',
    description: 'Volumetric potential temperature across the full water column',
    units: '°C',
    defaultVisible: true,
    color: '#ff4d4d',
    badge: '3D Voxel',
    iconName: 'waves'
  },
  {
    id: 'salinity',
    name: 'Ocean Salinity (3D)',
    category: 'model_field',
    description: 'Volumetric practical salinity and halocline stratification',
    units: 'PSU',
    defaultVisible: false,
    color: '#00e5ff',
    badge: '3D Voxel',
    iconName: 'droplets'
  },
  {
    id: 'chlorophyll',
    name: 'Chlorophyll-a (BGC)',
    category: 'model_field',
    description: 'Photic zone phytoplankton biomass and biological productivity',
    units: 'mg/m³',
    defaultVisible: false,
    color: '#2ecc71',
    badge: 'BGC',
    iconName: 'activity'
  },

  // 2. Hydrodynamic Current Vectors
  {
    id: 'currents',
    name: 'Ocean Current Vectors',
    category: 'vector_field',
    description: 'Real-time 60 FPS animated streamlines and flow velocity vectors',
    units: 'm/s',
    defaultVisible: true,
    color: '#a3e635',
    badge: 'Flow 60FPS',
    iconName: 'wind'
  },

  // 3. Autonomous In-Situ Observation Platforms
  {
    id: 'argo',
    name: 'Argo Profiling Floats',
    category: 'observation',
    description: 'Autonomous CTD profiling floats cycling between surface and 2000m',
    defaultVisible: true,
    color: '#ffd700',
    badge: 'CTD 2000m',
    iconName: 'radio'
  },
  {
    id: 'glider',
    name: 'Underwater Gliders',
    category: 'observation',
    description: 'Autonomous buoyancy-driven transect gliders with high-res sensors',
    defaultVisible: true,
    color: '#ff00ff',
    badge: 'Sawtooth',
    iconName: 'radio'
  },
  {
    id: 'moored_buoy',
    name: 'Moored MetOcean Buoys',
    category: 'observation',
    description: 'Deep-sea moored buoys measuring surface waves, winds, and thermistor chains',
    defaultVisible: true,
    color: '#00e676',
    badge: 'OMNI Realtime',
    iconName: 'anchor'
  },

  // 4. Maritime Boundary
  {
    id: 'india_eez',
    name: 'India EEZ Boundary',
    category: 'boundary',
    description: 'Exclusive Economic Zone maritime boundary (Arabian Sea, Bay of Bengal, Andaman Sea)',
    defaultVisible: true,
    color: '#00e5ff',
    badge: 'Maritime Zone',
    iconName: 'layers'
  }
];

// Initialize default layers
for (const layer of DEFAULT_LAYERS) {
  registerLayer(layer);
}

// Backward-compatibility export
export const LAYER_REGISTRY = getAllLayers();
