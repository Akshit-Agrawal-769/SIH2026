import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Clock,
  Activity,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const BottomBar = () => {
  const {
    timeIndex,
    setTimeIndex,
    stepTimeIndex,
    isPlayingTimeline,
    toggleTimelinePlayback,
    playbackSpeed,
    setPlaybackSpeed,
    metadata,
    variable,
    colormap,
    volumeMeta,
  } = useOceanStore();

  const timeRange = metadata?.time_range || [];
  const maxSteps = Math.max(timeRange.length, 5);

  // Playback timer engine
  useEffect(() => {
    if (!isPlayingTimeline) return;
    const baseInterval = 1400 / playbackSpeed;
    const interval = setInterval(() => {
      stepTimeIndex(1);
    }, baseInterval);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, playbackSpeed, stepTimeIndex]);

  // Actual timestamp from metadata or factual frame index
  const getCurrentDateStr = () => {
    if (timeRange.length > timeIndex && timeRange[timeIndex]) {
      const raw = timeRange[timeIndex];
      const dt = new Date(raw);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      }
      return String(raw).replace('T', ' ').replace('Z', ' UTC');
    }
    return `Frame ${timeIndex + 1} of ${maxSteps} (Model Step)`;
  };

  const getTickLabels = () => {
    if (timeRange.length >= 2) {
      const startStr = timeRange[0].split('T')[0];
      const endStr = timeRange[timeRange.length - 1].split('T')[0];
      return { start: startStr, end: endStr };
    }
    return { start: 'T-00', end: `T-${String(maxSteps - 1).padStart(2, '0')}` };
  };

  const ticks = getTickLabels();

  // Colormap Gradients
  const getColormapGradient = () => {
    switch (colormap) {
      case 'viridis':
        return 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)';
      case 'thermal':
        return 'linear-gradient(to right, #0d2673, #19b2cc, #f2d933, #e6331a)';
      case 'jet':
        return 'linear-gradient(to right, #000080, #00ffff, #ffff00, #ff0000)';
      case 'turbo':
      default:
        return 'linear-gradient(to right, #30123b, #4184f3, #1ae4b6, #a2fc3c, #fb8022, #7a0403)';
    }
  };

  // Variable Units & Value Range
  const getVarDetails = () => {
    const minVal = volumeMeta?.minVal !== undefined ? volumeMeta.minVal.toFixed(1) : (variable === 'temp' ? '2.0' : (variable === 'salt' ? '32.0' : '-1.5'));
    const maxVal = volumeMeta?.maxVal !== undefined ? volumeMeta.maxVal.toFixed(1) : (variable === 'temp' ? '30.0' : (variable === 'salt' ? '37.0' : '+1.5'));
    const units = volumeMeta?.units || (variable === 'temp' ? '°C' : (variable === 'salt' ? 'PSU' : 'm/s'));
    const varName = variable === 'temp' ? 'TEMP' : (variable === 'salt' ? 'SALINITY' : (variable === 'u' ? 'U-CURRENT' : 'V-CURRENT'));
    return { minVal, maxVal, units, varName };
  };

  const { minVal, maxVal, units, varName } = getVarDetails();

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94vw] max-w-4xl bg-[var(--surface-rack-backdrop)] backdrop-blur-md border border-[var(--border-hairline)] rounded-sm px-3 py-1.5 flex items-center justify-between gap-4 text-slate-200 select-none shadow-2xl font-mono text-xs">
      
      {/* 1. PLAYBACK CONTROLS */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => stepTimeIndex(-1)}
          className="p-1 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-400 hover:text-white border border-[var(--border-hairline)] transition-colors"
          title="Previous Time Step (◀)"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        <button
          onClick={toggleTimelinePlayback}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[2px] border text-[11px] font-bold transition-all ${
            isPlayingTimeline
              ? 'bg-sky-950/80 border-sky-400 text-sky-300 shadow-sm'
              : 'bg-[var(--surface-well)] border-[var(--border-hairline)] text-slate-200 hover:text-white'
          }`}
          title={isPlayingTimeline ? 'Pause Animation (Space)' : 'Play Timeline Animation (Space)'}
        >
          {isPlayingTimeline ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isPlayingTimeline ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <button
          onClick={() => stepTimeIndex(1)}
          className="p-1 rounded-[2px] bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] text-slate-400 hover:text-white border border-[var(--border-hairline)] transition-colors"
          title="Next Time Step (▶)"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        {/* Speed Multipliers */}
        <div className="hidden sm:flex items-center gap-0.5 bg-[var(--surface-base)] p-0.5 border border-[var(--border-hairline)] rounded-[2px] text-[10px] ml-1">
          {[1.0, 2.0].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-1.5 py-0.2 rounded-[1px] transition-all ${
                playbackSpeed === spd
                  ? 'bg-[var(--surface-well)] text-sky-300 font-bold border border-[var(--border-medium)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* 2. TIMELINE SCRUBBER */}
      <div className="flex-1 flex flex-col justify-center px-2 min-w-0">
        <div className="flex justify-between items-center text-[9px] text-slate-500 mb-0.5">
          <span className="tabular-nums">{ticks.start}</span>
          <span className="text-slate-100 font-bold text-[10px] tracking-wide truncate px-1">
            {getCurrentDateStr()}
          </span>
          <span className="tabular-nums">{ticks.end}</span>
        </div>
        <input
          type="range"
          min="0"
          max={maxSteps - 1}
          step="1"
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 3. SCALAR COLORBAR LEGEND */}
      <div className="hidden md:flex items-center gap-2 shrink-0 border-l border-[var(--border-hairline)] pl-3">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">
            {varName}
          </span>
          <span className="text-[8px] text-slate-500">[{units}]</span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <div
            className="w-24 lg:w-32 h-2.5 rounded-[1px] border border-[var(--border-hairline)] shadow-inner"
            style={{ background: getColormapGradient() }}
          />
          <div className="w-full flex justify-between text-[8px] text-slate-400 tabular-nums">
            <span>{minVal}</span>
            <span>{maxVal}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
