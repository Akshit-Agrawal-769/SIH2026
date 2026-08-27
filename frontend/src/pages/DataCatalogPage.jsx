import React, { useState } from 'react';
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
  Sliders,
} from 'lucide-react';

export const DataCatalogPage = () => {
  const {
    metadata,
    activeDataset,
    setActivePage,
    setVariable,
  } = useOceanStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);

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
            <Database className="w-4 h-4 text-white/70" />
            <span className="text-sm font-sans font-medium text-white">INCOIS Ocean Data & NetCDF Catalog</span>
          </div>
          <button
            onClick={() => useOceanStore.getState().setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1 glass-pill text-xs font-sans text-white/80 hover:text-white transition-colors"
          >
            <span>← Back to 3D Globe</span>
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#080e1a] border border-[#1e293b] text-xs">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search variables..."
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
            <span>Dataset:</span>
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

            {/* Pagination footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Showing 1 to {filtered.length} of {variablesList.length} variables</span>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 bg-[#080e1a] border border-[#1e293b] hover:border-slate-500">{'<<'}</button>
                <button className="px-2 py-0.5 bg-[#080e1a] border border-[#1e293b] hover:border-slate-500">{'<'}</button>
                <button className="px-2 py-0.5 bg-cyan-600 text-white font-bold">1</button>
                <button className="px-2 py-0.5 bg-[#080e1a] border border-[#1e293b] hover:border-slate-500">2</button>
                <button className="px-2 py-0.5 bg-[#080e1a] border border-[#1e293b] hover:border-slate-500">{'>'}</button>
                <button className="px-2 py-0.5 bg-[#080e1a] border border-[#1e293b] hover:border-slate-500">{'>>'}</button>
              </div>
            </div>
          </div>

          {/* Right Variable Details Card (4 Cols) */}
          <div className="lg:col-span-4 p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col justify-between gap-4 text-xs">
            {activeVar ? (
              <div className="flex flex-col gap-4">
                <div className="border-b border-[#1e293b] pb-2">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">VARIABLE DETAILS</span>
                  <h3 className="text-base font-bold text-cyan-300 mt-1">
                    {activeVar.varName}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeVar.standardName}
                  </span>
                </div>

                <div className="flex flex-col gap-2 text-[11px]">
                  <div className="flex items-center justify-between border-b border-[#141e33] pb-1.5">
                    <span className="text-slate-400">RANGE:</span>
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
                    Download Metadata
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
    </div>
  );
};