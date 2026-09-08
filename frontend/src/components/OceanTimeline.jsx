import React, { useEffect, useState } from 'react';
import { Play, Pause, ChevronDown } from 'lucide-react';
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

  // Auto-play animation
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
    // Formatted ISO date for reference timeline
    const baseDate = new Date(2023, 7, 15); // 2023-08-15
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

  const progressPct = ((timeIndex) / (maxSteps - 1)) * 100;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center bg-[rgba(6,12,24,0.85)] backdrop-blur-xl border border-sky-500/20 shadow-2xl rounded-2xl px-4 py-2.5 gap-4 text-white select-none w-[560px]">
      {/* Play/Pause Round Button */}
      <button
        onClick={toggleTimelinePlayback}
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-sky-500/25 border border-sky-400/30 text-white flex items-center justify-center transition-all shadow-md shrink-0 group"
        title={isPlayingTimeline ? 'Pause Animation (Space)' : 'Play Animation (Space)'}
      >
        {isPlayingTimeline ? (
          <Pause className="w-4 h-4 text-sky-300 group-hover:text-white" />
        ) : (
          <Play className="w-4 h-4 ml-0.5 text-sky-300 group-hover:text-white" />
        )}
      </button>

      {/* Center Slider Area */}
      <div className="flex-1 flex flex-col items-center">
        {/* Current Date Display */}
        <span className="text-xs font-mono font-semibold text-sky-200 tracking-wider mb-1">
          {getCurrentDate()}
        </span>

        {/* Scrubber Track */}
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min="0"
            max={maxSteps - 1}
            value={timeIndex % maxSteps}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 hover:accent-sky-300 transition-all z-10"
          />
        </div>

        {/* Start / End Boundary Dates */}
        <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-400 mt-1">
          <span>{getStartDate()}</span>
          <span>{getEndDate()}</span>
        </div>
      </div>

      {/* Step Pill Dropdown */}
      <div className="relative shrink-0">
        <button
          onClick={() => setIsStepDropdownOpen(!isStepDropdownOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/40 text-xs font-mono text-slate-300 hover:text-white transition-all"
        >
          <span>{stepUnit}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {isStepDropdownOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-28 bg-[#0a1526] border border-sky-500/30 rounded-xl shadow-2xl py-1 text-xs text-slate-300 z-50">
            {['6 hours', '12 hours', '1 day', '7 days'].map((unit) => (
              <button
                key={unit}
                onClick={() => {
                  setStepUnit(unit);
                  setIsStepDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-sky-500/20 hover:text-white transition-colors ${
                  stepUnit === unit ? 'text-sky-300 font-medium' : ''
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
