import React, { useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const baseInterval = 1600 / playbackSpeed;
    const interval = setInterval(() => {
      stepTimeIndex(1);
    }, baseInterval);
    return () => clearInterval(interval);
  }, [isPlayingTimeline, playbackSpeed, stepTimeIndex]);

  const getCurrentDateStr = () => {
    if (timeRange.length > timeIndex && timeRange[timeIndex]) {
      const dt = new Date(timeRange[timeIndex]);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return timeRange[timeIndex].split('T')[0];
    }
    // Default reference scientific steps
    const sampleDates = ['01 Aug 2026', '07 Aug 2026', '14 Aug 2026', '21 Aug 2026', '27 Aug 2026'];
    return sampleDates[timeIndex % sampleDates.length];
  };

  const getTickLabels = () => {
    if (timeRange.length >= 3) {
      return [
        timeRange[0].split('T')[0],
        timeRange[Math.floor(timeRange.length / 2)].split('T')[0],
        timeRange[timeRange.length - 1].split('T')[0],
      ];
    }
    return ['01 Aug', '14 Aug', '27 Aug'];
  };

  const ticks = getTickLabels();

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[92vw] max-w-xl glass-panel rounded-full px-3.5 py-1.5 flex items-center justify-between gap-3 text-white/90 select-none shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Play / Step Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => stepTimeIndex(-1)}
          className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Previous Time Step (◀)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTimelinePlayback}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-normal transition-all ${
            isPlayingTimeline
              ? 'bg-white/20 text-white shadow-sm'
              : 'bg-white/10 hover:bg-white/15 text-white/90'
          }`}
          title={isPlayingTimeline ? 'Pause Animation' : 'Play Timeline Animation'}
        >
          {isPlayingTimeline ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="text-[11px] font-normal">{isPlayingTimeline ? 'Pause' : 'Animate'}</span>
        </button>

        <button
          onClick={() => stepTimeIndex(1)}
          className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Next Time Step (▶)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scrubber & Milestone Labels */}
      <div className="flex-1 flex flex-col justify-center px-1">
        <div className="flex justify-between items-center text-[9px] font-mono text-white/40 mb-0.5 px-0.5">
          <span>{ticks[0]}</span>
          <span className="text-white/80 font-medium">{getCurrentDateStr()}</span>
          <span>{ticks[2]}</span>
        </div>
        <input
          type="range"
          min="0"
          max={maxSteps - 1}
          step="1"
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          className="w-full cursor-pointer"
        />
      </div>

      {/* Speed Multiplier Pill */}
      <div className="flex items-center gap-0.5 shrink-0 bg-black/30 p-0.5 rounded-full border border-white/[0.04] text-[10px] font-mono">
        {[1.0, 2.0].map((spd) => (
          <button
            key={spd}
            onClick={() => setPlaybackSpeed(spd)}
            className={`px-1.5 py-0.5 rounded-full transition-all ${
              playbackSpeed === spd
                ? 'bg-white/20 text-white font-medium'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {spd}x
          </button>
        ))}
      </div>
    </div>
  );
};
