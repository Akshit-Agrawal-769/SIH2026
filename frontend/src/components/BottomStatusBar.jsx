import React, { useState, useEffect } from 'react';
import { ShieldCheck, Activity } from 'lucide-react';

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
    headingStr: `000°`,
    pitchStr: `-90°`,
  });

  useEffect(() => {
    const updateTelemetry = () => {
      const viewer = window.__godsEyeView?.viewer;
      if (!viewer || !viewer.camera || !viewer.camera.positionCartographic) return;

      const carto = viewer.camera.positionCartographic;
      const lat = (carto.latitude * 180) / Math.PI;
      const lon = (carto.longitude * 180) / Math.PI;
      const altKm = (carto.height / 1000).toFixed(1);

      let headingDeg = 0;
      let pitchDeg = -90;
      if (viewer.camera.heading !== undefined) {
        headingDeg = Math.round((viewer.camera.heading * 180) / Math.PI) % 360;
      }
      if (viewer.camera.pitch !== undefined) {
        pitchDeg = Math.round((viewer.camera.pitch * 180) / Math.PI);
      }

      setTelemetry({
        latStr: toDms(lat, 'N', 'S'),
        lonStr: toDms(lon, 'E', 'W'),
        altStr: `${altKm} km`,
        elevStr: '0 m',
        headingStr: `${String(headingDeg).padStart(3, '0')}°`,
        pitchStr: `${pitchDeg}°`,
      });
    };

    const interval = setInterval(updateTelemetry, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-2 left-6 right-6 z-20 flex items-end justify-between pointer-events-none select-none text-[10px] font-mono text-slate-400">
      {/* ─── Bottom Left: Scientific Data Provenance ─── */}
      <div className="flex items-center gap-3 pointer-events-auto mission-panel px-3.5 py-1.5 rounded-xl text-[9.5px]">
        {/* Cesium ion badge */}
        <div className="flex items-center gap-1.5 opacity-90">
          <svg className="w-3.5 h-3.5 fill-cyan-400 drop-shadow-[0_0_4px_#00f2fe]" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="font-bold text-xs tracking-wider text-slate-100">
            CESIUM <span className="text-cyan-400 font-normal">ion</span>
          </span>
        </div>

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

      {/* ─── Bottom Center: Strict Scientific QC & Model Status Banner ─── */}
      <div className="hidden lg:flex items-center gap-3 pointer-events-auto mission-panel px-3.5 py-1.5 rounded-xl border-emerald-500/25 text-[9.5px]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-300 font-semibold tracking-wide">
            QC POLICY: WMO FLAGS 1 &amp; 2
          </span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5 text-slate-300">
          <div className="flex items-end gap-0.5 h-2">
            <div className="w-0.5 bg-cyan-400 rounded-full signal-bar-1" />
            <div className="w-0.5 bg-cyan-400 rounded-full signal-bar-2" />
            <div className="w-0.5 bg-cyan-400 rounded-full signal-bar-3" />
          </div>
          <span>ROMS 1/12° · 40 σ-LEVELS (SYNOPTIC)</span>
        </div>
      </div>

      {/* ─── Bottom Right: Live Camera Telemetry Readout (Hierarchy #4 Important Telemetry) ─── */}
      <div className="pointer-events-auto mission-panel px-3.5 py-1.5 rounded-xl text-right text-[10px] font-mono leading-tight">
        <div className="text-cyan-200 font-semibold flex items-center justify-end gap-2 tabular-nums glow-text-cyan">
          <span>{telemetry.latStr}</span>
          <span className="text-slate-500">·</span>
          <span>{telemetry.lonStr}</span>
        </div>
        <div className="text-slate-400 text-[9px] mt-0.5 flex items-center justify-end gap-2 tabular-nums">
          <span>ALT: <span className="text-cyan-300 font-medium">{telemetry.altStr}</span></span>
          <span className="text-slate-600">|</span>
          <span>HDG: <span className="text-cyan-300 font-medium">{telemetry.headingStr}</span></span>
          <span className="text-slate-600">|</span>
          <span>PITCH: <span className="text-cyan-300 font-medium">{telemetry.pitchStr}</span></span>
        </div>
      </div>
    </div>
  );
};
