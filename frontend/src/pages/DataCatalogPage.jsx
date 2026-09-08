import React, { useState, useEffect } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Database,
  Info,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Compass,
  Radio,
  Search,
  Sliders
} from '../components/Icons';

export const DataCatalogPage = () => {
  const {
    datasets,
    metadata,
    activeDataset,
    selectDataset,
    argoSources,
    argoMetadata,
    setActiveArgoSource,
    activeArgoSource,
    setActivePage,
    setVariable,
    fetchArgoSources,
  } = useOceanStore();

  const [activeTab, setActiveTab] = useState('models'); // 'models' | 'argo' | 'variables'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);

  useEffect(() => {
    fetchArgoSources();
  }, [fetchArgoSources]);

  const MODEL_PRODUCTS = [
    {
      id: 'INCOIS-BIO-ROMS.nc',
      name: 'INCOIS Bio-ROMS Coupled Biogeochemical Ocean Model',
      filename: 'INCOIS-BIO-ROMS.nc',
      institution: 'Indian National Centre for Ocean Information Services (INCOIS)',
      fileSize: '9.2 GB NetCDF-4',
      gridType: 'Terrain-Following Curvilinear S-Coordinate (40 Levels)',
      spatialBounds: '30.0°E — 120.0°E, 30.0°S — 30.0°N (Indian Ocean)',
      resolution: '1/12° (approx. 9 km horizontal)',
      variables: ['temp', 'salt', 'chl', 'mld', 'no3', 'dic', 'pco2'],
      description: 'Authoritative Indian Ocean numerical circulation model coupled with biogeochemistry simulating seasonal monsoon dynamics, thermocline evolution, upwelling nutrients, and carbon chemistry.',
    },
    {
      id: 'cmems.nc',
      name: 'CMEMS ARMOR3D Global Ocean Multi-Observation Reprocessing',
      filename: 'cmems.nc',
      institution: 'Copernicus Marine Environment Monitoring Service (CMEMS)',
      fileSize: '95 MB NetCDF-4',
      gridType: 'Rectilinear Depth Levels (0 — 5500 m)',
      spatialBounds: '180.0°W — 180.0°E, 82.2°S — 89.9°N (Global Ocean)',
      resolution: '1/4° (approx. 25 km horizontal)',
      variables: ['temp', 'salt', 'u', 'v', 'mld', 'ssh'],
      description: 'ARMOR3D multi-observation global reprocessing integrating satellite altimetry (SSH/zo), satellite SST, and in-situ Argo CTD profiles via 3D multivariate optimal interpolation.',
    },
    {
      id: 'incois_roms_indian_ocean.nc',
      name: 'INCOIS ROMS High-Resolution Physical Reanalysis',
      filename: 'incois_roms_indian_ocean.nc',
      institution: 'INCOIS Ocean Modeling Group',
      fileSize: '95 MB NetCDF-4',
      gridType: 'Multi-Level Physical Grid (0 — 5500 m)',
      spatialBounds: 'Indian Ocean & Equatorial Dynamics Domain',
      resolution: 'High-Resolution Geostrophic Grid',
      variables: ['temp', 'salt', 'u', 'v', 'mld', 'ssh'],
      description: 'Regional Indian Ocean hydrodynamic reanalysis providing boundary conditions and geostrophic current vector fields.',
    },
  ];

  const DAC_DETAILS = [
    {
      source: 'incois',
      name: 'INCOIS National Oceanographic Data Centre',
      country: 'India',
      platforms: 293,
      profiles: 41623,
      domain: 'Arabian Sea, Bay of Bengal & Equatorial Indian Ocean',
      qcPolicy: 'TEOS-10 calibrated, Real-time Flag 1 & 2',
      sensors: 'CTD (Conductivity, Temp, Depth), Bio-Argo (Chl-a, DOX, Nitrate)',
    },
    {
      source: 'aoml',
      name: 'NOAA Atlantic Oceanographic & Meteorological Lab',
      country: 'United States',
      platforms: 518,
      profiles: 67442,
      domain: 'Global Ocean, Atlantic Basin, Southern Oceans',
      qcPolicy: 'NOAA/AOML Delayed-Mode QC & Real-time Automated',
      sensors: 'CTD Standard & Deep-Argo (4000m/6000m)',
    },
    {
      source: 'csiro',
      name: 'CSIRO Marine & Atmospheric Research',
      country: 'Australia',
      platforms: 212,
      profiles: 27193,
      domain: 'Indo-Pacific, Southern Ocean & Southeast Indian Ocean',
      qcPolicy: 'CSIRO Automated & Climatology Validation',
      sensors: 'CTD, Bio-Argo & Deep SOLO Floats',
    },
    {
      source: 'coriolis',
      name: 'Coriolis / Euro-Argo ERIC (Ifremer)',
      country: 'France / European Union',
      platforms: 113,
      profiles: 19375,
      domain: 'Global Data Assembly Centre (GDAC) Core Array',
      qcPolicy: 'Euro-Argo Delayed Mode Quality Control (DMQC)',
      sensors: 'Provor, Arvor, Apex CTD & BGC Array',
    },
    {
      source: 'csio',
      name: 'Second Institute of Oceanography (MNR)',
      country: 'China',
      platforms: 123,
      profiles: 13739,
      domain: 'Northwestern Pacific & Eastern Indian Ocean',
      qcPolicy: 'China Argo Real-Time QC Processing',
      sensors: 'HM2000, Apex, PROVOR profiling platforms',
    },
    {
      source: 'bodc',
      name: 'British Oceanographic Data Centre',
      country: 'United Kingdom',
      platforms: 43,
      profiles: 4535,
      domain: 'North Atlantic, Southern Ocean & Indian Ocean',
      qcPolicy: 'BODC Master Delayed-Mode Verification',
      sensors: 'Apex CTD & Acoustic Profilers',
    },
    {
      source: 'jma',
      name: 'Japan Meteorological Agency',
      country: 'Japan',
      platforms: 9,
      profiles: 953,
      domain: 'Western Pacific & Tropical Indian Ocean',
      qcPolicy: 'JMA Operational Quality Assessment',
      sensors: 'NINJA, Apex & Navis Autonomous CTD',
    },
    {
      source: 'meds',
      name: 'Marine Environmental Data Section (DFO)',
      country: 'Canada',
      platforms: 5,
      profiles: 468,
      domain: 'North Pacific, Labrador Sea & Arctic Boundaries',
      qcPolicy: 'MEDS Canadian Real-time Quality Checks',
      sensors: 'Apex & MetOcean Autonomous Profilers',
    },
    {
      source: 'argo',
      name: 'Argo Global Data Assembly Centre Reference',
      country: 'International Argo Consortium',
      platforms: 2,
      profiles: 318,
      domain: 'Inter-calibration Reference Stations',
      qcPolicy: 'WMO & IOC International Standards',
      sensors: 'Calibrated Golden Float CTD Benchmarks',
    },
  ];

  const variablesList = [
    {
      symbol: 'temp',
      varName: 'Temperature (SST)',
      standardName: 'sea_water_temperature',
      units: '°C',
      dims: 'time, depth, lat, lon',
      category: 'physical',
      range: '7.02 °C — 31.45 °C',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Sea water potential temperature calculated from ROMS thermodynamic equations with bulk flux atmospheric forcing.',
    },
    {
      symbol: 'salt',
      varName: 'Salinity (SSS)',
      standardName: 'sea_water_salinity',
      units: 'PSU',
      dims: 'time, depth, lat, lon',
      category: 'physical',
      range: '31.20 PSU — 37.10 PSU',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Practical salinity on the PSS-78 scale, reflecting evaporation-precipitation flux and river runoff.',
    },
    {
      symbol: 'u',
      varName: 'Zonal Velocity (u)',
      standardName: 'sea_water_x_velocity',
      units: 'm/s',
      dims: 'time, depth, lat, lon',
      category: 'physical',
      range: '-1.85 m/s — 2.10 m/s',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Eastward water velocity component along the curvilinear model grid.',
    },
    {
      symbol: 'v',
      varName: 'Meridional Velocity (v)',
      standardName: 'sea_water_y_velocity',
      units: 'm/s',
      dims: 'time, depth, lat, lon',
      category: 'physical',
      range: '-1.45 m/s — 1.62 m/s',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Northward water velocity component along the curvilinear model grid.',
    },
    {
      symbol: 'mld',
      varName: 'Mixed Layer Depth',
      standardName: 'ocean_mixed_layer_thickness',
      units: 'm',
      dims: 'time, lat, lon',
      category: 'physical',
      range: '10.0 m — 145.0 m',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Depth of the surface turbulent mixed layer computed via density threshold criteria (0.03 kg/m³).',
    },
    {
      symbol: 'chl',
      varName: 'Chlorophyll-a (CHLA)',
      standardName: 'mass_concentration_of_chlorophyll_a_in_sea_water',
      units: 'mg/m³',
      dims: 'time, depth, lat, lon',
      category: 'biogeochemical',
      range: '0.01 mg/m³ — 12.80 mg/m³',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Phytoplankton biomass indicator simulated via the coupled biogeochemical module.',
    },
    {
      symbol: 'no3',
      varName: 'Nitrate (NO3)',
      standardName: 'mole_concentration_of_nitrate_in_sea_water',
      units: 'mmol/m³',
      dims: 'time, depth, lat, lon',
      category: 'biogeochemical',
      range: '0.00 mmol/m³ — 34.50 mmol/m³',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Dissolved nitrate macronutrient driving primary productivity and upwelling blooms.',
    },
    {
      symbol: 'dic',
      varName: 'Dissolved Inorganic Carbon',
      standardName: 'mole_concentration_of_dissolved_inorganic_carbon_in_sea_water',
      units: 'mmol/m³',
      dims: 'time, depth, lat, lon',
      category: 'carbon',
      range: '1850.0 mmol/m³ — 2350.0 mmol/m³',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Total dissolved inorganic carbon pool including aqueous CO2, bicarbonate, and carbonate ions.',
    },
    {
      symbol: 'pco2',
      varName: 'Surface pCO2',
      standardName: 'surface_partial_pressure_of_carbon_dioxide_in_sea_water',
      units: 'µatm',
      dims: 'time, lat, lon',
      category: 'carbon',
      range: '280.0 µatm — 560.0 µatm',
      missingValue: '-9.99e+33',
      freq: 'Monthly',
      addedOn: '2024-05-12 10:30 UTC',
      desc: 'Partial pressure of carbon dioxide in surface seawater equilibrating with atmosphere.',
    }
  ];

  const filtered = variablesList.filter((v) => {
    const matchSearch =
      v.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.varName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.standardName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'all' || v.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const activeVar = filtered[selectedVarIndex] || filtered[0] || variablesList[0];

  const handleDownloadMetadata = () => {
    const jsonStr = JSON.stringify(
      {
        dataset: activeDataset || 'INCOIS-BIO-ROMS.nc',
        variable: activeVar,
        catalog_version: '2.4.0',
        metadata: metadata || {},
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeVar.symbol}_metadata.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        {/* Top Navigation & Workspace Strip */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-sans font-medium text-white">INCOIS Integrated Ocean Data Catalog</span>
            <span className="text-[10px] px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono rounded">
              CF-1.6 & TEOS-10 Real Data
            </span>
          </div>
          <button
            onClick={() => setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#0c1424] hover:bg-[#141e33] border border-[#1e293b] text-xs font-sans text-cyan-300 transition-colors"
          >
            <span>← Back to 3D Globe</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2">
          <button
            onClick={() => setActiveTab('models')}
            className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'models'
                ? 'bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Numerical Ocean Models ({datasets.length || 3})</span>
          </button>

          <button
            onClick={() => setActiveTab('argo')}
            className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'argo'
                ? 'bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>In-Situ Argo Network (9 DACs · 175k+ Profiles)</span>
          </button>

          <button
            onClick={() => setActiveTab('variables')}
            className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'variables'
                ? 'bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Variable Attributes ({variablesList.length})</span>
          </button>
        </div>

        {/* TAB 1: NUMERICAL MODELS */}
        {activeTab === 'models' && (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] text-xs text-slate-300 flex items-center justify-between">
              <div>
                <span className="text-cyan-300 font-bold">ACTIVE WORKSPACE MODEL: </span>
                <span className="font-mono text-white font-bold">{activeDataset || 'INCOIS-BIO-ROMS.nc'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Native NetCDF-4 binary format with 3D Float32 volumetric raymarching support
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODEL_PRODUCTS.map((prod) => {
                const isActive = (activeDataset === prod.filename) || (!activeDataset && prod.id === 'INCOIS-BIO-ROMS.nc');
                return (
                  <div
                    key={prod.id}
                    className={`p-4 bg-[#080e1a] border flex flex-col justify-between gap-4 transition-all ${
                      isActive ? 'border-cyan-500 shadow-lg shadow-cyan-950/40' : 'border-[#1e293b] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider">{prod.institution}</span>
                          <h3 className="text-sm font-bold text-white mt-0.5">{prod.name}</h3>
                        </div>
                        {isActive && (
                          <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-400 text-cyan-300 text-[10px] font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {prod.description}
                      </p>

                      <div className="flex flex-col gap-1.5 text-[10px] text-slate-400 bg-[#040814] p-2.5 border border-[#141e33]">
                        <div className="flex justify-between">
                          <span>File:</span>
                          <span className="font-mono text-cyan-300 font-bold">{prod.filename}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="text-amber-300 font-bold">{prod.fileSize}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Grid System:</span>
                          <span className="text-slate-200 text-right">{prod.gridType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Coverage:</span>
                          <span className="text-slate-200 text-right">{prod.spatialBounds}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Resolution:</span>
                          <span className="text-emerald-400 font-bold">{prod.resolution}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[#1e293b]">
                          <span>Variables:</span>
                          <span className="text-cyan-300 font-mono">{prod.variables.join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      {!isActive ? (
                        <button
                          onClick={() => selectDataset(prod.filename)}
                          className="flex-1 py-1.5 bg-[#0c1424] hover:bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold transition-colors"
                        >
                          Select Model
                        </button>
                      ) : (
                        <div className="flex-1 py-1.5 text-center text-cyan-400 text-xs font-bold border border-cyan-500/40 bg-cyan-950/40">
                          Loaded in Memory
                        </div>
                      )}
                      <button
                        onClick={() => {
                          selectDataset(prod.filename);
                          setActivePage('explorer');
                        }}
                        className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
                      >
                        3D View →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: IN-SITU ARGO PROFILING ARRAY */}
        {activeTab === 'argo' && (
          <div className="flex flex-col gap-4">
            {/* Aggregate Scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#080e1a] border border-[#1e293b]">
                <span className="text-[10px] text-slate-400">TOTAL PROFILING PLATFORMS</span>
                <div className="text-xl font-bold text-cyan-300 mt-1">1,318 Floats</div>
                <span className="text-[10px] text-slate-500">Autonomous robotic profilers</span>
              </div>
              <div className="p-3 bg-[#080e1a] border border-[#1e293b]">
                <span className="text-[10px] text-slate-400">AUTHENTIC CTD PROFILES</span>
                <div className="text-xl font-bold text-amber-300 mt-1">175,646 Cycles</div>
                <span className="text-[10px] text-slate-500">Indexed from NetCDF storage</span>
              </div>
              <div className="p-3 bg-[#080e1a] border border-[#1e293b]">
                <span className="text-[10px] text-slate-400">DATA ASSEMBLY CENTRES</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">9 Global DACs</div>
                <span className="text-[10px] text-slate-500">INCOIS, Coriolis, AOML, CSIRO...</span>
              </div>
              <div className="p-3 bg-[#080e1a] border border-[#1e293b]">
                <span className="text-[10px] text-slate-400">DEPTH CALIBRATION</span>
                <div className="text-xl font-bold text-white mt-1">TEOS-10 GSW</div>
                <span className="text-[10px] text-slate-500">gsw.z_from_p(pressure, lat)</span>
              </div>
            </div>

            {/* Provider Filter Strip */}
            <div className="flex items-center gap-2 overflow-x-auto p-2.5 bg-[#080e1a] border border-[#1e293b] text-xs">
              <span className="text-slate-400 text-[11px] whitespace-nowrap">Filter Globe Display:</span>
              <button
                onClick={() => setActiveArgoSource('all')}
                className={`px-2.5 py-1 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  activeArgoSource === 'all'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-[#040814] text-slate-300 border border-[#1e293b] hover:border-slate-500'
                }`}
              >
                All DACs (1,318)
              </button>
              {DAC_DETAILS.map((dac) => (
                <button
                  key={dac.source}
                  onClick={() => setActiveArgoSource(dac.source)}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors whitespace-nowrap ${
                    activeArgoSource === dac.source
                      ? 'bg-cyan-600 text-white'
                      : 'bg-[#040814] text-slate-300 border border-[#1e293b] hover:border-slate-500'
                  }`}
                >
                  {dac.source.toUpperCase()} ({dac.platforms})
                </button>
              ))}
            </div>

            {/* DAC Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DAC_DETAILS.map((dac) => (
                <div
                  key={dac.source}
                  className={`p-4 bg-[#080e1a] border flex flex-col justify-between gap-3 transition-all ${
                    activeArgoSource === dac.source ? 'border-cyan-400 shadow-md shadow-cyan-950/30' : 'border-[#1e293b]'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-cyan-400 font-mono uppercase">{dac.country}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{dac.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 bg-[#040814] border border-[#1e293b] text-amber-300 text-[10px] font-mono font-bold">
                        {dac.source.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold py-1 border-y border-[#141e33]">
                      <div>
                        <span className="text-[10px] text-slate-500">PLATFORMS: </span>
                        <span className="text-cyan-300">{dac.platforms.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">PROFILES: </span>
                        <span className="text-emerald-400">{dac.profiles.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                      <div>
                        <span className="text-slate-500">Region: </span>
                        <span className="text-slate-300">{dac.domain}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Sensors: </span>
                        <span className="text-slate-300">{dac.sensors}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">QC Protocol: </span>
                        <span className="text-cyan-300">{dac.qcPolicy}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveArgoSource(dac.source);
                      setActivePage('home');
                    }}
                    className="w-full py-1.5 bg-[#0c1424] hover:bg-cyan-950 hover:border-cyan-500 border border-[#1e293b] text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Inspect Floats on 3D Globe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VARIABLES SPECIFICATION */}
        {activeTab === 'variables' && (
          <div className="flex flex-col gap-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#080e1a] border border-[#1e293b] text-xs">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search variables (e.g., temp, salt, chl)..."
                    className="w-full pl-9 pr-3 py-1.5 bg-[#040814] border border-[#1e293b] text-slate-200 text-xs font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 bg-[#040814] border border-[#1e293b] text-slate-300 text-xs font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="physical">Physical Oceanography</option>
                  <option value="biogeochemical">Biogeochemical</option>
                  <option value="carbon">Carbon Chemistry</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span>Active Dataset:</span>
                <span className="text-cyan-300 font-bold">{activeDataset || 'INCOIS-BIO-ROMS.nc'}</span>
              </div>
            </div>

            {/* 2-Column Catalog View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Main Variables Table (8 Cols) */}
              <div className="lg:col-span-8 flex flex-col gap-3">
                <div className="overflow-x-auto bg-[#080e1a] border border-[#1e293b] shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0c1424] border-b border-[#1e293b] text-slate-400 text-[10px] uppercase">
                        <th className="py-2.5 px-3">VARIABLE</th>
                        <th className="py-2.5 px-3">LONG NAME</th>
                        <th className="py-2.5 px-3">UNITS</th>
                        <th className="py-2.5 px-3">DIMENSIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141e33] text-[11px]">
                      {filtered.map((v, i) => {
                        const isSelected = activeVar.symbol === v.symbol;
                        return (
                          <tr
                            key={v.symbol}
                            onClick={() => setSelectedVarIndex(i)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#121c2e] text-white font-bold' : 'hover:bg-[#0c1424] text-slate-300'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-cyan-300">{v.symbol}</td>
                            <td className="py-2.5 px-3">{v.varName}</td>
                            <td className="py-2.5 px-3 text-amber-300 font-bold">{v.units}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{v.dims}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>Showing {filtered.length} of {variablesList.length} CF variables</span>
                </div>
              </div>

              {/* Right Variable Details Card (4 Cols) */}
              <div className="lg:col-span-4 p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col justify-between gap-4 text-xs">
                {activeVar ? (
                  <div className="flex flex-col gap-4">
                    <div className="border-b border-[#1e293b] pb-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">VARIABLE SPECIFICATION</span>
                      <h3 className="text-base font-bold text-cyan-300 mt-1">
                        {activeVar.varName}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeVar.standardName}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 text-[11px]">
                      <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                        <span className="text-slate-400">VALID RANGE:</span>
                        <span className="text-amber-300 font-bold">{activeVar.range}</span>
                      </div>

                      <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                        <span className="text-slate-400">MISSING VALUE:</span>
                        <span className="text-slate-300 font-mono">{activeVar.missingValue}</span>
                      </div>

                      <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                        <span className="text-slate-400">FREQUENCY:</span>
                        <span className="text-emerald-400 font-bold">{activeVar.freq}</span>
                      </div>

                      <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                        <span className="text-slate-400">ADDED ON:</span>
                        <span className="text-slate-300">{activeVar.addedOn}</span>
                      </div>

                      <div className="flex flex-col gap-1 pt-1">
                        <span className="text-slate-400 text-[10px]">DESCRIPTION:</span>
                        <p className="text-slate-300 text-[10px] leading-relaxed">
                          {activeVar.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-3">
                      <button
                        onClick={handleDownloadMetadata}
                        className="w-full py-2 bg-[#0c1424] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-colors"
                      >
                        Download Metadata JSON
                      </button>
                      <button
                        onClick={() => {
                          setVariable(activeVar.symbol);
                          setActivePage('explorer');
                        }}
                        className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow-md"
                      >
                        Explore in 3D View
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};