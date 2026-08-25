import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  StepBack,
  StepForward,
  Activity
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
    return `Forecast Timestep T+${timeIndex * 24}h`;
  };

  return (
    <footer className="relative z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 px-4 py-2 bg-slate-950/95 border-t border-slate-800 text-slate-200 text-xs select-none shadow-xl min-h-[50px]">

      {/* Left Playback Controls & Timestamp Readout */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => stepTimeIndex(-1)}
            title="Previous Timestep"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <StepBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleTimelinePlayback}
            title={isPlayingTimeline ? 'Pause Forecast Animation' : 'Play Forecast Animation'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition-all shadow-sm ${
              isPlayingTimeline
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-sky-500/20 border-sky-500/60 text-sky-300 hover:bg-sky-500/30'
            }`}
          >
            {isPlayingTimeline ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlayingTimeline ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => stepTimeIndex(1)}
            title="Next Timestep"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 transition-colors"
          >
            <StepForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timestamp Readout */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
          <Activity className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-mono text-xs font-bold text-slate-100">
            {getCurrentTimeLabel()}
          </span>
          <span className="font-mono text-[10px] text-teal-300 px-1.5 py-0.2 bg-slate-800 rounded">
            Step {timeIndex + 1}/{maxSteps}
          </span>
        </div>
      </div>

      {/* Middle Scrubber Timeline */}
      <div className="flex-1 flex flex-col justify-center gap-1 max-w-2xl px-2">
        <input
          type="range"
          min="0"
          max={maxSteps - 1}
          step="1"
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          className="w-full cursor-pointer accent-sky-400 h-1.5 bg-slate-800 rounded-lg"
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
      <div className="flex items-center gap-1.5 shrink-0 justify-end">
        <span className="text-[10px] text-slate-500 uppercase font-mono">Speed:</span>
        {[0.5, 1.0, 2.0].map((speed) => (
          <button
            key={speed}
            onClick={() => setPlaybackSpeed(speed)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              playbackSpeed === speed
                ? 'bg-slate-800 border-sky-500 text-sky-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

    </footer>
  );
};
