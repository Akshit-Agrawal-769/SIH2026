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

export const SCIENCE_TOURS: ScienceTour[] = [
  {
    id: 'monsoon-somali-jet',
    title: 'The Great Southwest Monsoon & Somali Jet',
    tagline: 'Witness planetary wind stress, cold coastal upwelling, and the Great Whirl',
    duration: '3 mins',
    difficulty: 'Beginner',
    category: 'Monsoon Dynamics',
    thumbnailColor: 'from-amber-500 to-red-600',
    summary: 'Discover how the annual Indian Southwest Monsoon drives intense cross-equatorial ocean currents, spawns massive cold coastal upwelling off Somalia, and sheds planetary mesoscale eddies across the Arabian Sea.',
    steps: [
      {
        id: 'monsoon-step-1',
        stepNumber: 1,
        title: 'Planetary Monsoon Wind Stress Engine',
        subtitle: 'Cross-Equatorial Atmospheric Gradient',
        narrative:
          'Every summer from June through September, intense solar heating over the Indian subcontinent establishes a massive atmospheric pressure gradient. Strong southwesterly trade winds drag across the tropical ocean surface, driving one of the most powerful seasonal ocean circulation systems on planet Earth.',
        keyInsights: [
          'Reversal of equatorial wind stress across the basin',
          'Primary moisture transport engine for South Asian agriculture',
          'Fastest-accelerating seasonal boundary current in the global ocean'
        ],
        camera: { lon: 72.0, lat: 6.0, height: 12500000, pitch: -85.0, heading: 0.0, duration: 2.5 },
        variable: 'temperature',
        depth: 0.5,
        activeLayers: ['temperature', 'currents'],
        time: '2024-06-01',
        isPlaying: false
      },
      {
        id: 'monsoon-step-2',
        stepNumber: 2,
        title: 'The Somali Cold Upwelling Wedge',
        subtitle: 'Ekman Divergence along the Horn of Africa',
        narrative:
          'Look at the coast of Somalia and Socotra. Intense monsoonal winds blowing parallel to the coastline push surface waters offshore via Ekman transport. This forces cold, nutrient-rich deep water (<21°C) to surge to the surface, creating an intense turquoise cold wedge that contrasts dramatically against the 30°C tropical warm pool.',
        keyInsights: [
          'Offshore Ekman transport drives coastal divergence',
          'Sea surface temperatures plunge by over 8°C in days',
          'Nutrient upwelling triggers explosive primary biological productivity'
        ],
        camera: { lon: 54.0, lat: 11.0, height: 2600000, pitch: -65.0, heading: 30.0, duration: 2.8 },
        variable: 'temperature',
        depth: 0.5,
        activeLayers: ['temperature', 'currents'],
        time: '2024-06-04',
        isPlaying: false
      },
      {
        id: 'monsoon-step-3',
        stepNumber: 3,
        title: 'The Great Whirl & Streaming Vectors',
        subtitle: 'Supersonic Ocean Jet (>2.2 m/s)',
        narrative:
          'Observe the glowing vector arrows streaming northeastward! The western boundary Somali Current accelerates to over 2.2 m/s (over 8 km/h), feeding the famous "Great Whirl"—a gigantic clockwise anticyclonic eddy hundreds of kilometers wide that sheds rotating vortex rings into the central Arabian Sea.',
        keyInsights: [
          'Current velocities exceed 2.2 m/s (4.3 knots)',
          'Great Whirl diameter spans over 450 km across the Somali Basin',
          'Rotational vortex rings advect heat and nutrients eastward'
        ],
        camera: { lon: 58.5, lat: 12.5, height: 2100000, pitch: -60.0, heading: 45.0, duration: 2.2 },
        variable: 'currents',
        depth: 0.5,
        activeLayers: ['currents', 'temperature'],
        time: '2024-06-07',
        isPlaying: false
      },
      {
        id: 'monsoon-step-4',
        stepNumber: 4,
        title: '14-Day Monsoon Evolution & Advection',
        subtitle: 'Westward Rossby Waves & Pulsating Surge',
        narrative:
          'Watch the 14-day simulation cycle actively unfold across June 1 to June 14. As monsoon wind stress pulses in weekly bursts, planetary Rossby waves carry mesoscale eddy vortex rings westward, while the cold upwelling plume billows out into the open ocean.',
        keyInsights: [
          'Westward propagation of planetary Rossby waves (~0.6° lon/day)',
          'Intra-seasonal monsoon wind bursts modulate upwelling intensity',
          'Continuous energy transfer between wind, currents, and internal waves'
        ],
        camera: { lon: 66.0, lat: 13.5, height: 4200000, pitch: -70.0, heading: 10.0, duration: 2.5 },
        variable: 'temperature',
        depth: 0.5,
        activeLayers: ['temperature', 'currents'],
        time: '2024-06-01',
        isPlaying: true
      }
    ]
  },
  {
    id: 'arabian-sea-salinity',
    title: 'The Arabian Sea Salinity Furnace',
    tagline: 'Extreme evaporation, hypersaline waters, and subterranean subduction',
    duration: '2.5 mins',
    difficulty: 'Intermediate',
    category: 'Salinity & Water Masses',
    thumbnailColor: 'from-emerald-500 to-cyan-600',
    summary: 'Investigate how intense evaporation from dry desert winds turns the northern Arabian Sea into a high-salinity engine, and trace the subduction of Arabian Sea High Salinity Water into the subsurface thermocline.',
    steps: [
      {
        id: 'salinity-step-1',
        stepNumber: 1,
        title: 'Desert Evaporation Engine',
        subtitle: 'Net Freshwater Deficit (E >> P)',
        narrative:
          'Dry continental winds blowing from the Arabian and Thar deserts scorch the northern Arabian Sea. Annual evaporation exceeds precipitation by over 1.2 meters per year, concentrating sea salt into hyper-saline surface waters surpassing 36.5 to 37.5 PSU.',
        keyInsights: [
          'Evaporation drastically exceeds rainfall (E >> P > 1.2 m/yr)',
          'Surface salinity reaches highest levels in the tropical Indian Ocean (>37 PSU)',
          'Dense surface layer formed through continuous salt concentration'
        ],
        camera: { lon: 65.0, lat: 19.5, height: 2800000, pitch: -70.0, heading: 0.0, duration: 2.5 },
        variable: 'salinity',
        depth: 0.5,
        activeLayers: ['salinity', 'india_eez'],
        time: '2024-06-05',
        isPlaying: false
      },
      {
        id: 'salinity-step-2',
        stepNumber: 2,
        title: 'ASHSW Subduction at 100m Depth',
        subtitle: 'Convective Density Overturning',
        narrative:
          'We have sliced vertically down to 100 meters depth. Heavy, high-salinity surface water becomes so dense that it sinks beneath lighter equatorial waters, forming the Arabian Sea High Salinity Water (ASHSW) mass. This core tongue flows southward through the thermocline across the entire Arabian Sea.',
        keyInsights: [
          'Density-driven convective subduction into the thermocline',
          'Forms permanent subterranean salinity maximum at 75–150m depth',
          'Spreads southward toward the equator and eastward toward Sri Lanka'
        ],
        camera: { lon: 67.0, lat: 17.5, height: 2400000, pitch: -65.0, heading: 15.0, duration: 2.2 },
        variable: 'salinity',
        depth: 100.0,
        activeLayers: ['salinity'],
        time: '2024-06-05',
        isPlaying: false
      }
    ]
  },
  {
    id: 'bay-of-bengal-freshwater',
    title: 'Bay of Bengal Freshwater Plume & Cyclone Buffer',
    tagline: 'Ganges-Brahmaputra discharge and the heat-trapping barrier layer',
    duration: '3 mins',
    difficulty: 'Intermediate',
    category: 'Biogeochemistry',
    thumbnailColor: 'from-blue-600 to-indigo-800',
    summary: 'Examine how massive river discharge from the Himalayas blankets the Bay of Bengal with fresh water, creating a barrier layer that traps solar heat and fuels intense tropical cyclones.',
    steps: [
      {
        id: 'bob-step-1',
        stepNumber: 1,
        title: 'Ganges-Brahmaputra River Inflow',
        subtitle: 'World\'s Largest River Discharge Lens',
        narrative:
          'In dramatic contrast to the salty Arabian Sea, the northern Bay of Bengal receives colossal freshwater runoff from the Ganges, Brahmaputra, and Meghna river basins—delivering over 1,300 cubic kilometers of fresh water each year. Watch the freshwater plume (<30 PSU) stretch out across the northern basin.',
        keyInsights: [
          'Annual river runoff exceeds 1,300 km³/year',
          'Surface salinity plummets down to 28.5–30.0 PSU',
          'Dramatic halocline forms within the upper 25 meters'
        ],
        camera: { lon: 88.5, lat: 19.5, height: 2300000, pitch: -65.0, heading: 0.0, duration: 2.5 },
        variable: 'salinity',
        depth: 0.5,
        activeLayers: ['salinity', 'india_eez'],
        time: '2024-06-05',
        isPlaying: false
      },
      {
        id: 'bob-step-2',
        stepNumber: 2,
        title: 'The Cyclone-Fueling "Barrier Layer"',
        subtitle: 'Solar Heat Trap in the Upper 30m',
        narrative:
          'Because fresh water is less dense than salt water, this river plume acts as a buoyant lid. It prevents deep cold water from mixing upward, trapping solar heat inside the top 30 meters. This creates a "Barrier Layer" with ocean temperatures exceeding 30.5°C—the perfect thermal fuel for rapid cyclone intensification.',
        keyInsights: [
          'Density stratification prevents vertical turbulent mixing',
          'Upper 30m solar heat reservoir reaches 30.5°C–31.5°C',
          'Key thermodynamic catalyst for rapid tropical cyclone intensification'
        ],
        camera: { lon: 86.0, lat: 16.0, height: 2800000, pitch: -70.0, heading: 0.0, duration: 2.2 },
        variable: 'temperature',
        depth: 0.5,
        activeLayers: ['temperature', 'salinity'],
        time: '2024-06-05',
        isPlaying: false
      },
      {
        id: 'bob-step-3',
        stepNumber: 3,
        title: 'Coastal Plume Advection along India EEZ',
        subtitle: 'East India Coastal Current (EICC) Riverway',
        narrative:
          'Watch the 14-day time sequence: the boundary current carries this low-salinity river water southward along the coastlines of Odisha, Andhra Pradesh, and Tamil Nadu. The fresh river plume hugs the eastern Indian seaboard for over 1,500 kilometers.',
        keyInsights: [
          'East India Coastal Current transports fresh water southward',
          'Freshwater boundary layer regulates coastal marine ecosystems',
          'Dynamic meandering responds to monsoon wind bursts'
        ],
        camera: { lon: 83.5, lat: 14.5, height: 2600000, pitch: -65.0, heading: 10.0, duration: 2.5 },
        variable: 'salinity',
        depth: 0.5,
        activeLayers: ['salinity', 'currents'],
        time: '2024-06-01',
        isPlaying: true
      }
    ]
  },
  {
    id: 'argo-robot-dive',
    title: 'Argo Autonomous Robot Ocean Profiler Mission',
    tagline: 'Follow an active robotic buoy on its 2,000m deep profiling dive',
    duration: '2.5 mins',
    difficulty: 'Advanced',
    category: 'Ocean Robotics',
    thumbnailColor: 'from-cyan-500 to-blue-700',
    summary: 'Track an operational INCOIS robotic Argo buoy in the Arabian Sea, explore its autonomous hydraulic buoyancy engine, and inspect high-precision vertical CTD profiles down to 2,000 meters depth.',
    steps: [
      {
        id: 'argo-step-1',
        stepNumber: 1,
        title: 'The INCOIS Autonomous Float Fleet',
        subtitle: 'Global Sentinel Robot Network',
        narrative:
          'Scattered across the Indian Ocean, autonomous robotic Argo floats drift untethered through the high seas. Maintained by INCOIS, these autonomous robots form the observational backbone of modern ocean and climate prediction.',
        keyInsights: [
          'Over 4,000 autonomous Argo floats active globally',
          'Zero fuel consumption: powered by internal hydraulic buoyancy bladders',
          'Provides continuous vertical temperature and salinity profiles'
        ],
        camera: { lon: 74.0, lat: 15.0, height: 4500000, pitch: -75.0, heading: 0.0, duration: 2.5 },
        variable: 'temperature',
        depth: 0.5,
        activeLayers: ['temperature', 'argo', 'india_eez'],
        time: '2024-06-04',
        isPlaying: false
      },
      {
        id: 'argo-step-2',
        stepNumber: 2,
        title: 'Meet Float INCOIS_ARGO_2902126',
        subtitle: 'Central Arabian Sea Station (16.25°N, 70.15°E)',
        narrative:
          'We have flown right above active buoy INCOIS_ARGO_2902126 off the Maharashtra coast. Every 10 days, this float deflates its external oil bladder to dive 1,000m into the parking depth, drifts for 9 days, descends to 2,000m, and ascends while recording continuous CTD measurements.',
        keyInsights: [
          'Station coordinates: 16.25°N, 70.15°E (Maharashtra Offshore)',
          '10-day recurring dive and ascent profiling cycle',
          'Equipped with Sea-Bird scientific CTD sensor package'
        ],
        camera: { lon: 70.15, lat: 16.25, height: 85000, pitch: -50.0, heading: 25.0, duration: 2.8 },
        variable: 'temperature',
        depth: 50.0,
        activeLayers: ['argo', 'temperature'],
        time: '2024-06-04',
        isPlaying: false,
        selectedInstrumentId: 'INCOIS_ARGO_2902126'
      },
      {
        id: 'argo-step-3',
        stepNumber: 3,
        title: 'Deep CTD Stratification Profile (0–2,000m)',
        subtitle: 'Real Ground-Truth Hydrographic Data',
        narrative:
          'Notice the open depth-profile window displaying real CTD data from this float! Observe the steep thermocline between 50m and 150m where temperature drops precipitously from 29.1°C down to 14.5°C, matching the subterranean high-salinity core (36.4 PSU).',
        keyInsights: [
          'Direct validation of numerical ocean models against real buoys',
          'Captures thermocline and halocline gradients with 1-meter resolution',
          'Upon surfacing, transmits data packets via satellite in under 20 minutes'
        ],
        camera: { lon: 70.15, lat: 16.25, height: 60000, pitch: -45.0, heading: 20.0, duration: 2.0 },
        variable: 'temperature',
        depth: 100.0,
        activeLayers: ['argo', 'temperature'],
        time: '2024-06-04',
        isPlaying: false,
        selectedInstrumentId: 'INCOIS_ARGO_2902126'
      }
    ]
  }
];
