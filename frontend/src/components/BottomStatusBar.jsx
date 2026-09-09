import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useOceanStore } from '../store/oceanStore';

export function toDms(val, posChar, negChar) {
  if (val === undefined || val === null || isNaN(val)) return `00°00'00.00" ${posChar}`;
  const char = val >= 0 ? posChar : negChar;
  const abs = Math.abs(val);
  let d = Math.floor(abs);
  let m = Math.floor((abs - d) * 60);
  let s = parseFloat((((abs - d) * 60 - m) * 60).toFixed(2));

  if (s >= 59.995) {
    s = 0;
    m += 1;
    if (m >= 60) {
      m = 0;
      d += 1;
    }
  }

  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(2).padStart(5, '0')}" ${char}`;
}

export const BottomStatusBar = () => {
  const { engineMode } = useOceanStore();

  const [coordinates, setCoordinates] = useState({
    latStr: `10°00'00.00" N`,
    lonStr: `75°00'00.00" E`,
  });

  useEffect(() => {
    const updateCoordinates = () => {
      try {
        const viewer = window.__cesiumViewer;
        if (!viewer || viewer.isDestroyed() || !viewer.camera?.positionCartographic) return;

        const carto = viewer.camera.positionCartographic;
        const lat = (carto.latitude * 180) / Math.PI;
        const lon = (carto.longitude * 180) / Math.PI;

        setCoordinates({
          latStr: toDms(lat, 'N', 'S'),
          lonStr: toDms(lon, 'E', 'W'),
        });
      } catch (e) {
        // Cesium may be unavailable during initialization or teardown.
      }
    };

    updateCoordinates();
    const interval = setInterval(updateCoordinates, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-3 left-6 right-6 z-20 flex items-end justify-between pointer-events-none select-none text-[10px] font-mono text-slate-400">
      {/* ─── Bottom Left: Scientific Data Provenance ─── */}
      <div className="flex items-center gap-3 pointer-events-auto mission-panel px-3.5 py-1.5 rounded-xl text-[9.5px]">
        {engineMode === 'cesium' ? (
          <div className="flex items-center gap-1.5 opacity-90">
            <svg className="w-3.5 h-3.5 fill-cyan-400 drop-shadow-[0_0_4px_#00f2fe]" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="font-bold text-xs tracking-wider text-slate-100">
              CESIUM <span className="text-cyan-400 font-normal">ion</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 opacity-90">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-xs tracking-wider text-slate-100">
              THREE.JS <span className="text-cyan-400 font-normal">WebGL2</span>
            </span>
          </div>
        )}

        <div className="w-[1px] h-3.5 bg-white/10" />

        <div className="text-[9.5px] leading-tight">
          <div className="tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
            <span className="text-slate-200">INCOIS</span>
            <span className="text-slate-600">/</span>
            <span>ARGO GDAC</span>
            <span className="text-slate-600">/</span>
            <span>COPERNICUS</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-bold glow-text-cyan">TEOS-10</span>
          </div>
        </div>
      </div>

      {/* Bottom Center: Scientific QC & Model Status */}
      <div className="hidden lg:flex items-center gap-3 pointer-events-auto mission-panel px-3.5 py-1.5 rounded-xl border-emerald-500/25 text-[9.5px]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-300 font-semibold tracking-wide">
            QC POLICY: WMO FLAGS 1 &amp; 2
          </span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-2 text-slate-300">
          <div className="flex items-end gap-0.5 h-2">
            <div className="w-0.5 bg-cyan-400 rounded-full signal-bar-1" />
            <div className="w-0.5 bg-cyan-400 rounded-full signal-bar-2" />
            <div className="w-0.5 bg-cyan-400 rounded-full signal-bar-3" />
          </div>
          <span>ROMS 1/12° · 40 σ-LEVELS (SYNOPTIC)</span>
        </div>
      </div>

      {/* Bottom Right: Geographic Position */}
      <div className="pointer-events-auto mission-panel px-3.5 py-1.5 rounded-xl text-right text-[10px] font-mono leading-tight">
        <div className="text-cyan-200 font-semibold flex items-center justify-end gap-2 tabular-nums">
          <span>{coordinates.latStr}</span>
          <span className="text-slate-500">·</span>
          <span>{coordinates.lonStr}</span>
        </div>
        <div className="text-slate-500 text-[9px] mt-0.5">
          VIEW CENTER
        </div>
      </div>
    </div>
  );
};