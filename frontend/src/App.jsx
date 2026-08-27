import React, { useEffect } from 'react';
import { useOceanStore } from './store/oceanStore';
import { AppHeader } from './components/AppHeader';
import { GoToLocationModal } from './components/GoToLocationModal';
import { ObservationModal } from './components/ObservationModal';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { ShortcutsModal } from './components/ShortcutsModal';

// Dedicated Scientific Workspaces
import { HomePage } from './pages/HomePage';
import { ExplorerPage } from './pages/ExplorerPage';
import { CoordinatesPage } from './pages/CoordinatesPage';
import { ArgoPage } from './pages/ArgoPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DataCatalogPage } from './pages/DataCatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { MethodologyPage } from './pages/MethodologyPage';

export default function App() {
  const { activePage, fetchInitialData } = useOceanStore();

  useEffect(() => {
    fetchInitialData();

    const handleKeyDown = (e) => {
      // Ignore keystrokes when typing in form inputs, textareas, or dropdowns
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      const store = useOceanStore.getState();
      switch (e.key) {
        // Variable cycling
        case 'v':
        case 'V':
          store.cycleVariable();
          break;

        // Depth stepping (Up/Down)
        case 'ArrowUp':
          e.preventDefault();
          store.stepDepthLevel(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          store.stepDepthLevel(1);
          break;

        // Navigation shortcuts
        case 'h':
        case 'H':
          store.setActivePage('home');
          break;
        case 'a':
        case 'A':
          store.setActivePage('argo');
          break;
        case 'c':
        case 'C':
          store.setActivePage('comparison');
          break;

        // Camera presets (1-5)
        case '1':
          store.triggerCameraAction('fit_earth');
          break;
        case '2':
          store.triggerCameraAction('fit_indian_ocean');
          break;
        case '3':
          store.triggerCameraAction('arabian_sea');
          break;
        case '4':
          store.triggerCameraAction('bay_of_bengal');
          break;
        case '5':
          store.triggerCameraAction('reset');
          break;

        // Timeline controls
        case ' ':
          e.preventDefault();
          store.toggleTimelinePlayback();
          break;
        case '[':
        case 'ArrowLeft':
          e.preventDefault();
          store.stepTimeIndex(-1);
          break;
        case ']':
        case 'ArrowRight':
          e.preventDefault();
          store.stepTimeIndex(1);
          break;

        // Tool drawers & shortcuts
        case 'd':
        case 'D':
          store.toggleDiagnostics();
          break;
        case 'r':
        case 'R':
          store.triggerCameraAction('reset');
          break;
        case 'l':
        case 'L':
          store.toggleGoToLocationModal();
          break;
        case '?':
          store.toggleShortcutsModal();
          break;

        // Modal dismissal / Deselection
        case 'Escape':
          if (store.isModalOpen) store.closeModal();
          if (store.isShortcutsModalOpen) store.toggleShortcutsModal();
          if (store.isDiagnosticsOpen) store.toggleDiagnostics();
          if (store.isGoToLocationOpen) store.toggleGoToLocationModal();
          store.selectFloat(null);
          store.setSelectedEntity(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchInitialData]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--surface-base)] text-slate-100 flex flex-col font-sans select-none">
      {/* 1. COMPACT SCIENTIFIC COMMAND APP BAR */}
      <AppHeader />

      {/* 2. DYNAMIC WORKSPACE PAGE ROUTER */}
      <main className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
        {activePage === 'home' && <HomePage />}
        {activePage === 'explorer' && <ExplorerPage />}
        {activePage === 'coordinates' && <CoordinatesPage />}
        {activePage === 'argo' && <ArgoPage />}
        {activePage === 'comparison' && <ComparisonPage />}
        {activePage === 'analytics' && <AnalyticsPage />}
        {activePage === 'data' && <DataCatalogPage />}
        {activePage === 'settings' && <SettingsPage />}
        {activePage === 'methodology' && <MethodologyPage />}
      </main>

      {/* 3. GLOBAL SCIENTIFIC MODALS & UTILITY DRAWERS */}
      <GoToLocationModal />
      <ObservationModal />
      <DiagnosticsDrawer />
      <ShortcutsModal />
    </div>
  );
}
