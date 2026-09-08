import React from 'react';
import { useOceanStore } from '../store/oceanStore';
import { CesiumOceanViewer } from '../rendering/CesiumOceanViewer';
import { OceanViewer } from '../rendering/OceanViewer';
import { LocationDataPanel } from '../components/LocationDataPanel';
import { ViewRegionPanel } from '../components/ViewRegionPanel';
import { ActiveLayerPanel } from '../components/ActiveLayerPanel';
import { SelectedFeaturePanel } from '../components/SelectedFeaturePanel';
import { GlobeControls } from '../components/GlobeControls';
import { OceanTimeline } from '../components/OceanTimeline';
import { BottomStatusBar } from '../components/BottomStatusBar';
import { ColorbarLegend } from '../components/ColorbarLegend';

// Contextual Overlays (opened via Header navigation / layers)
import { MissionsPanel } from '../components/MissionsPanel';
import { EventsPanel } from '../components/EventsPanel';
import { ControlPanel } from '../components/ControlPanel';
import { WorkspacesPanel } from '../components/WorkspacesPanel';

export const HomePage = () => {
  const { engineMode } = useOceanStore();

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#030712]">
      {/* 1. Primary 3D Viewport: Cesium Globe (Undeniable Centerpiece) OR Three.js Volumetric */}
      {engineMode === 'cesium' ? <CesiumOceanViewer /> : <OceanViewer />}

      {/* 1.1 Filmic Mission Control Viewport Vignette */}
      <div className="absolute inset-0 hud-vignette pointer-events-none z-10" />

      {/* 2. Left Panel: Location & Ocean Intelligence */}
      <LocationDataPanel />

      {/* 3. Floating Vertical Globe Controls */}
      <GlobeControls />

      {/* 4. Right Panels Stack: View & Region, Active Layer, Selected Feature */}
      <div className="absolute top-18 right-6 z-30 flex flex-col gap-3">
        <ViewRegionPanel />
        <ActiveLayerPanel />
        <SelectedFeaturePanel />
      </div>

      {/* 4.1 Three.js Scientific Colorbar Legend with Log/Linear scale */}
      {engineMode === 'three' && <ColorbarLegend />}

      {/* 5. Centered Bottom Timeline Scrubber */}
      <OceanTimeline />

      {/* 6. Bottom Scientific Attribution & Telemetry Status Bar */}
      <BottomStatusBar />

      {/* 7. Contextual Flyout Overlays (Missions, Events, Layers, Workspaces) */}
      <MissionsPanel />
      <EventsPanel />
      <ControlPanel />
      <WorkspacesPanel />
    </div>
  );
};