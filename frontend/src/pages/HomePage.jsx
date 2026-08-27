import React from 'react';
import { OceanViewer } from '../rendering/OceanViewer';
import { VitalSignsPanel } from '../components/VitalSignsPanel';
import { MissionsPanel } from '../components/MissionsPanel';
import { EventsPanel } from '../components/EventsPanel';
import { DepthNavigator } from '../components/DepthNavigator';
import { ContextualInfoPanel } from '../components/ContextualInfoPanel';
import { ControlPanel } from '../components/ControlPanel';
import { WorkspacesPanel } from '../components/WorkspacesPanel';
import { ColorbarLegend } from '../components/ColorbarLegend';
import { TimelinePanel } from '../components/TimelinePanel';
import { ScientificHUD } from '../components/ScientificHUD';

export const HomePage = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#030712]">
      {/* 1. Full-Screen 3D Scientific Globe */}
      <OceanViewer />

      {/* 1.1 Tactical & Scientific Telemetry HUD (God's Eye View Style) */}
      <ScientificHUD />

      {/* 2. Floating Contextual Menus & Selectors */}
      <VitalSignsPanel />
      <MissionsPanel />
      <EventsPanel />
      <DepthNavigator />

      {/* 3. Floating Right Contextual Info Card & Layer Toggles */}
      <ContextualInfoPanel />
      <ControlPanel />
      <WorkspacesPanel />

      {/* 4. Floating Scientific Colorbar Scale Legend */}
      <ColorbarLegend />

      {/* 5. Floating Bottom Data Timeline Scrubber */}
      <TimelinePanel />
    </div>
  );
};