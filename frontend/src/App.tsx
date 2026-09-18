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
    return <div className="flex items-center justify-center w-screen h-screen bg-ocean-dark text-white">Initializing Gateway Session...</div>;
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-ocean-dark font-sans select-none">
      {/* Top Navigation & Status */}
      <TopBar viewer={viewer} />

      {/* Home Landing Hero View */}
      {mode === 'home' ? (
        <div className="pt-14 h-full w-full">
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
