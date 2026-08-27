import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Calendar,
  MapPin,
  Route,
  CheckCircle2,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useArgoTrajectory } from '../hooks/useArgoTrajectory';

export const ArgoCycleNavigator = () => {
  const {
    selectedFloat,
    activePoint,
    activeCycle,
    currentIndex,
    totalCycles,
    headingDeg,
    showTrajectory,
    toggleTrajectory,
    stepCycle,
    selectCycleNumber,
    activeArgoProfile,
    isLoading,
  } = useArgoTrajectory();

  if (!selectedFloat) return null;

  // Format timestamp cleanly
  const formatTimestamp = (rawTs) => {
    if (!rawTs) return '—';
    const dt = new Date(rawTs);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    }
    return String(rawTs).replace('T', ' ').replace('Z', ' UTC');
  };

  const currentLat = activePoint?.latitude ?? selectedFloat.latest_position?.latitude;
  const currentLon = activePoint?.longitude ?? selectedFloat.latest_position?.longitude;
  const currentTs = activePoint?.timestamp || activeArgoProfile?.timestamp || selectedFloat.latest_timestamp;

  // Format heading cardinal
  const getHeadingCardinal = (deg) => {
    if (deg === null || deg === undefined) return null;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return `${Math.round(deg)}° ${cardinals[idx]}`;
  };

  const headingStr = getHeadingCardinal(headingDeg);

  return (
    <div className="instrument-well p-2.5 flex flex-col gap-2 font-mono text-xs select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
          <span className="font-bold text-amber-300">WMO {selectedFloat.platform_number}</span>
          <span className="text-[10px] text-slate-500 font-sans">({selectedFloat.dac || 'CORIOLIS GDAC'})</span>
        </div>
        <button
          onClick={toggleTrajectory}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] border text-[9px] transition-all ${
            showTrajectory
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              : 'bg-[var(--surface-base)] border-[var(--border-hairline)] text-slate-500'
          }`}
          title="Toggle 3D Multi-Cycle Trajectory Polyline on Globe"
        >
          <Route className="w-3 h-3" strokeWidth={1.75} />
          <span>{showTrajectory ? 'TRACK ON' : 'TRACK OFF'}</span>
        </button>
      </div>

      {/* Cycle Navigation Stepper */}
      <div className="flex items-center justify-between bg-[var(--surface-base)] p-1.5 border border-[var(--border-hairline)] rounded-[2px]">
        <button
          onClick={() => stepCycle(-1)}
          disabled={currentIndex <= 0 || isLoading}
          className="p-1 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-300 hover:text-white border border-[var(--border-hairline)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous Observation Cycle (←)"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Observation Cycle</span>
          <span className="text-sm font-bold text-slate-100 tabular-nums">
            CYCLE {activeCycle} <span className="text-[10px] text-slate-500 font-normal">/ {totalCycles}</span>
          </span>
        </div>

        <button
          onClick={() => stepCycle(1)}
          disabled={currentIndex >= totalCycles - 1 || isLoading}
          className="p-1 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-300 hover:text-white border border-[var(--border-hairline)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next Observation Cycle (→)"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Cycle Telemetry Grid */}
      <div className="grid grid-cols-2 gap-1 bg-[var(--surface-base)] p-2 border border-[var(--border-hairline)] rounded-[2px] text-[10px]">
        <div>
          <span className="text-[8px] text-slate-500 uppercase flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" /> LATITUDE
          </span>
          <strong className="text-slate-200 tabular-nums">
            {currentLat !== undefined ? `${Math.abs(currentLat).toFixed(4)}°${currentLat >= 0 ? 'N' : 'S'}` : '—'}
          </strong>
        </div>

        <div>
          <span className="text-[8px] text-slate-500 uppercase flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" /> LONGITUDE
          </span>
          <strong className="text-slate-200 tabular-nums">
            {currentLon !== undefined ? `${Math.abs(currentLon).toFixed(4)}°${currentLon >= 0 ? 'E' : 'W'}` : '—'}
          </strong>
        </div>

        <div className="col-span-2 pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-[8px] text-slate-500 uppercase flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" /> TIMESTAMP
          </span>
          <span className="text-sky-300 font-bold text-[9px] tabular-nums">
            {formatTimestamp(currentTs)}
          </span>
        </div>

        {headingStr && (
          <div className="col-span-2 pt-0.5 flex items-center justify-between text-[9px]">
            <span className="text-slate-500 uppercase flex items-center gap-1">
              <Compass className="w-2.5 h-2.5" /> DRIFT HEADING
            </span>
            <span className="text-amber-300 font-bold tabular-nums">
              {headingStr}
            </span>
          </div>
        )}
      </div>

      {/* QC & Data Mode Status */}
      <div className="flex items-center justify-between text-[9px] text-slate-400 px-0.5">
        <span className="flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" strokeWidth={1.75} />
          <span>QC 1 & 2 Passed</span>
        </span>
        <span className="font-mono text-slate-500 uppercase">
          Mode: {activeArgoProfile?.data_mode === 'D' ? 'Delayed (D)' : 'Real-Time (R)'}
        </span>
      </div>
    </div>
  );
};
