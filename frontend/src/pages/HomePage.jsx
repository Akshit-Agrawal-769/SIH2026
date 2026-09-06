import React from 'react';
import { CesiumOceanViewer } from '../rendering/CesiumOceanViewer';
import { LocationDataPanel } from '../components/LocationDataPanel';
import { ViewRegionPanel } from '../components/ViewRegionPanel';
import { ActiveLayerPanel } from '../components/ActiveLayerPanel';
import { SelectedFeaturePanel } from '../components/SelectedFeaturePanel';
import { GlobeControls } from '../components/GlobeControls';
import { OceanTimeline } from '../components/OceanTimeline';
import { BottomStatusBar } from '../components/BottomStatusBar';

// Contextual Overlays (opened via Header navigation / layers)
import { MissionsPanel } from '../components/MissionsPanel';
import { EventsPanel } from '../components/EventsPanel';
import { ControlPanel } from '../components/ControlPanel';
import { WorkspacesPanel } from '../components/WorkspacesPanel';

export const HomePage = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#030712]">
      {/* 1. Full-Screen 3D Scientific Globe (Protected Cesium Integration) */}
      <CesiumOceanViewer />

      {/* 2. Left Panel: Location & Data */}
      <LocationDataPanel />

      {/* 3. Floating Vertical Globe Controls */}
      <GlobeControls />

      {/* 4. Right Panels Stack: View & Region, Active Layer, Selected Feature */}
      <div className="absolute top-20 right-6 z-30 flex flex-col gap-3.5">
        <ViewRegionPanel />
        <ActiveLayerPanel />
        <SelectedFeaturePanel />
      </div>

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