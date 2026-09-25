import React, { useEffect, useMemo, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore } from '../store/useOceanStore';
import {
  adjacentTime,
  fromUtcInput,
  nearestTime,
  playbackIntervalMs,
  StepUnit,
  stepForward,
  timesInRange,
  toMs,
  toUtcInput
} from '../timeline/timelineEngine';

const STEP_OPTIONS: { label: string; value: number; unit: StepUnit }[] = [
  { label: '6 hours', value: 6, unit: 'hours' },
  { label: '1 day', value: 1, unit: 'days' },
  { label: '1 week', value: 1, unit: 'weeks' },
  { label: '1 month', value: 1, unit: 'months' },
  { label: '2 months', value: 2, unit: 'months' },
  { label: '3 months', value: 3, unit: 'months' }
];

const SPEED_OPTIONS = [0.5, 1, 2, 4];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const Timeline: React.FC = () => {
  const {
    timelineStart, timelineEnd, timelineStep, selectedTime, availableTimes, lastRequestedTime,
    isPlaying, playbackSpeed, selectedVariable, catalog,
    setTimelineStart, setTimelineEnd, setTimelineStep, setSelectedTime, setIsPlaying, setPlaybackSpeed
  } = useOceanStore(useShallow((s) => ({
    timelineStart: s.timelineStart, timelineEnd: s.timelineEnd, timelineStep: s.timelineStep,
    selectedTime: s.selectedTime, availableTimes: s.availableTimes, lastRequestedTime: s.lastRequestedTime,
    isPlaying: s.isPlaying, playbackSpeed: s.playbackSpeed, selectedVariable: s.selectedVariable, catalog: s.catalog,
    setTimelineStart: s.setTimelineStart, setTimelineEnd: s.setTimelineEnd, setTimelineStep: s.setTimelineStep,
    setSelectedTime: s.setSelectedTime, setIsPlaying: s.setIsPlaying, setPlaybackSpeed: s.setPlaybackSpeed
  })));

  const trackTimes = useMemo(
    () => (timelineStart && timelineEnd ? timesInRange(availableTimes, timelineStart, timelineEnd) : []),
    [availableTimes, timelineStart, timelineEnd]
  );

  // Keep the selection inside the custom range (always a real timestep).
  useEffect(() => {
    if (trackTimes.length && !trackTimes.includes(selectedTime)) {
      setSelectedTime(trackTimes[0]);
    }
  }, [trackTimes, selectedTime, setSelectedTime]);

  // Playback: every tick advances by the time step, resolved to a real timestamp.
  const cursorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPlaying) {
      cursorRef.current = null;
      return;
    }
    const tick = () => {
      const s = useOceanStore.getState();
      const from = cursorRef.current ?? s.selectedTime;
      const r = stepForward(s.availableTimes, from, s.timelineStep, s.timelineEnd);
      if (!r.resolved) {
        s.setIsPlaying(false);
        return;
      }
      cursorRef.current = r.resolved;
      s.setSelectedTime(r.resolved, r.exact ? null : r.requested);
    };
    const id = window.setInterval(tick, playbackIntervalMs(playbackSpeed));
    return () => window.clearInterval(id);
  }, [isPlaying, playbackSpeed]);

  const go = (direction: 1 | -1) => {
    const t = adjacentTime(trackTimes, selectedTime, direction);
    if (t) setSelectedTime(t);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Handled on the timeline element only, so globe/Cesium keyboard handling is unaffected.
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === 'Home' && trackTimes.length) { e.preventDefault(); setSelectedTime(trackTimes[0]); }
    else if (e.key === 'End' && trackTimes.length) { e.preventDefault(); setSelectedTime(trackTimes[trackTimes.length - 1]); }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackTimes.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const s = toMs(timelineStart);
    const t = nearestTime(trackTimes, s + ratio * (toMs(timelineEnd) - s));
    if (t) setSelectedTime(t);
  };

  if (!catalog) return null;
  if (!availableTimes.length) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-xl px-4 py-2 text-xs text-ocean-muted">
        No timesteps available for {selectedVariable}.
      </div>
    );
  }

  const source = catalog.sources[catalog.variables[selectedVariable]?.source_id ?? '']?.title ?? '';
  const index = trackTimes.indexOf(selectedTime);
  const span = Math.max(1, toMs(timelineEnd) - toMs(timelineStart));
  const minInput = toUtcInput(availableTimes[0]);
  const maxInput = toUtcInput(availableTimes[availableTimes.length - 1]);

  return (
    <section
      aria-label="Dataset timeline"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[760px] max-w-[95vw] glass-panel rounded-xl px-4 py-3 flex flex-col gap-3 text-ocean-text select-none"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 text-xs">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-ocean-muted font-semibold tracking-wider uppercase">Start (UTC)</span>
            <input
              type="datetime-local"
              value={toUtcInput(timelineStart)}
              min={minInput}
              max={toUtcInput(timelineEnd)}
              onChange={(e) => {
                const v = fromUtcInput(e.target.value);
                if (v && toMs(v) <= toMs(timelineEnd)) setTimelineStart(v);
              }}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-ocean-text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-ocean-muted font-semibold tracking-wider uppercase">End (UTC)</span>
            <input
              type="datetime-local"
              value={toUtcInput(timelineEnd)}
              min={toUtcInput(timelineStart)}
              max={maxInput}
              onChange={(e) => {
                const v = fromUtcInput(e.target.value);
                if (v && toMs(v) >= toMs(timelineStart)) setTimelineEnd(v);
              }}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-ocean-text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
            />
          </label>
        </div>

        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] text-ocean-muted font-semibold tracking-wider uppercase">Time step</span>
            <select
              value={`${timelineStep.value}|${timelineStep.unit}`}
              onChange={(e) => {
                const [v, u] = e.target.value.split('|');
                setTimelineStep({ value: Number(v), unit: u as StepUnit });
              }}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-ocean-text-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
            >
              {STEP_OPTIONS.map((o) => (
                <option key={o.label} value={`${o.value}|${o.unit}`} className="bg-ocean-solid">{o.label}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-ocean-muted font-semibold tracking-wider uppercase">Playback speed</span>
            <div role="radiogroup" aria-label="Playback speed" className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded p-0.5">
              {SPEED_OPTIONS.map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={playbackSpeed === v}
                  onClick={() => setPlaybackSpeed(v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent ${
                    playbackSpeed === v ? 'bg-ocean-accent/25 text-ocean-accent' : 'text-ocean-muted hover:text-white'
                  }`}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative pt-1">
        <div className="flex justify-between text-[10px] text-ocean-muted font-mono mb-2">
          <span>{fmtDate(timelineStart)}</span>
          <span>{trackTimes.length} real timesteps in range</span>
          <span>{fmtDate(timelineEnd)}</span>
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Select dataset timestep"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, trackTimes.length - 1)}
          aria-valuenow={Math.max(0, index)}
          aria-valuetext={selectedTime ? fmtDate(selectedTime) : 'none'}
          onKeyDown={onKeyDown}
          onClick={handleScrub}
          onMouseMove={(e) => { if (e.buttons === 1) handleScrub(e); }}
          className="relative h-1.5 w-full bg-white/10 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-accent"
        >
          {trackTimes.map((t) => {
            const ratio = (toMs(t) - toMs(timelineStart)) / span;
            const isSelected = t === selectedTime;
            return (
              <span
                key={t}
                title={fmtDate(t)}
                className={`absolute top-1/2 rounded-full ${isSelected ? 'w-3 h-3 bg-ocean-accent z-10' : 'w-1.5 h-1.5 bg-neutral-400'}`}
                style={{ left: `${ratio * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            disabled={index <= 0}
            aria-label="Previous timestep"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={trackTimes.length < 2}
            aria-label={isPlaying ? 'Pause playback' : 'Play through timesteps'}
            aria-pressed={isPlaying}
            className="p-2 rounded-full bg-ocean-accent/20 hover:bg-ocean-accent/30 text-ocean-accent border border-ocean-accent/30 disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => go(1)}
            disabled={index === -1 || index >= trackTimes.length - 1}
            aria-label="Next timestep"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-end text-right min-w-0" aria-live="polite">
          <span className="text-ocean-accent font-semibold text-sm flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {fmtDate(selectedTime)} <span className="text-[10px] font-mono text-ocean-muted">{selectedTime.slice(11, 16)} UTC</span>
          </span>
          <span className="text-[9px] font-mono text-ocean-muted truncate max-w-[420px]" title={source}>
            {lastRequestedTime
              ? `Requested ${fmtDate(lastRequestedTime)} has no data — showing next real timestep`
              : `${selectedVariable} · ${source}`}
          </span>
        </div>
      </div>
    </section>
  );
};
