import React, { useEffect } from 'react';
import { useOceanStore } from './store/oceanStore';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { ColorbarLegend } from './components/ColorbarLegend';
import { DepthSliceBar } from './components/DepthSliceBar';
import { TimelinePanel } from './components/TimelinePanel';
import { ObservationModal } from './components/ObservationModal';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { OceanViewer } from './rendering/OceanViewer';

export default function App() {
  const { fetchInitialData } = useOceanStore();

  useEffect(() => {
    fetchInitialData();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* 1. TOP SYSTEM COMMAND HEADER */}
      <Header />

      {/* 2. MAIN 3D OCEAN VIEWPORT & FLOATING HUD RAILS */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Central WebGL2 3D Canvas */}
        <OceanViewer />

        {/* Left Variable & Rendering Control Rail */}
        <ControlPanel />

        {/* Right Data & Metadata Inspector Panel */}
        <InspectorPanel />

        {/* Floating Scientific Colorbar Legend */}
        <ColorbarLegend />
      </main>

      {/* 3. PRECISION DEPTH SLICING STRIP */}
      <DepthSliceBar />

      {/* 4. SCIENTIFIC TIMELINE & PLAYBACK FOOTER */}
      <TimelinePanel />

      {/* 5. MODEL VS OBSERVATION COMPARISON MODAL */}
      <ObservationModal />

      {/* 6. SYSTEM & DATASET DIAGNOSTICS DRAWER */}
      <DiagnosticsDrawer />
    </div>
  );
}
