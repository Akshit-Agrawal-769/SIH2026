import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  StepBack,
  StepForward
} from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const TimelinePanel = () => {
  const {
    timeIndex,
    setTimeIndex,
    stepTimeIndex,
    isPlayingTimeline,
    toggleTimelinePlayback,
    playbackSpeed,
    setPlaybackSpeed,
    metadata,
  } = useOceanStore();

  const timeRange = metadata?.time_range || [];
  const maxSteps = Math.max(timeRange.length, 5);

  useEffect(() => {
    if (!isPlayingTimeline) return;
    const baseInterval = 1500 / playbackSpeed;
    const interval = setInterval(() => {
      stepTimeIndex(1);
    }, baseInterval);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, playbackSpeed, stepTimeIndex]);

  const getCurrentTimeLabel = () => {
    if (timeRange.length > timeIndex) {
      return timeRange[timeIndex];
    }
    return `Forecast T+${timeIndex * 24}h`;
  };

  return (
    <footer className="relative z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 px-3 py-1.5 bg-[#070c18] border-t border-[#1e293b] text-slate-200 text-xs select-none min-h-[44px]">

      {/* Left Playback Controls & Timestamp Readout */}
      <div className="flex items-center gap-2.5 shrink-0 font-mono">
        <div className="flex items-center gap-1">
          <button
            onClick={() => stepTimeIndex(-1)}
            title="Previous Forecast Timestep"
            className="p-1 bg-[#0c1424] border border-[#1e293b] text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <StepBack className="w-3 h-3" />
          </button>

          <button
            onClick={toggleTimelinePlayback}
            title={isPlayingTimeline ? 'Pause Forecast Animation' : 'Play Forecast Animation'}
            className={`flex items-center gap-1 px-2.5 py-1 border text-xs font-bold transition-all ${
              isPlayingTimeline
                ? 'bg-[#291b05] border-amber-500 text-amber-300'
                : 'bg-[#0a1e38] border-sky-500 text-sky-300 hover:bg-[#102d55]'
            }`}
          >
            {isPlayingTimeline ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPlayingTimeline ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => stepTimeIndex(1)}
            title="Next Forecast Timestep"
            className="p-1 bg-[#0c1424] border border-[#1e293b] text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <StepForward className="w-3 h-3" />
          </button>
        </div>

        {/* Timestamp Readout */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0c1424] border border-[#1e293b]">
          <span className="text-xs font-bold text-slate-100">
            {getCurrentTimeLabel()}
          </span>
          <span className="text-[10px] text-teal-300 px-1 py-0.2 bg-[#070c18]">
            Step {timeIndex + 1}/{maxSteps}
          </span>
        </div>
      </div>

      {/* Middle Scrubber Timeline */}
      <div className="flex-1 flex flex-col justify-center gap-0.5 max-w-2xl px-2">
        <input
          type="range"
          min="0"
          max={maxSteps - 1}
          step="1"
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>T+00h</span>
          {Array.from({ length: maxSteps }).map((_, idx) => (
            <span
              key={idx}
              className={`cursor-pointer hover:text-sky-300 transition-colors ${
                idx === timeIndex ? 'text-sky-400 font-bold' : ''
              }`}
              onClick={() => setTimeIndex(idx)}
            >
              T+{idx * 24}h
            </span>
          ))}
        </div>
      </div>

      {/* Right Playback Speed Selector */}
      <div className="flex items-center gap-1 shrink-0 justify-end font-mono">
        <span className="text-[10px] text-slate-500 uppercase">Speed:</span>
        {[0.5, 1.0, 2.0].map((speed) => (
          <button
            key={speed}
            onClick={() => setPlaybackSpeed(speed)}
            className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
              playbackSpeed === speed
                ? 'bg-[#10243e] border-sky-500 text-sky-300 font-bold'
                : 'bg-[#0c1424] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

    </footer>
  );
};
