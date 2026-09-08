import React from 'react';
import { Menu, X, Compass, Database, Cpu, HelpCircle, Layers, Activity, FileText, ChevronRight } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const WorkspacesPanel = () => {
  const {
    activeOverlay,
    toggleOverlay,
    activePage,
    setActivePage,
    toggleDiagnostics,
  } = useOceanStore();

  if (activeOverlay !== 'workspaces') return null;

  const tools = [
    {
      id: 'home',
      name: 'Eyes on the Ocean 3D',
      subtitle: 'Planetary Cesium & 3D Volumetric Viewport',
      icon: <Layers className="w-4 h-4 text-sky-400" />,
      action: () => {
        setActivePage('home');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'comparison',
      name: '4D Profile Comparison',
      subtitle: 'Model vs In-Situ Argo residual analysis',
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      action: () => {
        setActivePage('comparison');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'data',
      name: 'INCOIS Data Catalog',
      subtitle: 'NetCDF archives & ERDDAP observational data',
      icon: <Database className="w-4 h-4 text-amber-400" />,
      action: () => {
        setActivePage('data');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'methodology',
      name: 'Scientific Methodology',
      subtitle: 'ROMS formulation & validation benchmarks',
      icon: <FileText className="w-4 h-4 text-violet-400" />,
      action: () => {
        setActivePage('methodology');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'diagnostics',
      name: 'System Diagnostics',
      subtitle: 'WebGL2 frame rate & memory buffers',
      icon: <Cpu className="w-4 h-4 text-cyan-400" />,
      action: () => {
        toggleDiagnostics();
        toggleOverlay('workspaces');
      },
    },
  ];

  return (
    <aside className="absolute right-6 top-20 z-30 w-80 bg-[rgba(4,10,24,0.88)] backdrop-blur-2xl rounded-2xl border border-sky-500/25 shadow-panel-dark text-white select-none overflow-hidden flex flex-col animate-fade-slide">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/30">
        <div className="flex items-center gap-2">
          <Menu className="w-4 h-4 text-sky-400" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-white uppercase">
              SCIENTIFIC WORKSPACES
            </h2>
            <span className="text-[9px] text-slate-400 block -mt-0.5">
              ANALYTICAL SUITES &amp; TOOLS
            </span>
          </div>
        </div>
        <button
          onClick={() => toggleOverlay('workspaces')}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Close Menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Tools List ─── */}
      <div className="p-3 flex flex-col gap-1.5">
        {tools.map((t) => {
          const isActive = activePage === t.id;
          return (
            <button
              key={t.id}
              onClick={t.action}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-sky-500/20 border border-sky-400/50 text-white shadow-glow-cyan-sm'
                  : 'bg-black/30 hover:bg-sky-500/10 border border-white/[0.05] hover:border-sky-500/30 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-black/40 border border-white/[0.08] shrink-0">
                  {t.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">{t.name}</span>
                  <span className="text-[10px] text-slate-400 font-sans">{t.subtitle}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0" />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
