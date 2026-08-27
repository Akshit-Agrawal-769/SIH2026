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
    toggleShortcutsModal,
  } = useOceanStore();

  if (activeOverlay !== 'workspaces') return null;

  const tools = [
    {
      id: 'home',
      name: 'Eyes on the Ocean 3D',
      subtitle: 'Primary full-screen scientific globe',
      icon: <Layers className="w-4 h-4 text-white/70" />,
      action: () => {
        setActivePage('home');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'comparison',
      name: '4D Profile Comparison',
      subtitle: 'Model vs In-Situ Argo residual analysis',
      icon: <Activity className="w-4 h-4 text-white/70" />,
      action: () => {
        setActivePage('comparison');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'data',
      name: 'INCOIS Data Catalog',
      subtitle: 'NetCDF archives & ERDDAP datasets',
      icon: <Database className="w-4 h-4 text-white/70" />,
      action: () => {
        setActivePage('data');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'methodology',
      name: 'Scientific Methodology',
      subtitle: 'ROMS formulation & validation benchmarks',
      icon: <FileText className="w-4 h-4 text-white/70" />,
      action: () => {
        setActivePage('methodology');
        toggleOverlay('workspaces');
      },
    },
    {
      id: 'diagnostics',
      name: 'System Diagnostics',
      subtitle: 'WebGL2 frame rate & memory buffers',
      icon: <Cpu className="w-4 h-4 text-white/70" />,
      action: () => {
        toggleDiagnostics();
        toggleOverlay('workspaces');
      },
    },
  ];

  return (
    <aside className="absolute right-3 md:right-4 top-12 md:top-14 z-30 w-72 md:w-80 glass-panel rounded-xl text-white/90 select-none overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-black/20">
        <div className="flex items-center gap-2">
          <Menu className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90">Workspaces & Tools</span>
        </div>
        <button
          onClick={() => toggleOverlay('workspaces')}
          className="p-1 text-white/40 hover:text-white/80 rounded transition-colors"
          title="Close Menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tools List */}
      <div className="p-2 flex flex-col gap-1">
        {tools.map((t) => {
          const isActive = activePage === t.id;
          return (
            <button
              key={t.id}
              onClick={t.action}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-white/15 border border-white/20 text-white'
                  : 'bg-black/20 hover:bg-white/5 border border-transparent text-white/70 hover:text-white/95'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-white/5 shrink-0">
                  {t.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-normal text-white/90">{t.name}</span>
                  <span className="text-[10px] text-white/40 font-light">{t.subtitle}</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
