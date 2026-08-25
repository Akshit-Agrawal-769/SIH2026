import React, { useEffect } from 'react';
import { useOceanStore } from './store/oceanStore';
import { Header } from './components/Header';
import { GoToLocationModal } from './components/GoToLocationModal';
import { ObservationModal } from './components/ObservationModal';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { ShortcutsModal } from './components/ShortcutsModal';

// 8 Dedicated Scientific Workspaces
import { HomePage } from './pages/HomePage';
import { ExplorerPage } from './pages/ExplorerPage';
import { CoordinatesPage } from './pages/CoordinatesPage';
import { ArgoPage } from './pages/ArgoPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DataCatalogPage } from './pages/DataCatalogPage';
import { MethodologyPage } from './pages/MethodologyPage';

export default function App() {
  const { activePage, fetchInitialData } = useOceanStore();

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
        case 'g':
        case 'G':
          store.toggleGoToLocationModal();
          break;
        case '?':
          store.toggleShortcutsModal();
          break;
        case 'Escape':
          if (store.isModalOpen) store.closeModal();
          if (store.isShortcutsModalOpen) store.toggleShortcutsModal();
          if (store.isDiagnosticsOpen) store.toggleDiagnostics();
          if (store.isGoToLocationOpen) store.toggleGoToLocationModal();
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
      {/* 1. TOP SYSTEM COMMAND HEADER & NAVIGATION BAR */}
      <Header />

      {/* 2. DYNAMIC WORKSPACE PAGE ROUTER */}
      <main className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
        {activePage === 'home' && <HomePage />}
        {activePage === 'explorer' && <ExplorerPage />}
        {activePage === 'coordinates' && <CoordinatesPage />}
        {activePage === 'argo' && <ArgoPage />}
        {activePage === 'comparison' && <ComparisonPage />}
        {activePage === 'analytics' && <AnalyticsPage />}
        {activePage === 'data' && <DataCatalogPage />}
        {activePage === 'methodology' && <MethodologyPage />}
      </main>

      {/* 3. GLOBAL MODALS & UTILITY PANELS */}
      <GoToLocationModal />
      <ObservationModal />
      <DiagnosticsDrawer />
      <ShortcutsModal />
    </div>
  );
}
