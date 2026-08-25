import React from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Database,
  Info,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Compass,
  Radio
} from '../components/Icons';

export const DataCatalogPage = () => {
  const {
    metadata,
    activeDataset,
    argoFloats,
    setActivePage,
  } = useOceanStore();

  const variablesList = [
    {
      symbol: 'SST',
      varName: 'temp / SST',
      standardName: 'sea_surface_temperature',
      units: '°C',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Sea surface potential temperature calculated from ROMS thermodynamic equations with bulk flux atmospheric forcing.',
    },
    {
      symbol: 'SSS',
      varName: 'salt / SSS',
      standardName: 'sea_surface_salinity',
      units: 'PSU',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Practical salinity at ocean surface on the PSS-78 scale, reflecting evaporation-precipitation flux and river runoff.',
    },
    {
      symbol: 'CHL',
      varName: 'chl / CHLA',
      standardName: 'mass_concentration_of_chlorophyll_a_in_sea_water',
      units: 'mg/m³',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Phytoplankton biomass indicator simulated via the coupled biogeochemical module under solar irradiance.',
    },
    {
      symbol: 'MLD',
      varName: 'mld',
      standardName: 'ocean_mixed_layer_thickness',
      units: 'm',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Depth of the surface turbulent mixed layer computed via potential density threshold criteria (0.03 kg/m³).',
    },
    {
      symbol: 'DIC',
      varName: 'dic',
      standardName: 'mole_concentration_of_dissolved_inorganic_carbon_in_sea_water',
      units: 'µmol/kg',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Total dissolved inorganic carbon pool including aqueous CO2, bicarbonate, and carbonate ions.',
    },
    {
      symbol: 'NO3',
      varName: 'no3',
      standardName: 'mole_concentration_of_nitrate_in_sea_water',
      units: 'µmol/L',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Dissolved nitrate macronutrient concentration driving primary productivity and coastal upwelling blooms.',
    },
    {
      symbol: 'pCO2_Original',
      varName: 'pco2 / pCO2_Original',
      standardName: 'surface_partial_pressure_of_carbon_dioxide_in_sea_water',
      units: 'µatm',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Raw partial pressure of carbon dioxide in surface seawater equilibrating with marine boundary layer atmosphere.',
    },
    {
      symbol: 'pCO2_Int',
      varName: 'pCO2_Int',
      standardName: 'interpolated_surface_pco2',
      units: 'µatm',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Spatially interpolated surface pCO2 harmonized across cloud-masked observation gaps.',
    },
    {
      symbol: 'pCO2_Clim',
      varName: 'pCO2_Clim',
      standardName: 'climatological_surface_pco2',
      units: 'µatm',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Long-term decadal climatological baseline of surface pCO2 for anomaly derivation.',
    },
    {
      symbol: 'Deviant_uncertainty',
      varName: 'Deviant_uncertainty',
      standardName: 'pco2_model_uncertainty_deviance',
      units: 'µatm',
      dims: 'TIME × LAT × LON (480 × 756 × 1081)',
      classification: '2D Surface Field',
      desc: 'Standard error variance representing model uncertainty and statistical deviance from observational benchmarks.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#040814] text-slate-100 font-mono p-4 sm:p-6 md:p-8 select-none">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">
                SCIENTIFIC DATASET MANIFEST
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
              INCOIS Oceanographic Data Catalog
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              Complete catalog of integrated numerical models and in-situ observational datasets. Detailed specifications of dimensionality, CF conventions, units, and Zenodo DOI citations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePage('explorer')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-400 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-blue-950/50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>LAUNCH 3D EXPLORER</span>
            </button>
          </div>
        </div>

        {/* Primary Dataset Profile Card */}
        <div className="p-5 bg-[#080e1a] border border-blue-500/40 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-wide">
                  INCOIS-BIO-ROMS.nc (Authoritative Real Dataset)
                </span>
                <span className="text-[10px] text-slate-400">
                  Regional Ocean Modeling System (ROMS) Coupled Biogeochemical Simulation
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 bg-blue-950 border border-blue-500/50 text-blue-300 font-bold">
                CF-1.6 COMPLIANT
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                NETCDF-4 HDF5
              </span>
            </div>
          </div>

          {/* Dataset Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">BINARY SIZE</span>
              <span className="text-blue-300 font-bold">9.25 GB (8.61 GiB)</span>
            </div>
            <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">TIME DIMENSION</span>
              <span className="text-slate-200 font-bold">480 Monthly Steps</span>
            </div>
            <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">LATITUDE DIM</span>
              <span className="text-slate-200 font-bold">756 Grid Points</span>
            </div>
            <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">LONGITUDE DIM</span>
              <span className="text-slate-200 font-bold">1081 Grid Points</span>
            </div>
            <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">CHUNK TOPOLOGY</span>
              <span className="text-teal-300 font-bold">[80, 126, 181]</span>
            </div>
            <div className="p-2.5 bg-[#040814] border border-[#1e293b] flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase">SPATIAL BOUNDS</span>
              <span className="text-amber-300 font-bold">30°E—120°E, 30°S—30°N</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-[#1e293b] pt-3">
            <span>
              DOI Reference: <strong className="text-slate-200">10.5281/zenodo.13802393</strong>
            </span>
            <span>
              Institute: <strong className="text-slate-200">Indian National Centre for Ocean Information Services</strong>
            </span>
          </div>
        </div>

        {/* 10 Scientific Variables Table */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Registered Scientific State Variables (10 Fields)</span>
            </span>
            <span className="text-[10px] text-slate-500">
              All variables verified as authentic 2D surface fields ($TIME \times LAT \times LON$)
            </span>
          </div>

          <div className="overflow-x-auto bg-[#080e1a] border border-[#1e293b] shadow-xl">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#0c1424] border-b border-[#1e293b] text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Variable Name</th>
                  <th className="py-2.5 px-3">CF Standard Name</th>
                  <th className="py-2.5 px-3">Units</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141e33] text-[11px]">
                {variablesList.map((v, i) => (
                  <tr key={i} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">{v.symbol}</td>
                    <td className="py-2.5 px-3 text-slate-200">{v.varName}</td>
                    <td className="py-2.5 px-3 text-slate-400">{v.standardName}</td>
                    <td className="py-2.5 px-3 text-amber-300 font-bold">{v.units}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/40 text-cyan-400 text-[9px] font-bold">
                        {v.classification}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px] max-w-xs leading-tight">
                      {v.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Argo In-Situ GDAC Dataset Registry Card */}
        <div className="p-5 bg-[#080e1a] border border-amber-500/40 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Radio className="w-4 h-4 text-amber-400" />
            <span>CORIOLIS IN-SITU ARGO GDAC REGISTRY</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Directly ingested from Coriolis Global Data Assembly Centre (GDAC) NetCDF archives. Includes in-situ autonomous floats equipped with Seabird SBE41 CTD sensors. All cycles are dynamically decoded for physical temperature (°C), practical salinity (PSU), and pressure (dbar), and converted to absolute depth (m) via the TEOS-10 standard (`gsw.z_from_p`).
          </p>
        </div>
      </div>
    </div>
  );
};