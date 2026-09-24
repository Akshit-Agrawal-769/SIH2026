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
import { useOceanStore } from './store/useOceanStore';
import DotGlobeHeroDemo from './components/ui/demo';

const InstrumentProfileModal = React.lazy(() => import('./components/InstrumentProfileModal').then(m => ({ default: m.InstrumentProfileModal })));
const OceanWaterCubeModal = React.lazy(() => import('./components/OceanWaterCubeModal').then(m => ({ default: m.OceanWaterCubeModal })));
const ModelObservationModal = React.lazy(() => import('./components/comparison').then(m => ({ default: m.ModelObservationModal })));
const AnalyticsModal = React.lazy(() => import('./components/analytics').then(m => ({ default: m.AnalyticsModal })));

export const App: React.FC = () => {
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { mode, setMode, showLeftPanel, showRightPanel } = useOceanStore();

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
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">LOADING PROFILE DATA...</div>}>
            <InstrumentProfileModal />
          </Suspense>

          {/* Interactive 3D Volumetric Water Column Cube Studio */}
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">INITIALIZING VOLUMETRIC VIEW...</div>}>
            <OceanWaterCubeModal />
          </Suspense>

          {/* Floating Callout when Clicking Ocean on Globe */}
          <GlobeClickWaterBlockCallout />

          {/* Collocated Model vs Observation Ground-Truth Verification Modal */}
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">LOADING COMPARISON WORKSPACE...</div>}>
            <ModelObservationModal />
          </Suspense>

          {/* Scientific Ocean Analytics Studio Modal */}
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-bg/60 backdrop-blur-md text-ocean-muted font-sans tracking-[0.2em] text-xs font-medium animate-pulse pointer-events-none">LOADING ANALYTICAL WORKSPACE...</div>}>
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
