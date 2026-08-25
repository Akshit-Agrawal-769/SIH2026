import React from 'react';
import { ControlPanel } from '../components/ControlPanel';
import { InspectorPanel } from '../components/InspectorPanel';
import { ColorbarLegend } from '../components/ColorbarLegend';
import { DepthSliceBar } from '../components/DepthSliceBar';
import { TimelinePanel } from '../components/TimelinePanel';
import { OceanViewer } from '../rendering/OceanViewer';

export const ExplorerPage = () => {
  return (
    <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden select-none bg-[#040711]">
      {/* Main 3D Viewport Rail */}
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

      {/* Docked Bottom Deck: Precision Depth Slicing Strip */}
      <DepthSliceBar />

      {/* Docked Bottom Deck: Scientific Timeline & Playback Footer */}
      <TimelinePanel />
    </div>
  );
};