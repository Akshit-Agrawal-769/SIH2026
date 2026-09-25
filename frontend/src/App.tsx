import React, { useState, Suspense } from 'react';
import * as Cesium from 'cesium';
import { CesiumViewer } from './globe/CesiumViewer';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ColorbarLegend } from './components/ColorbarLegend';
import { OceanHoverHUD } from './components/OceanHoverHUD';
import { CycloneHoverTooltip } from './components/CycloneHoverTooltip';
import { OutreachTourOverlay } from './components/OutreachTourOverlay';
import { GlobeClickWaterBlockCallout } from './components/GlobeClickWaterBlockCallout';
import { Timeline } from './components/Timeline';
import { useShallow } from 'zustand/react/shallow';
import { useOceanStore } from './store/useOceanStore';
import { DataStatusBar } from './components/DataStatusBar';
import { parseUrlState } from './store/urlState';

const DotGlobeHeroDemo = React.lazy(() => import('./components/ui/demo'));
const InstrumentProfileModal = React.lazy(() => import('./components/InstrumentProfileModal').then(m => ({ default: m.InstrumentProfileModal })));
const VolumetricStudio = React.lazy(() => import('./components/VolumetricStudio'));
const ModelObservationModal = React.lazy(() => import('./components/comparison').then(m => ({ default: m.ModelObservationModal })));
const AnalyticsModal = React.lazy(() => import('./components/analytics').then(m => ({ default: m.AnalyticsModal })));

export const App: React.FC = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const { mode, setMode, showLeftPanel, showRightPanel, loadCatalog, activeWaterBlockTarget, closeWaterBlock } = useOceanStore(
    useShallow((s) => ({
      mode: s.mode,
      setMode: s.setMode,
      showLeftPanel: s.showLeftPanel,
      showRightPanel: s.showRightPanel, activeWaterBlockTarget: s.activeWaterBlockTarget, closeWaterBlock: s.closeWaterBlock,
      loadCatalog: s.loadCatalog
    }))
  );

  React.useEffect(() => {
    loadCatalog();
    // Permalinks: open the view they describe instead of the landing page.
    const url = parseUrlState();
    if (url.mode) setMode(url.mode);
    else if (url.camera || url.layers) setMode('operational');
  }, [loadCatalog, setMode]);

  React.useEffect(() => {
    if (mode === 'home') setViewer(null);
  }, [mode]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b0f17] font-sans select-none">
      {/* Ambient background lighting & soft room glow behind the 3D globe */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-ocean-elevated/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] bg-neutral-700/20 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-solid/40 via-transparent to-neutral-950/80" />
      </div>

      {/* Top Navigation & Status Bar */}
      <TopBar viewer={viewer} />

      {/* Home Landing Hero View */}
      {mode === 'home' ? (
        <div className="pt-16 h-full w-full relative z-10">
          <Suspense fallback={<div role="status" className="h-full w-full flex items-center justify-center text-ocean-muted text-xs tracking-[0.2em]">LOADING…</div>}>
            <DotGlobeHeroDemo
              onStartExploring={() => setMode('operational')}
              onViewDemo={() => setMode('outreach')}
            />
          </Suspense>
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
              <Timeline />
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

          {mode === 'operational' && <DataStatusBar />}

          {/* Real-time Cursor Hover HUD Readout */}
          <OceanHoverHUD />

          {/* Floating In-situ Instrument Depth Profile Visualizer */}
          <Suspense fallback={<div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">LOADING PROFILE DATA...</div>}>
            <InstrumentProfileModal />
          </Suspense>

          {/* Interactive 3D Volumetric Water Column Cube Studio */}
          <Suspense fallback={<div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">INITIALIZING VOLUMETRIC VIEW...</div>}>
            <VolumetricStudio 
              open={!!activeWaterBlockTarget} 
              onClose={closeWaterBlock} 
              authToken={localStorage.getItem('token')} 
              initialFilename="INCOIS-BIO-ROMS.nc" 
              initialVariable="temp" 
            />
          </Suspense>

          {/* Floating Callout when Clicking Ocean on Globe */}
          <GlobeClickWaterBlockCallout />

          {/* Collocated Model vs Observation Ground-Truth Verification Modal */}
          <Suspense fallback={<div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">LOADING COMPARISON WORKSPACE...</div>}>
            <ModelObservationModal />
          </Suspense>

          {/* Scientific Ocean Analytics Studio Modal */}
          <Suspense fallback={<div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">LOADING ANALYTICAL WORKSPACE...</div>}>
            <AnalyticsModal />
          </Suspense>
        </>
      )}

      {/* Real-time Cyclone Marker Hover Tooltip Popup */}
      <CycloneHoverTooltip />
    </main>
  );
};

export default App;
