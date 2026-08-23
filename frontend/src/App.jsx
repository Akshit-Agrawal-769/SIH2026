import React, { useEffect } from 'react';
import { useOceanStore } from './store/oceanStore';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { ColorbarLegend } from './components/ColorbarLegend';
import { ObservationModal } from './components/ObservationModal';
import { OceanViewer } from './rendering/OceanViewer';

export default function App() {
  const { fetchInitialData, health, isLoading } = useOceanStore();

  useEffect(() => {
    fetchInitialData();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header />

      {/* Main 3D WebGL Viewport */}
      <main className="relative flex-1 w-full h-full">
        <OceanViewer />

        {/* Floating Scientific HUD Controls */}
        <ControlPanel />

        {/* Dynamic Colorbar Scale Legend */}
        <ColorbarLegend />

        {/* Model vs In-Situ Observation Residual & Validation Modal */}
        <ObservationModal />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute top-20 left-6 z-30 flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-sky-500/50 rounded-lg text-sky-400 text-xs shadow-lg backdrop-blur">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Streaming Scientific Float32 Buffer...</span>
          </div>
        )}
      </main>
    </div>
  );
}
