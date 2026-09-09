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
import { useOceanStore } from './store/useOceanStore';

export const App: React.FC = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const { mode, showLeftPanel, showRightPanel, showBottomBar } = useOceanStore();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-ocean-dark font-sans select-none">
      {/* 3D Cesium Globe Container */}
      <CesiumViewer onViewerReady={setViewer} />

      {/* Top Navigation & Status */}
      <TopBar viewer={viewer} />

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

      {/* Scientific Colorbar Legend */}
      <ColorbarLegend />

      {/* Real-time Cursor Hover HUD Readout */}
      <OceanHoverHUD />

      {/* Floating In-situ Instrument Depth Profile Visualizer */}
      <InstrumentProfileModal />
    </main>
  );
};

export default App;
