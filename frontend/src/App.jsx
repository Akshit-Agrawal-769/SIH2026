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
import { ShortcutsModal } from './components/ShortcutsModal';
import { OceanViewer } from './rendering/OceanViewer';

export default function App() {
  const { fetchInitialData } = useOceanStore();

  useEffect(() => {
    fetchInitialData();

    const handleKeyDown = (e) => {
      // Don't trigger when typing in inputs or selects
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      const store = useOceanStore.getState();
      switch (e.key) {
        case '1':
          store.triggerCameraAction('cinematic');
          break;
        case '2':
          store.triggerCameraAction('platform');
          break;
        case '3':
          store.triggerCameraAction('geospatial');
          break;
        case '4':
          store.triggerCameraAction('subsurface');
          break;
        case '5':
          store.triggerCameraAction('iso');
          break;
        case ' ':
          e.preventDefault();
          store.toggleTimelinePlayback();
          break;
        case '[':
          store.stepTimeIndex(-1);
          break;
        case ']':
          store.stepTimeIndex(1);
          break;
        case 'l':
        case 'L':
          store.toggleControlPanel();
          break;
        case 'i':
        case 'I':
          store.toggleInspector();
          break;
        case 'd':
        case 'D':
          store.toggleDiagnostics();
          break;
        case '?':
          store.toggleShortcutsModal();
          break;
        case 'Escape':
          if (store.isModalOpen) store.closeModal();
          if (store.isShortcutsModalOpen) store.toggleShortcutsModal();
          if (store.isDiagnosticsOpen) store.toggleDiagnostics();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#040711] text-slate-100 flex flex-col font-sans select-none">
      {/* 1. TOP SYSTEM COMMAND HEADER */}
      <Header />

      {/* 2. MAIN 3D OCEAN WORKSTATION VIEWPORT & DOCKED RAILS */}
      <div className="relative flex-1 w-full h-full flex overflow-hidden">
        {/* Left Variable & Rendering Control Rail */}
        <ControlPanel />

        {/* Central WebGL2 3D Canvas Viewport */}
        <main className="relative flex-1 h-full overflow-hidden">
          <OceanViewer />
          {/* Floating Scientific Colorbar Legend */}
          <ColorbarLegend />
        </main>

        {/* Right Data & Metadata Inspector Panel */}
        <InspectorPanel />
      </div>

      {/* 3. DOCKED BOTTOM CONTROL DECK: PRECISION DEPTH SLICING STRIP */}
      <DepthSliceBar />

      {/* 4. DOCKED BOTTOM CONTROL DECK: SCIENTIFIC TIMELINE & PLAYBACK FOOTER */}
      <TimelinePanel />

      {/* 5. MODEL VS OBSERVATION COMPARISON MODAL */}
      <ObservationModal />

      {/* 6. SYSTEM & DATASET DIAGNOSTICS DRAWER */}
      <DiagnosticsDrawer />

      {/* 7. ACCESSIBLE KEYBOARD SHORTCUTS MODAL */}
      <ShortcutsModal />
    </div>
  );
}
