import React from 'react';
import { OceanViewer } from '../rendering/OceanViewer';
import { LeftPanel } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { BottomBar } from '../components/BottomBar';

export const HomePage = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--surface-base)]">
      {/* 1. Full-Viewport 3D Scientific Ocean Canvas */}
      <OceanViewer />

      {/* 2. Docked Primary Scientific Control Rack (Left) */}
      <LeftPanel />

      {/* 3. Docked Contextual Telemetry & Float Dossier Rack (Right) */}
      <RightPanel />

      {/* 4. Unified Bottom Control Strip (Timeline + Colorbar Scale) */}
      <BottomBar />
    </div>
  );
};