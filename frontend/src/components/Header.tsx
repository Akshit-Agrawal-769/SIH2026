import React from 'react';
import { Waves, Compass, ShieldCheck } from './Icons';
import { useOceanStore } from '../store/oceanStore';

export const Header: React.FC = () => {
  const health = useOceanStore((state) => state.health);
  const metadata = useOceanStore((state) => state.metadata);

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-500/20 border border-sky-500/40 rounded-lg text-sky-400">
          <Waves className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-sky-400 to-teal-300 bg-clip-text text-transparent">
              INCOIS 3D Ocean Data System
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-sky-950 border border-sky-600/50 text-sky-300 rounded-full">
              PS 26067
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Indian Ocean 3D Numerical Models & Real Argo Observation Co-Display
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {metadata && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800/60 border border-slate-700/60 rounded-md text-xs text-slate-300">
            <Compass className="w-3.5 h-3.5 text-teal-400" />
            <span>Domain: <strong>Arabian Sea & Bay of Bengal</strong> (58°E–96°E, 4°N–26°N)</span>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-full text-xs">
          <ShieldCheck className={`w-4 h-4 ${health?.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="font-semibold">{health?.data_policy || 'STRICT NO MOCK DATA'}</span>
          <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
        </div>
      </div>
    </header>
  );
};
