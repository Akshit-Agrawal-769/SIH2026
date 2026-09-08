import React, { useState, useEffect } from 'react';

function toDms(val, posChar, negChar) {
  const char = val >= 0 ? posChar : negChar;
  const abs = Math.abs(val);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = (((abs - d) * 60 - m) * 60).toFixed(2);
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(5, '0')}" ${char}`;
}

export const BottomStatusBar = () => {
  const [telemetry, setTelemetry] = useState({
    latStr: `10°00'00.00" N`,
    lonStr: `75°00'00.00" E`,
    altStr: `8000.0 km`,
    elevStr: `0 m`,
  });

  useEffect(() => {
    const updateTelemetry = () => {
      const viewer = window.__godsEyeView?.viewer;
      if (!viewer || !viewer.camera || !viewer.camera.positionCartographic) return;

      const carto = viewer.camera.positionCartographic;
      const lat = (carto.latitude * 180) / Math.PI;
      const lon = (carto.longitude * 180) / Math.PI;
      const altKm = (carto.height / 1000).toFixed(1);

      setTelemetry({
        latStr: toDms(lat, 'N', 'S'),
        lonStr: toDms(lon, 'E', 'W'),
        altStr: `${altKm} km`,
        elevStr: '0 m',
      });
    };

    const interval = setInterval(updateTelemetry, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-3 left-6 right-6 z-20 flex items-end justify-between pointer-events-none select-none text-[10px] font-mono text-slate-400">
      {/* Bottom Left: Scientific Attribution */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Cesium ion badge */}
        <div className="flex items-center gap-1.5 opacity-90">
          <svg className="w-4 h-4 fill-sky-400" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="font-bold text-xs tracking-wider text-slate-200">
            CESIUM <span className="text-sky-400 font-normal">ion</span>
          </span>
        </div>

        <div className="text-[9.5px] leading-tight">
          <div className="tracking-wide text-slate-300">
            INCOIS 3D OCEAN SYSTEM | ROMS | ARGO | COPERNICUS | TEOS-10
          </div>
          <div className="text-slate-500">
            Powered by Esri, NASA, Natural Earth
          </div>
        </div>
      </div>

      {/* Bottom Right: Live Camera Telemetry Readout */}
      <div className="text-right text-[10.5px] font-mono font-medium text-slate-300 leading-tight">
        <div>
          <span>{telemetry.latStr}</span> &nbsp; <span>{telemetry.lonStr}</span>
        </div>
        <div className="text-slate-400 text-[10px] mt-0.5">
          ALT: <span className="text-sky-300">{telemetry.altStr}</span> &nbsp;|&nbsp; ELEV: <span className="text-sky-300">{telemetry.elevStr}</span>
        </div>
      </div>
    </div>
  );
};
