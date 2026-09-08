import React, { useState, useEffect } from 'react';
import { Home, Plus, Minus, Crosshair, Navigation } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export const GlobeControls = () => {
  const { triggerCameraAction } = useOceanStore();
  const [headingDegrees, setHeadingDegrees] = useState(0);

  useEffect(() => {
    let removeListener = null;
    const checkViewer = setInterval(() => {
      const viewer = window.__godsEyeView?.viewer;
      if (viewer && viewer.camera) {
        clearInterval(checkViewer);
        const updateHeading = () => {
          const deg = (viewer.camera.heading * 180) / Math.PI;
          setHeadingDegrees(deg);
        };
        viewer.camera.changed.addEventListener(updateHeading);
        removeListener = () => viewer.camera.changed.removeEventListener(updateHeading);
      }
    }, 500);

    return () => {
      clearInterval(checkViewer);
      if (removeListener) removeListener();
    };
  }, []);

  const handleResetNorth = () => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer) return;
    import('cesium').then((Cesium) => {
      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: 0,
          pitch: viewer.camera.pitch,
          roll: 0,
        },
        duration: 0.8,
      });
    });
  };

  const handleHome = () => {
    const viewer = window.__godsEyeView?.viewer;
    if (viewer) {
      viewer.camera.flyHome(1.5);
    } else {
      triggerCameraAction('fit_earth');
    }
  };

  const handleZoomIn = () => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer) return;
    const height = viewer.camera.positionCartographic?.height || 5000000;
    viewer.camera.zoomIn(height * 0.35);
  };

  const handleZoomOut = () => {
    const viewer = window.__godsEyeView?.viewer;
    if (!viewer) return;
    const height = viewer.camera.positionCartographic?.height || 5000000;
    viewer.camera.zoomOut(height * 0.35);
  };

  const handleLocate = () => {
    triggerCameraAction('fit_indian_ocean');
  };

  return (
    <div className="absolute right-[310px] top-20 z-30 flex flex-col items-center gap-2.5 select-none panel-transition animate-fade-slide">
      {/* Precision Aerospace Compass */}
      <button
        onClick={handleResetNorth}
        className="relative w-10 h-10 rounded-full bg-[rgba(3,7,18,0.6)] hover:bg-[rgba(6,14,32,0.85)] backdrop-blur-xl border border-sky-500/30 hover:border-cyan-400 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center group transition-all"
        title={`Heading: ${Math.round(headingDegrees)}° — Click to Reset North (Hotkey: R)`}
      >
        <span className="text-[8px] font-mono font-bold text-cyan-300 absolute top-0.5 tracking-tighter glow-text-cyan">
          N
        </span>
        <div
          className="w-5 h-5 flex items-center justify-center transition-transform duration-150"
          style={{ transform: `rotate(${-headingDegrees}deg)` }}
        >
          {/* North needle red/cyan, South needle slate */}
          <div className="w-0.5 h-full relative flex flex-col justify-between items-center">
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[8px] border-b-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.9)]" />
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[8px] border-t-slate-400/80" />
          </div>
        </div>
      </button>

      {/* Vertical Glass Control Dock */}
      <div className="flex flex-col rounded-xl bg-[rgba(3,7,18,0.6)] backdrop-blur-xl border border-sky-500/25 shadow-[0_8px_25px_rgba(0,0,0,0.5)] overflow-hidden divide-y divide-white/[0.08] panel-transition">
        {/* Full Earth Home View */}
        <button
          onClick={handleHome}
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-cyan-500/20 transition-colors group"
          title="Planetary Overview (Fit Earth)"
        >
          <Home className="w-4 h-4 text-slate-300 group-hover:text-cyan-300 transition-colors" />
        </button>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-cyan-500/20 transition-colors group"
          title="Zoom In Camera"
        >
          <Plus className="w-4 h-4 text-slate-300 group-hover:text-cyan-300 transition-colors" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-cyan-500/20 transition-colors group"
          title="Zoom Out Camera"
        >
          <Minus className="w-4 h-4 text-slate-300 group-hover:text-cyan-300 transition-colors" />
        </button>

        {/* Focus Target (Indian Ocean) */}
        <button
          onClick={handleLocate}
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-cyan-500/20 transition-colors group"
          title="Target Indian Ocean Basin"
        >
          <Crosshair className="w-4 h-4 text-slate-300 group-hover:text-cyan-300 transition-colors" />
        </button>
      </div>
    </div>
  );
};
