import React, { useState } from 'react';
import * as Cesium from 'cesium';
import { CesiumViewer } from './globe/CesiumViewer';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { BottomBar } from './components/BottomBar';
import { InstrumentProfileModal } from './components/InstrumentProfileModal';
import { ColorbarLegend } from './components/ColorbarLegend';
import { OceanHoverHUD } from './components/OceanHoverHUD';
import { OutreachTourOverlay } from './components/OutreachTourOverlay';
import { OceanWaterCubeModal } from './components/OceanWaterCubeModal';
import { GlobeClickWaterBlockCallout } from './components/GlobeClickWaterBlockCallout';
import { useOceanStore } from './store/useOceanStore';
import DotGlobeHeroDemo from './components/ui/demo';

export const App: React.FC = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { mode, setMode, showLeftPanel, showRightPanel, showBottomBar } = useOceanStore();

  React.useEffect(() => {
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        setAuthReady(true);
      })
      .catch(err => {
        console.error('Failed to auto-login', err);
        setAuthReady(true);
      });
  }, []);

  if (!authReady) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-[#0b0f17] text-white font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Initializing Oceanix Gateway Session...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b0f17] font-sans select-none">
      {/* Ambient background lighting & soft room glow behind the 3D globe */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-slate-800/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-slate-700/20 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-950/80" />
      </div>

      {/* Top Navigation & Status Bar */}
      <TopBar viewer={viewer} />

      {/* Home Landing Hero View */}
      {mode === 'home' ? (
        <div className="pt-16 h-full w-full relative z-10">
          <DotGlobeHeroDemo
            onStartExploring={() => setMode('operational')}
            onViewDemo={() => setMode('outreach')}
          />
        </div>
      ) : (
        <>
          {/* 3D Cesium Globe Container */}
          <CesiumViewer onViewerReady={setViewer} />

          {/* Mode-dependent Sidebars */}
          {mode === 'operational' && (
            <>
              {showLeftPanel && <LeftPanel />}
              {showRightPanel && <RightPanel />}
              {showBottomBar && <BottomBar />}
            </>
          )}

          {/* Public Outreach Story Tour Overlay */}
          {mode === 'outreach' && (
            <OutreachTourOverlay viewer={viewer} />
          )}

          {/* Scientific Colorbar Legend (floating only when Right Panel is collapsed) */}
          {mode === 'operational' && !showRightPanel && (
            <ColorbarLegend />
          )}

          {/* Real-time Cursor Hover HUD Readout */}
          <OceanHoverHUD />

          {/* Floating In-situ Instrument Depth Profile Visualizer */}
          <InstrumentProfileModal />

          {/* Interactive 3D Volumetric Water Column Cube Studio */}
          <OceanWaterCubeModal />

          {/* Floating Callout when Clicking Ocean on Globe */}
          <GlobeClickWaterBlockCallout />
        </>
      )}
    </main>
  );
};

export default App;
