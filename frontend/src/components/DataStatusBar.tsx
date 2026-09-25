import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore } from '../store/useOceanStore';

/** Explicit, non-blocking status for data layers (no data / loading / errors). */
export const DataStatusBar: React.FC = () => {
  const { catalogError, layerStatus, catalog } = useOceanStore(
    useShallow((s) => ({ catalogError: s.catalogError, layerStatus: s.layerStatus, catalog: s.catalog }))
  );
  const items: { key: string; tone: 'warn' | 'info'; text: string; busy?: boolean }[] = [];
  if (catalogError) items.push({ key: 'catalog', tone: 'warn', text: catalogError });
  else if (!catalog) items.push({ key: 'catalog', tone: 'info', text: 'Loading data catalog…', busy: true });
  for (const [key, st] of Object.entries(layerStatus)) {
    if ((st.state === 'nodata' || st.state === 'error') && st.message) {
      items.push({ key, tone: 'warn', text: st.message });
    } else if (st.state === 'loading' && key === 'slice') {
      items.push({ key, tone: 'info', text: 'Loading field…', busy: true });
    }
  }
  if (!items.length) return null;
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none" aria-live="polite">
      {items.map((it) => (
        <div
          key={it.key}
          role="status"
          className={`max-w-[560px] px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2 border backdrop-blur-md ${
            it.tone === 'warn'
              ? 'bg-amber-950/70 border-amber-500/40 text-amber-200'
              : 'bg-neutral-900/80 border-white/10 text-ocean-text-secondary'
          }`}
        >
          {it.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span>{it.text}</span>
        </div>
      ))}
    </div>
  );
};
