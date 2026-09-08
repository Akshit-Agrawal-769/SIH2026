import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  ChevronDown,
  SkipBack,
  SkipForward,
  Clock,
  FastForward,
} from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const OceanTimeline = () => {
  const {
    timeIndex,
    setTimeIndex,
    stepTimeIndex,
    isPlayingTimeline,
    toggleTimelinePlayback,
    playbackSpeed,
    metadata,
  } = useOceanStore();

  const [stepUnit, setStepUnit] = useState('1 day');
  const [isStepDropdownOpen, setIsStepDropdownOpen] = useState(false);

  const timeRange = metadata?.time_range || [];
  const maxSteps = Math.max(timeRange.length, 12);

  // Auto-play animation loop
  useEffect(() => {
    if (!isPlayingTimeline) return;
    const interval = setInterval(() => {
      stepTimeIndex(1);
    }, 1500 / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, playbackSpeed, stepTimeIndex]);

  const getCurrentDate = () => {
    if (timeRange.length > timeIndex && timeRange[timeIndex]) {
      return timeRange[timeIndex].split('T')[0];
    }
    const baseDate = new Date(2023, 7, 15);
    baseDate.setDate(baseDate.getDate() + (timeIndex * 5));
    return baseDate.toISOString().split('T')[0];
  };

  const getStartDate = () => {
    if (timeRange.length > 0 && timeRange[0]) {
      return timeRange[0].split('T')[0];
    }
    return '2023-01-01';
  };

  const getEndDate = () => {
    if (timeRange.length > 0 && timeRange[timeRange.length - 1]) {
      return timeRange[timeRange.length - 1].split('T')[0];
    }
    return '2023-12-31';
  };

  const cycleSpeed = () => {
    const speeds = [1, 2, 4];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    useOceanStore.setState({ playbackSpeed: nextSpeed });
  };

  return (
    <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-30 flex items-center mission-panel rounded-2xl px-4 py-2.5 gap-4 text-white select-none w-[92%] max-w-[640px] panel-transition animate-fade-slide shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_25px_rgba(6,182,212,0.15)]">
      {/* ─── Playback Transport Controls ─── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Step Backwards */}
        <button
          onClick={() => stepTimeIndex(-1)}
          className="p-1.5 rounded-lg bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-white border border-white/[0.08] hover:border-cyan-400/50 transition-all"
          title="Previous Timestep (Hotkey: [)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Play/Pause Round Button */}
        <button
          onClick={toggleTimelinePlayback}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md shrink-0 group border ${
            isPlayingTimeline
              ? 'bg-cyan-500/30 text-white border-cyan-400 shadow-[0_0_15px_#00f2fe]'
              : 'bg-black/50 hover:bg-cyan-500/25 border-cyan-400/40 text-cyan-200'
          }`}
          title={isPlayingTimeline ? 'Pause 4D Forecast (Space)' : 'Play 4D Forecast (Space)'}
        >
          {isPlayingTimeline ? (
            <Pause className="w-4 h-4 fill-current text-cyan-300" />
          ) : (
            <Play className="w-4 h-4 ml-0.5 fill-current text-cyan-300" />
          )}
        </button>

        {/* Step Forward */}
        <button
          onClick={() => stepTimeIndex(1)}
          className="p-1.5 rounded-lg bg-black/40 hover:bg-cyan-500/20 text-slate-300 hover:text-white border border-white/[0.08] hover:border-cyan-400/50 transition-all"
          title="Next Timestep (Hotkey: ])"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ─── Center Temporal Scrubber Area (Hierarchy #3 Current Data/Time) ─── */}
      <div className="flex-1 flex flex-col items-center">
        {/* Date & Timestep Counter Header */}
        <div className="flex items-center justify-between w-full mb-1">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-sm font-mono font-bold text-cyan-200 tracking-wider glow-text-cyan tabular-nums">
              {getCurrentDate()}
            </span>
            <span className="text-[9px] font-mono text-cyan-400/80 px-1 rounded bg-cyan-950/40 border border-cyan-500/30">
              4D FORECAST
            </span>
          </div>

          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold tabular-nums">
            STEP {String((timeIndex % maxSteps) + 1).padStart(2, '0')} / {String(maxSteps).padStart(2, '0')}
          </span>
        </div>

        {/* Scrubber Track with Discrete Step Ticks */}
        <div className="relative w-full flex flex-col justify-center py-1">
          <input
            type="range"
            min="0"
            max={maxSteps - 1}
            value={timeIndex % maxSteps}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800/90 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all z-10"
          />
          {/* Subtle Discrete Tick Markers */}
          <div className="flex justify-between items-center px-1 mt-1 pointer-events-none">
            {Array.from({ length: maxSteps }).map((_, idx) => (
              <span
                key={idx}
                className={`w-1 rounded-full transition-all ${
                  idx === (timeIndex % maxSteps)
                    ? 'h-2 bg-cyan-400 shadow-[0_0_6px_#00f2fe]'
                    : idx < (timeIndex % maxSteps)
                    ? 'h-1.5 bg-cyan-600/50'
                    : 'h-1 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Boundary Dates & Synoptic Resolution */}
        <div className="w-full flex justify-between items-center text-[9px] font-mono text-slate-400 mt-0.5">
          <span>{getStartDate()}</span>
          <span className="text-cyan-400/70 font-mono">Δt: {stepUnit.toUpperCase()} SYNOPTIC</span>
          <span>{getEndDate()}</span>
        </div>
      </div>

      {/* ─── Right Utilities: Speed & Step Unit Dropdown ─── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Speed Toggle */}
        <button
          onClick={cycleSpeed}
          className="px-2 py-1 rounded-lg bg-black/40 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/50 text-[10px] font-mono font-semibold text-cyan-300 hover:text-white transition-all shadow-inner"
          title="Cycle Playback Speed"
        >
          {playbackSpeed}x
        </button>

        {/* Step Unit Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsStepDropdownOpen(!isStepDropdownOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/50 text-[11px] font-mono text-slate-300 hover:text-white transition-all"
          >
            <span>{stepUnit}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isStepDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-28 bg-[#071124]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl py-1 text-xs text-slate-300 z-50">
              {['6 hours', '12 hours', '1 day', '7 days'].map((unit) => (
                <button
                  key={unit}
                  onClick={() => {
                    setStepUnit(unit);
                    setIsStepDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-cyan-500/20 hover:text-white transition-colors text-[11px] font-mono ${
                    stepUnit === unit ? 'text-cyan-300 font-semibold bg-cyan-500/15' : ''
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
