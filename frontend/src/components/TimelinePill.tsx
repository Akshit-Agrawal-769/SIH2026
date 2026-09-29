import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CalendarClock, ChevronUp } from 'lucide-react';
import { useOceanStore } from '../store/useOceanStore';

/**
 * Collapsed timeline: shows the date every layer is currently using and reopens the full
 * timeline. Rendered in place of <Timeline /> while it is hidden (the default).
 */
export const TimelinePill: React.FC = () => {
  const { selectedTime, toggleTimeline } = useOceanStore(useShallow((s) => ({
    selectedTime: s.selectedTime,
    toggleTimeline: s.toggleTimeline
  })));

  const d = selectedTime ? new Date(selectedTime) : null;
  const label = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'No date';

  return (
    <button
      onClick={toggleTimeline}
      aria-label={`Show timeline (current date ${label})`}
      title="Show timeline"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full pl-3 pr-2.5 py-1.5 flex items-center gap-2 text-xs text-ocean-text shadow-lg hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent"
    >
      <CalendarClock className="w-3.5 h-3.5 text-ocean-accent" />
      <span className="font-mono tabular-nums">{label}</span>
      <span className="text-[10px] text-ocean-muted">UTC</span>
      <ChevronUp className="w-3.5 h-3.5 text-ocean-muted" />
    </button>
  );
};
