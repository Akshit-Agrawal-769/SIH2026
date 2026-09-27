/**
 * Guided tours. Tours contain NO hard-coded measurements: every number shown with a step is
 * computed at runtime (TourStats) from the served tiles, catalog and Argo artefacts, so the
 * text can never drift from the data. Narratives only state method and background knowledge.
 */

/** Lon/lat box: [west, south, east, north] in degrees. */
export type Box = [number, number, number, number];

export interface BoxMeanSpec {
  variable: string;
  /** A catalog timestep (YYYY-MM-DD). */
  time: string;
  box: Box;
}

export type TourStat =
  | { kind: 'boxMean'; label: string; spec: BoxMeanSpec }
  | { kind: 'boxDiff'; label: string; a: BoxMeanSpec; b: BoxMeanSpec }
  | { kind: 'floatCount'; label: string }
  | { kind: 'matchups'; label: string; instrumentId: string; variable: string };

export interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  narrative: string;
  keyInsights: string[];
  /** Computed live from the data when the step is shown. */
  stats?: TourStat[];
  camera: {
    lon: number;
    lat: number;
    height: number;
    pitch?: number;
    heading?: number;
    duration?: number;
  };
  variable: string;
  depth: number;
  activeLayers: string[];
  /** A real catalog timestep (YYYY-MM-DD), or 'latest' for the variable's newest timestep. */
  time?: string;
  isPlaying?: boolean;
  selectedInstrumentId?: string | null;
}

export interface ScienceTour {
  id: string;
  title: string;
  tagline: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category: 'Monsoon Dynamics' | 'Salinity & Water Masses' | 'Biogeochemistry' | 'Ocean Robotics';
  thumbnailColor: string;
  summary: string;
  steps: TourStep[];
}

// Boxes used by the tours (named regions, the numbers come from the data).
const SOMALI_COAST: Box = [51, 8, 54, 11];
const BAY_OF_BENGAL: Box = [86, 12, 90, 16];
const CENTRAL_ARABIAN_SEA: Box = [62, 12, 66, 16];
const NORTH_ARABIAN_SEA: Box = [60, 15, 65, 20];
const NORTH_BAY_OF_BENGAL: Box = [87, 18, 91, 21];
const SOMALI_CURRENT: Box = [45, 2, 56, 12];

