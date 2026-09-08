import React, { useState, useEffect } from 'react';
import { Home, Plus, Minus, Crosshair } from 'lucide-react';
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
    <div className="absolute right-[320px] top-28 z-30 flex flex-col items-center gap-2 select-none">
      {/* Compass Needle */}
      <button
        onClick={handleResetNorth}
        className="relative w-9 h-9 rounded-full bg-[rgba(6,12,24,0.85)] hover:bg-[rgba(10,20,38,0.95)] backdrop-blur-md border border-sky-500/25 shadow-lg flex items-center justify-center group transition-all"
        title="Reset North Heading"
      >
        <span className="text-[9px] font-bold text-slate-400 absolute top-0.5">N</span>
        <div
          className="w-4 h-4 flex items-center justify-center transition-transform duration-150"
          style={{ transform: `rotate(${-headingDegrees}deg)` }}
        >
          {/* North needle red, South needle white */}
          <div className="w-0.5 h-full relative flex flex-col justify-between items-center">
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-red-500" />
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[6px] border-t-white/80" />
          </div>
        </div>
      </button>

      {/* Button Stack */}
      <div className="flex flex-col rounded-xl bg-[rgba(6,12,24,0.85)] backdrop-blur-md border border-sky-500/25 shadow-lg overflow-hidden divide-y divide-white/[0.08]">
        {/* Home */}
        <button
          onClick={handleHome}
          className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-sky-500/15 transition-colors"
          title="Full Earth View"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-sky-500/15 transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-sky-500/15 transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Focus Target */}
        <button
          onClick={handleLocate}
          className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-sky-500/15 transition-colors"
          title="Focus Indian Ocean Target"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
