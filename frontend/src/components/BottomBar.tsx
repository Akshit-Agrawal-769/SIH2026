import React, { useEffect, useState } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import { fetchOceanTile } from '../api/client';
import { Play, Pause, FastForward, Rewind, Layers, ChevronUp, ChevronDown } from 'lucide-react';

const DEPTH_LEVELS = [
  0.5, 10.0, 50.0, 100.0, 500.0, 1000.0
];

const TIMESTEPS = [
  '2024-06-01',
  '2024-06-02',
  '2024-06-03',
  '2024-06-04',
  '2024-06-05'
];

const HOUR_MARKERS = [
  '00:00',
  '06:00',
  '12:00',
  '18:00',
  '24:00'
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

  const [showDepthMenu, setShowDepthMenu] = useState(false);

  // 1. Animation playback loop
  useEffect(() => {
    if (!isPlaying) return;

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
  const progressPct = currentDayIndex >= 0 ? (currentDayIndex / (TIMESTEPS.length - 1)) * 100 : 0;

  const formatDateDisplay = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[parseInt(parts[1], 10) - 1] || 'Jun';
        return `${month} ${parts[2]}, ${parts[0]} 12:00 UTC`;
      }
    } catch {
      // fallback
    }
    return `${dateStr} 12:00 UTC`;
  };

  return (
    <footer className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-4xl glass-panel rounded-2xl px-5 py-3 shadow-2xl flex items-center justify-between gap-6 select-none transition-all">
      {/* Left Group: Play Button & Timestamp Readout */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Play/Pause Circular Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
            isPlaying
              ? 'bg-emerald-500 text-slate-950 glow-green'
              : 'glass-pill text-white hover:bg-white/10 hover:border-white/20'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Step Backward */}
        <button
          onClick={handlePrevStep}
          title="Previous Timestep"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
        >
          <Rewind className="w-3.5 h-3.5" />
        </button>

        {/* Timestamp Readout */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white tracking-tight font-mono whitespace-nowrap">
            {formatDateDisplay(currentTime)}
          </span>
          <span className="text-[9px] font-mono text-emerald-400 leading-none">
            {isPlaying ? 'ANIMATING • REAL-TIME' : 'OPERATIONAL ANALYSIS'}
          </span>
        </div>

        {/* Step Forward */}
        <button
          onClick={handleNextStep}
          title="Next Timestep"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
        >
          <FastForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Timeline Scrubber with Hour Markers (from reference image) */}
      <div className="flex flex-col gap-1.5 flex-1 max-w-lg min-w-0">
        <div className="relative flex items-center w-full">
          {/* Track background */}
          <div className="w-full h-1.5 rounded-full bg-white/10 relative overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full glow-green transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Draggable Scrubber input overlay */}
          <input
            type="range"
            min="0"
            max={TIMESTEPS.length - 1}
            step="1"
            value={currentDayIndex !== -1 ? currentDayIndex : 0}
            onChange={(e) => setCurrentTime(TIMESTEPS[parseInt(e.target.value, 10)])}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10"
          />

          {/* Interactive Thumb Dot */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0b0f17] glow-green pointer-events-none shadow-md -translate-x-1/2 transition-all duration-200"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        {/* Hour Markers (00:00, 06:00, 12:00, 18:00, 24:00) */}
        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5">
          {HOUR_MARKERS.map((hour, idx) => (
            <span
              key={hour}
              className={`transition-colors ${
                idx === 2 ? 'text-emerald-400 font-bold' : 'hover:text-slate-200'
              }`}
            >
              {hour}
            </span>
          ))}
        </div>
      </div>

      {/* Right Group: Playback Speed & Depth Slice Selector */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Playback speed toggle (1x, 2x, 4x) */}
        <button
          onClick={handleCycleSpeed}
          title="Change Playback Speed"
          className="px-2.5 py-1 rounded-lg glass-pill text-[11px] font-mono text-emerald-400 hover:text-white transition shadow-sm"
        >
          {playbackSpeed}x
        </button>

        {/* Depth Slice Pill */}
        <div className="relative">
          <button
            onClick={() => setShowDepthMenu(!showDepthMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-pill text-xs text-slate-200 hover:text-white transition shadow-sm"
            title="Select Ocean Depth Slice"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-xs font-semibold text-emerald-300">
              {depthLevel === 0.5 ? '0m' : `${depthLevel}m`}
            </span>
            {showDepthMenu ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronUp className="w-3 h-3 text-slate-400" />}
          </button>

          {/* Depth Dropdown Menu */}
          {showDepthMenu && (
            <div className="absolute right-0 bottom-full mb-2 w-36 glass-panel rounded-2xl p-1.5 shadow-2xl z-30 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[9px] font-mono uppercase text-slate-400">
                Depth Layer
              </div>
              {DEPTH_LEVELS.map((depth) => (
                <button
                  key={depth}
                  onClick={() => {
                    setDepthLevel(depth);
                    setShowDepthMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl font-mono text-xs transition ${
                    depthLevel === depth
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {depth === 0.5 ? 'Surface (0m)' : `${depth}m`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

