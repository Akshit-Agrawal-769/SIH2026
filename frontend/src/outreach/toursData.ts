export interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  narrative: string;
  keyInsights: string[];
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
  /** A real catalog timestep (YYYY-MM-DD). */
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

/*
 * Every "in this data" statement below was checked against the served tiles
 * (INCOIS Bio-ROMS 2019 monthly surface fields; CMEMS ARMOR3D 2024-12-31 surface
 * geostrophic currents; Argo GDAC profiles). Box means are over the stated
 * lat/lon boxes. General oceanography is labelled as background.
 */
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
        subtitle: 'IBR sea surface temperature, 29 Apr 2019',
        narrative:
          'Background: before the southwest monsoon sets in, the northern Indian Ocean is at its warmest. In this model field the box 8–11°N, 51–54°E off Somalia averages about 29.9 °C, similar to the Bay of Bengal (about 30.1 °C at 12–16°N, 86–90°E).',
        keyInsights: [
          'Somali coast box mean ≈ 29.9 °C (29 Apr 2019)',
          'Bay of Bengal box mean ≈ 30.1 °C',
          'Source: INCOIS Bio-ROMS monthly surface field'
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
        subtitle: 'IBR sea surface temperature, 28 Jul 2019',
        narrative:
          'Background: alongshore southwest monsoon winds drive offshore Ekman transport and coastal upwelling off Somalia and Oman. In this model field the Somali box has cooled to about 24.4 °C while the central Arabian Sea (12–16°N, 62–66°E) is about 28.4 °C — a contrast of roughly 4 °C.',
        keyInsights: [
          'Somali coast box mean ≈ 24.4 °C (28 Jul 2019)',
          'Central Arabian Sea box mean ≈ 28.4 °C',
          'Cooling relative to April ≈ 5.5 °C at the coast'
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
        subtitle: 'IBR surface chlorophyll-a, 28 Jul 2019',
        narrative:
          'Background: upwelled water carries nutrients to the sunlit surface, which supports phytoplankton growth. In the model the Somali box chlorophyll-a is about 1.2 mg/m³ in July, compared with about 0.08 mg/m³ in April. The colour scale is logarithmic.',
        keyInsights: [
          'Somali box ≈ 1.2 mg/m³ (Jul) vs ≈ 0.08 mg/m³ (Apr)',
          'Log colour scale: each colour band is a factor, not a step',
          'Model output, not satellite ocean colour'
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
          'Stronger monsoon winds mix the upper ocean. In the model the central Arabian Sea mixed layer deepens from about 27 m (29 Apr) to about 69 m (27 Aug). Use the timeline to step month by month; only real model months are shown.',
        keyInsights: [
          'Central Arabian Sea MLD ≈ 27 m (Apr) → ≈ 58 m (Jul) → ≈ 69 m (Aug)',
          'Timeline steps only through real monthly timesteps',
          'MLD here is the model’s own diagnostic'
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
      'Background: evaporation exceeds precipitation over the Arabian Sea, while large river inflow and monsoon rain freshen the Bay of Bengal. The model fields show a persistent contrast of about 2 PSU.',
    steps: [
      {
        id: 'salinity-step-1',
        stepNumber: 1,
        title: 'Salty Arabian Sea',
        subtitle: 'IBR sea surface salinity, 28 Jul 2019',
        narrative:
          'In this field the northern Arabian Sea box (15–20°N, 60–65°E) averages about 35.5 PSU.',
        keyInsights: ['Arabian Sea box ≈ 35.5 PSU', 'Background: evaporation-dominated basin'],
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
        subtitle: 'IBR sea surface salinity, 28 Jul 2019',
        narrative:
          'The northern Bay of Bengal box (18–21°N, 87–91°E) averages about 33.4 PSU, roughly 2 PSU fresher than the Arabian Sea box. Background: the Ganges–Brahmaputra and other rivers deliver large freshwater volumes to the northern Bay.',
        keyInsights: ['Northern Bay of Bengal box ≈ 33.4 PSU', 'Contrast with Arabian Sea ≈ 2 PSU'],
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
    title: 'Winter Surface Currents (31 Dec 2024)',
    tagline: 'Geostrophic surface velocity from the CMEMS ARMOR3D analysis',
    duration: '2 mins',
    difficulty: 'Intermediate',
    category: 'Monsoon Dynamics',
    thumbnailColor: 'from-neutral-500 to-amber-600',
    summary:
      'The only current field in this release is ARMOR3D surface geostrophic velocity for 31 December 2024 (northeast-monsoon season). Arrows are placed on the real 1° vector grid.',
    steps: [
      {
        id: 'currents-step-1',
        stepNumber: 1,
        title: 'Surface geostrophic currents',
        subtitle: 'CMEMS ARMOR3D, 31 Dec 2024',
        narrative:
          'Arrow colour and length follow speed. Near the coast of Somalia (2–12°N, 45–56°E) the mean meridional velocity in this field is slightly southward (≈ −0.07 m/s), consistent with background knowledge that the Somali Current reverses in the northeast monsoon.',
        keyInsights: [
          'Single real timestep: 2024-12-31',
          'Geostrophic velocity (thermal wind), not total current',
          'Values near the equator are less reliable because geostrophy breaks down there'
        ],
        camera: { lon: 60.0, lat: 5.0, height: 7000000, pitch: -80.0, heading: 0.0, duration: 2.5 },
        variable: 'currents',
        depth: 0,
        activeLayers: ['currents', 'argo'],
        time: '2024-12-31'
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
          'Each marker is a real float position from its latest ascending profile that passed Argo QC (flags 1 and 2). Labels show the WMO number and profile date.',
        keyInsights: ['13 floats from the Argo GDAC', 'QC flags 1/2 only; adjusted values for delayed-mode data'],
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
        subtitle: 'WMO 2902120 (INCOIS), 2014–2021',
        narrative:
          'This float’s near-surface temperatures are also compared with the INCOIS Bio-ROMS model in the Model vs Observation view (210 monthly matchups between 2014 and 2019). Open the profile panel to see its latest QC-filtered profile and observed mixed layer depth.',
        keyInsights: ['Delayed-mode (adjusted) data', 'Model–observation matchups use the float’s own profile dates'],
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
