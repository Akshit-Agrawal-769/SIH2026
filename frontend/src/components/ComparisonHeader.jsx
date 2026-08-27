import React from 'react';
import {
  TrendingUp,
  Globe,
  Radio,
  Calendar,
  MapPin,
  Database,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const ComparisonHeader = ({ onOpenMethodology }) => {
  const {
    comparisonData,
    selectedFloat,
    selectedCycle,
    activeDataset,
    variable,
    setVariable,
    fetchComparison,
    setActivePage,
    isLoading,
  } = useOceanStore();

  const wmo = comparisonData?.platform_number || selectedFloat?.platform_number || '2902084';
  const cycle = comparisonData?.cycle_number ?? selectedCycle ?? 1;
  const lat = comparisonData?.latitude ?? selectedFloat?.latest_position?.latitude;
  const lon = comparisonData?.longitude ?? selectedFloat?.latest_position?.longitude;
  const ts = comparisonData?.timestamp || selectedFloat?.latest_timestamp;

  const formatTimestamp = (rawTs) => {
    if (!rawTs) return '—';
    const dt = new Date(rawTs);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    }
    return String(rawTs).replace('T', ' ').replace('Z', ' UTC');
  };

  const handleVarChange = (newVar) => {
    if (newVar === variable) return;
    setVariable(newVar);
    fetchComparison(wmo, cycle, newVar, activeDataset);
  };

  return (
    <header className="h-12 px-4 border-b border-[var(--border-hairline)] bg-[var(--surface-header)] flex items-center justify-between font-mono text-xs select-none shrink-0">
      {/* Title & Entity Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-amber-400">
          <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
          <span className="font-bold text-slate-100 tracking-wider uppercase text-xs">
            4D Model × In-Situ Validation Workspace
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[var(--border-hairline)] text-[11px]">
          <span className="flex items-center gap-1 text-amber-300 font-bold bg-amber-950/60 px-1.5 py-0.5 border border-amber-500/40 rounded-[2px]">
            <Radio className="w-3 h-3" />
            <span>WMO {wmo} (CYCLE #{cycle})</span>
          </span>

          {lat !== undefined && lon !== undefined && (
            <span className="text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-500" />
              <strong className="text-slate-200">
                {Math.abs(lat).toFixed(2)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
              </strong>
            </span>
          )}

          {ts && (
            <span className="text-slate-400 hidden lg:flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span className="text-sky-300">{formatTimestamp(ts)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Controls & Nav */}
      <div className="flex items-center gap-2.5">
        {/* Variable Switcher */}
        <div className="segmented-control">
          <button
            onClick={() => handleVarChange('temp')}
            className={`segmented-option ${variable === 'temp' ? 'segmented-option-active text-sky-400 font-bold' : ''}`}
            title="Evaluate Potential Temperature (°C)"
          >
            TEMP (°C)
          </button>
          <button
            onClick={() => handleVarChange('salt')}
            className={`segmented-option ${variable === 'salt' ? 'segmented-option-active text-emerald-400 font-bold' : ''}`}
            title="Evaluate Practical Salinity (PSU)"
          >
            SAL (PSU)
          </button>
        </div>

        {/* Methodology Explainer */}
        <button
          onClick={onOpenMethodology}
          className="flex items-center gap-1 px-2 py-1 bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-300 hover:text-white border border-[var(--border-hairline)] rounded-[2px] text-[11px] transition-colors"
          title="View Mathematical Formulas & Spatio-temporal Colocation Methodology"
        >
          <HelpCircle className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.75} />
          <span className="hidden sm:inline">METHODOLOGY</span>
        </button>

        {/* Return to 3D Globe */}
        <button
          onClick={() => setActivePage('home')}
          className="flex items-center gap-1.5 px-3 py-1 bg-sky-500 text-slate-950 hover:bg-sky-400 font-bold rounded-[2px] text-[11px] transition-colors shadow-sm"
          title="Return to 3D Earth Globe & Ocean Explorer"
        >
          <Globe className="w-3.5 h-3.5" strokeWidth={2} />
          <span>3D EXPLORER</span>
        </button>
      </div>
    </header>
  );
};