export const SCIENCE_TOURS: ScienceTour[] = [
  {
    id: 'monsoon-somali-upwelling',
    title: 'Southwest Monsoon & Somali Upwelling (2019)',
    tagline: 'A cool, chlorophyll-rich coastal signal off Somalia in the INCOIS Bio-ROMS fields',
    duration: '3 mins',
    difficulty: 'Beginner',
    category: 'Monsoon Dynamics',
    thumbnailColor: 'from-amber-500 to-red-600',
    summary:
      'Compare pre-monsoon (April) and monsoon (July) 2019 surface fields from the INCOIS Bio-ROMS model to see the Somali coastal upwelling signature in temperature and chlorophyll.',
    steps: [
      {
        id: 'monsoon-step-1',
        stepNumber: 1,
        title: 'Pre-monsoon surface temperature',
        subtitle: 'IBR sea surface temperature, April 2019',
        narrative:
          'Background: before the southwest monsoon sets in, the northern Indian Ocean is at its warmest. The box means below are computed from this model field.',
        keyInsights: ['Source: INCOIS Bio-ROMS monthly surface field'],
        stats: [
          { kind: 'boxMean', label: 'Somali coast (8–11°N, 51–54°E)', spec: { variable: 'temperature', time: '2019-04-29', box: SOMALI_COAST } },
          { kind: 'boxMean', label: 'Bay of Bengal (12–16°N, 86–90°E)', spec: { variable: 'temperature', time: '2019-04-29', box: BAY_OF_BENGAL } }
        ],
        camera: { lon: 66.0, lat: 10.0, height: 9000000, pitch: -85.0, heading: 0.0, duration: 2.5 },
        variable: 'temperature',
        depth: 0,
        activeLayers: ['temperature', 'argo'],
        time: '2019-04-29'
      },
      {
        id: 'monsoon-step-2',
        stepNumber: 2,
        title: 'Monsoon cooling off Somalia',
        subtitle: 'IBR sea surface temperature, July 2019',
        narrative:
          'Background: alongshore southwest monsoon winds drive offshore Ekman transport and coastal upwelling off Somalia and Oman, bringing cooler water to the surface.',
        keyInsights: ['Compare the coastal box with the open Arabian Sea'],
        stats: [
          { kind: 'boxMean', label: 'Somali coast (Jul)', spec: { variable: 'temperature', time: '2019-07-28', box: SOMALI_COAST } },
          { kind: 'boxMean', label: 'Central Arabian Sea (12–16°N, 62–66°E)', spec: { variable: 'temperature', time: '2019-07-28', box: CENTRAL_ARABIAN_SEA } },
          {
            kind: 'boxDiff', label: 'Somali coast, Jul minus Apr',
            a: { variable: 'temperature', time: '2019-07-28', box: SOMALI_COAST },
            b: { variable: 'temperature', time: '2019-04-29', box: SOMALI_COAST }
          }
        ],
        camera: { lon: 54.0, lat: 11.0, height: 2600000, pitch: -65.0, heading: 30.0, duration: 2.8 },
        variable: 'temperature',
        depth: 0,
        activeLayers: ['temperature', 'argo'],
        time: '2019-07-28'
      },
      {
        id: 'monsoon-step-3',
        stepNumber: 3,
        title: 'Chlorophyll response',
        subtitle: 'IBR surface chlorophyll-a, July 2019',
        narrative:
          'Background: upwelled water carries nutrients to the sunlit surface, which supports phytoplankton growth. The colour scale is logarithmic.',
        keyInsights: ['Log colour scale: each colour band is a factor, not a step', 'Model output, not satellite ocean colour'],
        stats: [
          { kind: 'boxMean', label: 'Somali coast (Jul)', spec: { variable: 'chlorophyll', time: '2019-07-28', box: SOMALI_COAST } },
          { kind: 'boxMean', label: 'Somali coast (Apr)', spec: { variable: 'chlorophyll', time: '2019-04-29', box: SOMALI_COAST } }
        ],
        camera: { lon: 56.0, lat: 12.0, height: 3000000, pitch: -70.0, heading: 20.0, duration: 2.4 },
        variable: 'chlorophyll',
        depth: 0,
        activeLayers: ['chlorophyll', 'argo'],
        time: '2019-07-28'
      },
      {
        id: 'monsoon-step-4',
        stepNumber: 4,
        title: 'Mixed layer deepening',
        subtitle: 'IBR mixed layer depth, Apr → Aug 2019',
        narrative:
          'Stronger monsoon winds mix the upper ocean. Use the timeline to step month by month; only real model months are shown.',
        keyInsights: ['Timeline steps only through real monthly timesteps', 'MLD here is the model’s own diagnostic'],
        stats: [
          { kind: 'boxMean', label: 'Central Arabian Sea MLD (Apr)', spec: { variable: 'mld', time: '2019-04-29', box: CENTRAL_ARABIAN_SEA } },
          { kind: 'boxMean', label: 'Central Arabian Sea MLD (Jul)', spec: { variable: 'mld', time: '2019-07-28', box: CENTRAL_ARABIAN_SEA } },
          { kind: 'boxMean', label: 'Central Arabian Sea MLD (Aug)', spec: { variable: 'mld', time: '2019-08-27', box: CENTRAL_ARABIAN_SEA } }
        ],
        camera: { lon: 64.0, lat: 14.0, height: 4200000, pitch: -75.0, heading: 10.0, duration: 2.5 },
        variable: 'mld',
        depth: 0,
        activeLayers: ['mld', 'argo'],
        time: '2019-08-27'
      }
    ]
  },
  {
    id: 'salinity-contrast',
    title: 'Two Seas, Two Salinities',
    tagline: 'Arabian Sea vs Bay of Bengal surface salinity in the model',
    duration: '2 mins',
    difficulty: 'Beginner',
    category: 'Salinity & Water Masses',
    thumbnailColor: 'from-teal-500 to-emerald-600',
    summary:
      'Background: evaporation exceeds precipitation over the Arabian Sea, while large river inflow and monsoon rain freshen the Bay of Bengal. Compare the two basins in the model fields.',
    steps: [
      {
        id: 'salinity-step-1',
        stepNumber: 1,
        title: 'Salty Arabian Sea',
        subtitle: 'IBR sea surface salinity, July 2019',
        narrative: 'Background: the Arabian Sea is an evaporation-dominated basin.',
        keyInsights: ['Background: evaporation-dominated basin'],
        stats: [
          { kind: 'boxMean', label: 'Northern Arabian Sea (15–20°N, 60–65°E)', spec: { variable: 'salinity', time: '2019-07-28', box: NORTH_ARABIAN_SEA } }
        ],
        camera: { lon: 63.0, lat: 17.0, height: 3500000, pitch: -75.0, heading: 0.0, duration: 2.4 },
        variable: 'salinity',
        depth: 0,
        activeLayers: ['salinity', 'argo'],
        time: '2019-07-28'
      },
      {
        id: 'salinity-step-2',
        stepNumber: 2,
        title: 'Fresh northern Bay of Bengal',
        subtitle: 'IBR sea surface salinity, July 2019',
        narrative:
          'Background: the Ganges–Brahmaputra and other rivers deliver large freshwater volumes to the northern Bay.',
        keyInsights: ['Background: river- and rain-freshened basin'],
        stats: [
          { kind: 'boxMean', label: 'Northern Bay of Bengal (18–21°N, 87–91°E)', spec: { variable: 'salinity', time: '2019-07-28', box: NORTH_BAY_OF_BENGAL } },
          {
            kind: 'boxDiff', label: 'Arabian Sea minus Bay of Bengal',
            a: { variable: 'salinity', time: '2019-07-28', box: NORTH_ARABIAN_SEA },
            b: { variable: 'salinity', time: '2019-07-28', box: NORTH_BAY_OF_BENGAL }
          }
        ],
        camera: { lon: 89.0, lat: 18.0, height: 3000000, pitch: -70.0, heading: 0.0, duration: 2.4 },
        variable: 'salinity',
        depth: 0,
        activeLayers: ['salinity', 'argo'],
        time: '2019-07-28'
      }
    ]
  },
  {
    id: 'winter-currents',
    title: 'Surface Geostrophic Currents',
    tagline: 'Geostrophic surface velocity from the CMEMS ARMOR3D analysis',
    duration: '2 mins',
    difficulty: 'Intermediate',
    category: 'Monsoon Dynamics',
    thumbnailColor: 'from-neutral-500 to-amber-600',
    summary:
      'ARMOR3D surface geostrophic velocity for the analysis date listed in the catalog. Arrows are placed on the real vector grid.',
    steps: [
      {
        id: 'currents-step-1',
        stepNumber: 1,
        title: 'Surface geostrophic currents',
        subtitle: 'CMEMS ARMOR3D, latest analysis date in the catalog',
        narrative:
          'Arrow colour and length follow speed. Background: the Somali Current reverses seasonally with the monsoon winds.',
        keyInsights: [
          'Geostrophic velocity (thermal wind), not total current',
          'Values near the equator are less reliable because geostrophy breaks down there'
        ],
        stats: [
          { kind: 'boxMean', label: 'Mean speed off Somalia (2–12°N, 45–56°E)', spec: { variable: 'currents', time: 'latest', box: SOMALI_CURRENT } }
        ],
        camera: { lon: 60.0, lat: 5.0, height: 7000000, pitch: -80.0, heading: 0.0, duration: 2.5 },
        variable: 'currents',
        depth: 0,
        activeLayers: ['currents', 'argo'],
        time: 'latest'
      }
    ]
  },
  {
    id: 'argo-profiles',
    title: 'Argo Floats: Measuring Below the Surface',
    tagline: 'Real QC-filtered profiles from the Argo GDAC',
    duration: '2 mins',
    difficulty: 'Beginner',
    category: 'Ocean Robotics',
    thumbnailColor: 'from-amber-500 to-orange-600',
    summary:
      'Background: Argo floats drift at depth and surface roughly every 10 days, measuring temperature and salinity (some also oxygen and chlorophyll) on the way up. The markers show each float’s latest QC-good profile.',
    steps: [
      {
        id: 'argo-step-1',
        stepNumber: 1,
        title: 'The float network in this catalog',
        subtitle: 'Latest ascending profile per float',
        narrative:
          'Each marker is a real float position from its latest ascending profile that passed Argo QC (flags 1 and 2). Labels show the WMO number and profile date; floats that have not reported for a year are drawn dimmer.',
        keyInsights: ['QC flags 1/2 only; adjusted values for delayed-mode data'],
        stats: [{ kind: 'floatCount', label: 'Floats in this catalog' }],
        camera: { lon: 72.0, lat: 12.0, height: 9000000, pitch: -85.0, heading: 0.0, duration: 2.5 },
        variable: 'temperature',
        depth: 0,
        activeLayers: ['temperature', 'argo'],
        time: '2019-07-28',
        selectedInstrumentId: null
      },
      {
        id: 'argo-step-2',
        stepNumber: 2,
        title: 'A delayed-mode Arabian Sea float',
        subtitle: 'WMO 2902120 (INCOIS)',
        narrative:
          'This float’s near-surface temperatures are compared with the INCOIS Bio-ROMS model in the Model vs Observation view. Open the profile panel to see its latest QC-filtered profile and observed mixed layer depth.',
        keyInsights: ['Delayed-mode (adjusted) data', 'Model–observation matchups use the float’s own profile dates'],
        stats: [{ kind: 'matchups', label: 'Model–observation matchups (temperature)', instrumentId: 'ARGO_2902120', variable: 'temperature' }],
        camera: { lon: 60.0, lat: 15.0, height: 2500000, pitch: -65.0, heading: 0.0, duration: 2.5 },
        variable: 'temperature',
        depth: 0,
        activeLayers: ['temperature', 'argo'],
        time: '2019-07-28',
        selectedInstrumentId: 'ARGO_2902120'
      }
    ]
  }
];
