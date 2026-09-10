import React, { useEffect } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { fetchOceanTile } from '../api/client';
import { TIMESTEPS } from '../config';
import { Play, Pause, FastForward, Rewind, Clock, Layers } from 'lucide-react';

const DEPTH_LEVELS = [
  0.5, 5.0, 15.0, 30.0, 50.0, 75.0, 100.0, 150.0, 200.0, 300.0, 500.0, 800.0, 1000.0, 1500.0, 2000.0
];

export const BottomBar: React.FC = () => {
  const {
    depthLevel,
    setDepthLevel,
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    selectedVariable
  } = useOceanStore();

  // 1. Animation playback loop
  useEffect(() => {
    if (!isPlaying) return;

    // 1x = 1000ms, 2x = 500ms, 4x = 250ms
    const intervalMs = Math.max(200, Math.round(1000 / (playbackSpeed || 1.0)));
    const timer = setInterval(() => {
      const cur = useOceanStore.getState().currentTime;
      const curIdx = TIMESTEPS.indexOf(cur);
      const nextIdx = curIdx >= 0 ? (curIdx + 1) % TIMESTEPS.length : 0;
      setCurrentTime(TIMESTEPS[nextIdx]);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, setCurrentTime]);

  // 2. Predictive background prefetching (t+1, t+2, t+3)
  useEffect(() => {
    const curIdx = TIMESTEPS.indexOf(currentTime);
    if (curIdx === -1) return;

    const offsets = [1, 2, 3];
    for (const offset of offsets) {
      const targetDate = TIMESTEPS[(curIdx + offset) % TIMESTEPS.length];
      fetchOceanTile(selectedVariable, targetDate, depthLevel).catch(() => {
        // Silently tolerate background prefetch failure
      });
    }
  }, [currentTime, selectedVariable, depthLevel]);

  const handlePrevStep = () => {
    const currentIndex = TIMESTEPS.indexOf(currentTime);
    const prevIndex = currentIndex <= 0 ? TIMESTEPS.length - 1 : currentIndex - 1;
    setCurrentTime(TIMESTEPS[prevIndex]);
  };

  const handleNextStep = () => {
    const currentIndex = TIMESTEPS.indexOf(currentTime);
    const nextIndex = (currentIndex + 1) % TIMESTEPS.length;
    setCurrentTime(TIMESTEPS[nextIndex]);
  };

  const handleCycleSpeed = () => {
    if (playbackSpeed === 1.0) setPlaybackSpeed(2.0);
    else if (playbackSpeed === 2.0) setPlaybackSpeed(4.0);
    else setPlaybackSpeed(1.0);
  };

  const currentDayIndex = TIMESTEPS.indexOf(currentTime);
  const displayDayNum = currentDayIndex >= 0 ? currentDayIndex + 1 : 1;

  return (
    <footer className="absolute bottom-4 left-4 right-4 h-16 bg-ocean-panel/90 backdrop-blur-md border border-ocean-border rounded-xl px-4 z-20 shadow-2xl flex items-center justify-between gap-6">
      {/* Depth-Slice Navigation */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium whitespace-nowrap">
          <Layers className="w-4 h-4 text-cyan-400" />
          Depth Slice:
          <span className="font-mono text-ocean-accent ml-1 font-bold">
            {depthLevel === 0.5 ? 'Surface (0m)' : `${depthLevel}m`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={DEPTH_LEVELS.length - 1}
          step="1"
          value={DEPTH_LEVELS.indexOf(depthLevel) !== -1 ? DEPTH_LEVELS.indexOf(depthLevel) : 0}
          onChange={(e) => setDepthLevel(DEPTH_LEVELS[parseInt(e.target.value, 10)])}
          className="w-full accent-ocean-accent cursor-pointer"
        />
      </div>

      {/* Time Navigation & Animation Controls */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        {/* Step Backward */}
        <button
          onClick={handlePrevStep}
          title="Step Backward (Previous Day)"
          className="p-2 rounded-lg bg-ocean-dark border border-ocean-border hover:border-ocean-accent text-slate-300 hover:text-white transition"
        >
          <Rewind className="w-4 h-4" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause Timeline' : 'Play 14-Day Simulation'}
          className={`p-2 rounded-lg font-semibold transition flex items-center justify-center shadow-lg ${
            isPlaying
              ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {/* Step Forward */}
        <button
          onClick={handleNextStep}
          title="Step Forward (Next Day)"
          className="p-2 rounded-lg bg-ocean-dark border border-ocean-border hover:border-ocean-accent text-slate-300 hover:text-white transition"
        >
          <FastForward className="w-4 h-4" />
        </button>

        {/* Speed toggle button (1x -> 2x -> 4x) */}
        <button
          onClick={handleCycleSpeed}
          title="Toggle Playback Speed (1x, 2x, 4x)"
          className="px-2.5 py-1.5 rounded-lg bg-ocean-dark border border-ocean-border hover:border-cyan-400/50 text-xs font-mono text-cyan-300 hover:text-white transition"
        >
          {playbackSpeed}x
        </button>

        {/* Timestep Scrubber */}
        <div className="flex flex-col gap-1 flex-1 max-w-sm">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
            <span className="flex items-center gap-1 text-cyan-400">
              {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
              {isPlaying ? 'ANIMATING 4D CYCLE' : 'TIMELINE SCRUBBER'}
            </span>
            <span className="text-slate-400">June 01 – June 14, 2024</span>
          </div>
          <input
            type="range"
            min="0"
            max={TIMESTEPS.length - 1}
            step="1"
            value={currentDayIndex !== -1 ? currentDayIndex : 0}
            onChange={(e) => setCurrentTime(TIMESTEPS[parseInt(e.target.value, 10)])}
            className="w-full accent-ocean-accent cursor-pointer h-1.5 bg-slate-700/60 rounded-lg appearance-none"
          />
        </div>

        {/* Time & Day Readout */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
          isPlaying ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'bg-ocean-dark border-ocean-border'
        }`}>
          <Clock className={`w-3.5 h-3.5 ${isPlaying ? 'text-amber-400 animate-spin' : 'text-cyan-400'}`} style={{ animationDuration: '4s' }} />
          <span className="font-mono text-xs font-semibold text-white tracking-wider">
            Day {String(displayDayNum).padStart(2, '0')}/14
          </span>
          <span className="text-slate-500 text-xs">•</span>
          <span className="font-mono text-xs text-cyan-300">
            {currentTime}
          </span>
        </div>
      </div>
    </footer>
  );
};
