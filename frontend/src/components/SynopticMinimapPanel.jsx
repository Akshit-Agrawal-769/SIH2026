import React, { useEffect, useRef } from 'react';
import { useOceanStore } from '../store/oceanStore';
import { Globe, ArrowLeft, Maximize2, Compass, Layers, Activity } from 'lucide-react';

export const SynopticMinimapPanel = () => {
  const canvasRef = useRef(null);
  const { activeRegion, selectRegionAndSwitchTo3D, setEngineMode, variable, volumeMeta } = useOceanStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Regional Variable-Aware Synoptic Background Gradient
    // Indian Ocean macro basin (40°E to 105°E, -5°S to 30°N)
    const activeVar = variable || 'temp';
    const oceanGrad = ctx.createLinearGradient(0, height, width, 0);
    if (activeVar === 'salt') {
      oceanGrad.addColorStop(0.0, '#042f2e');
      oceanGrad.addColorStop(0.35, '#0d9488');
      oceanGrad.addColorStop(0.70, '#06b6d4');
      oceanGrad.addColorStop(1.0, '#38bdf8');
    } else if (activeVar === 'currents' || activeVar === 'u' || activeVar === 'v') {
      oceanGrad.addColorStop(0.0, '#0f172a');
      oceanGrad.addColorStop(0.30, '#1e3a8a');
      oceanGrad.addColorStop(0.65, '#0284c7');
      oceanGrad.addColorStop(1.0, '#10b981');
    } else if (activeVar === 'chl') {
      oceanGrad.addColorStop(0.0, '#022c22');
      oceanGrad.addColorStop(0.40, '#065f46');
      oceanGrad.addColorStop(0.75, '#059669');
      oceanGrad.addColorStop(1.0, '#84cc16');
    } else {
      oceanGrad.addColorStop(0.0, '#0c4a6e');
      oceanGrad.addColorStop(0.25, '#0284c7');
      oceanGrad.addColorStop(0.55, '#0d9488');
      oceanGrad.addColorStop(0.75, '#eab308');
      oceanGrad.addColorStop(1.0, '#f97316');
    }
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle thermal current streaks
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const yStart = height * (0.3 + i * 0.12);
      ctx.moveTo(0, yStart);
      ctx.bezierCurveTo(
        width * 0.35, yStart - 18,
        width * 0.65, yStart + 14,
        width, yStart - 8
      );
      ctx.stroke();
    }
    ctx.restore();

    // Mapping helper from Lon/Lat to Canvas coordinates
    // Macro window: Lon [48.0, 102.0], Lat [-2.0, 28.0]
    const minLon = 48.0;
    const maxLon = 102.0;
    const minLat = -2.0;
    const maxLat = 28.0;

    const toCanvasX = (lon) => ((lon - minLon) / (maxLon - minLon)) * width;
    const toCanvasY = (lat) => (1.0 - (lat - minLat) / (maxLat - minLat)) * height;

    // 2. Draw Coastlines & Landmasses in Olive/Slate Green
    ctx.save();
    ctx.fillStyle = '#1e293b'; // Slate land base
    ctx.strokeStyle = '#64748b'; // Coastline stroke
    ctx.lineWidth = 1.0;

    // Indian Peninsula (8°N to 25°N, 68°E to 90°E)
    ctx.beginPath();
    ctx.moveTo(toCanvasX(68.0), toCanvasY(23.0)); // Gujarat
    ctx.lineTo(toCanvasX(72.5), toCanvasY(21.0)); // Gulf of Khambhat
    ctx.lineTo(toCanvasX(73.0), toCanvasY(18.5)); // Mumbai
    ctx.lineTo(toCanvasX(74.0), toCanvasY(15.0)); // Goa
    ctx.lineTo(toCanvasX(75.5), toCanvasY(12.0)); // Malabar
    ctx.lineTo(toCanvasX(77.5), toCanvasY(8.1));  // Kanyakumari (Cape Comorin)
    ctx.lineTo(toCanvasX(79.8), toCanvasY(10.5)); // Palk Strait
    ctx.lineTo(toCanvasX(80.3), toCanvasY(13.1)); // Chennai
    ctx.lineTo(toCanvasX(82.5), toCanvasY(17.0)); // Andhra coast
    ctx.lineTo(toCanvasX(86.5), toCanvasY(20.0)); // Odisha coast
    ctx.lineTo(toCanvasX(89.0), toCanvasY(22.0)); // Bengal Delta
    ctx.lineTo(toCanvasX(92.0), toCanvasY(27.0)); // Assam / Himalayas
    ctx.lineTo(toCanvasX(68.0), toCanvasY(27.0)); // Northern boundary
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vegetation green overlay on Indian landmass
    ctx.fillStyle = 'rgba(21, 128, 61, 0.45)';
    ctx.fill();

    // Sri Lanka (6°N to 9.8°N, 79.5°E to 81.8°E)
    ctx.beginPath();
    ctx.ellipse(
      toCanvasX(80.7), toCanvasY(7.9),
      ((81.8 - 79.5) / (maxLon - minLon)) * width * 0.5,
      ((9.8 - 6.0) / (maxLat - minLat)) * height * 0.5,
      0, 0, Math.PI * 2
    );
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = 'rgba(21, 128, 61, 0.45)';
    ctx.fill();
    ctx.stroke();

    // Arabian Coast / Oman / Iran (NW)
    ctx.beginPath();
    ctx.moveTo(toCanvasX(48.0), toCanvasY(28.0));
    ctx.lineTo(toCanvasX(58.0), toCanvasY(24.0));
    ctx.lineTo(toCanvasX(60.0), toCanvasY(21.5));
    ctx.lineTo(toCanvasX(55.0), toCanvasY(16.0));
    ctx.lineTo(toCanvasX(48.0), toCanvasY(12.0));
    ctx.closePath();
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.stroke();

    // Myanmar / Thailand / Malay Peninsula (East)
    ctx.beginPath();
    ctx.moveTo(toCanvasX(92.5), toCanvasY(22.0));
    ctx.lineTo(toCanvasX(94.5), toCanvasY(16.0));
    ctx.lineTo(toCanvasX(98.0), toCanvasY(10.0));
    ctx.lineTo(toCanvasX(100.0), toCanvasY(4.0));
    ctx.lineTo(toCanvasX(102.0), toCanvasY(4.0));
    ctx.lineTo(toCanvasX(102.0), toCanvasY(28.0));
    ctx.lineTo(toCanvasX(92.5), toCanvasY(28.0));
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = 'rgba(21, 128, 61, 0.45)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Highlighted Active 3D Volume Footprint (Yellow/Amber Bounding Box)
    // Matches Image 3 with exact glowing box and corner accents
    const regMinLon = activeRegion?.minLon ?? 50.0;
    const regMaxLon = activeRegion?.maxLon ?? 95.0;
    const regMinLat = activeRegion?.minLat ?? 0.0;
    const regMaxLat = activeRegion?.maxLat ?? 26.0;

    const bX = toCanvasX(regMinLon);
    const bY = toCanvasY(regMaxLat);
    const bW = toCanvasX(regMaxLon) - bX;
    const bH = toCanvasY(regMinLat) - bY;

    // Semi-transparent yellow highlighted area
    ctx.save();
    ctx.fillStyle = 'rgba(234, 179, 8, 0.16)';
    ctx.fillRect(bX, bY, bW, bH);

    // Glowing Yellow Bounding Box Outline
    ctx.strokeStyle = '#facc15'; // Bright Amber/Yellow
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 8;
    ctx.strokeRect(bX, bY, bW, bH);

    // Corner brackets on the box
    const bracketLen = 10;
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#fef08a'; // Light yellow highlights

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(bX, bY + bracketLen);
    ctx.lineTo(bX, bY);
    ctx.lineTo(bX + bracketLen, bY);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(bX + bW - bracketLen, bY);
    ctx.lineTo(bX + bW, bY);
    ctx.lineTo(bX + bW, bY + bracketLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(bX, bY + bH - bracketLen);
    ctx.lineTo(bX, bY + bH);
    ctx.lineTo(bX + bracketLen, bY + bH);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(bX + bW - bracketLen, bY + bH);
    ctx.lineTo(bX + bW, bY + bH);
    ctx.lineTo(bX + bW, bY + bH - bracketLen);
    ctx.stroke();

    // Box Label Tag inside the bounding box
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(bX + 6, bY + 6, 120, 18);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bX + 6, bY + 6, 120, 18);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('3D VOLUME DOMAIN', bX + 11, bY + 18);

    ctx.restore();

    // 4. Lat/Lon Coordinate Grid Indicators on Canvas Edges
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '8px monospace';
    ctx.fillText('60°E', toCanvasX(60.0) - 10, height - 4);
    ctx.fillText('80°E', toCanvasX(80.0) - 10, height - 4);
    ctx.fillText('100°E', toCanvasX(100.0) - 14, height - 4);
    ctx.fillText('10°N', 4, toCanvasY(10.0) + 3);
    ctx.fillText('20°N', 4, toCanvasY(20.0) + 3);
    ctx.restore();

  }, [activeRegion, variable]);

  return (
    <div className="w-80 bg-slate-950/85 backdrop-blur-md border border-cyan-500/25 shadow-2xl rounded-2xl p-4 text-slate-200 font-sans flex flex-col gap-3">
      {/* Header with Live Telemetry */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
            2D Synoptic Regional View
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
          Detail Context
        </span>
      </div>

      {/* 2D Canvas Map */}
      <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 shadow-inner bg-slate-900">
        <canvas
          ref={canvasRef}
          width={288}
          height={192}
          className="w-full h-auto block"
        />
        {/* Subtle Compass Rose Overlay */}
        <div className="absolute top-2 right-2 flex flex-col items-center bg-slate-950/70 border border-cyan-500/20 rounded p-1 text-[8px] font-mono text-cyan-300 pointer-events-none">
          <span className="font-bold text-cyan-200">N</span>
          <Compass className="w-3 h-3 text-cyan-400" />
        </div>
      </div>

      {/* Spatial Bounds Readout */}
      <div className="bg-slate-900/90 border border-cyan-500/20 rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px] font-mono">
        <div className="flex justify-between items-center text-slate-300">
          <span className="text-slate-400">Sector:</span>
          <span className="text-cyan-300 font-medium truncate max-w-[170px]">
            {activeRegion?.name || 'North Indian Ocean'}
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="text-slate-400">Lon/Lat:</span>
          <span className="text-cyan-200 tabular-nums">
            {(activeRegion?.minLon ?? 50)}°E - {(activeRegion?.maxLon ?? 95)}°E | {(activeRegion?.minLat ?? 0)}°N - {(activeRegion?.maxLat ?? 26)}°N
          </span>
        </div>
        <div className="flex justify-between items-center text-slate-300">
          <span className="text-slate-400">Depth Range:</span>
          <span className="text-amber-300 tabular-nums">0m to 2000m (40 ROMS levels)</span>
        </div>
      </div>

      {/* Sub-surface Oceanographic Telemetry */}
      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
        <div className="bg-slate-900/60 border border-cyan-500/15 rounded-lg p-1.5">
          <div className="text-[9px] text-slate-400 uppercase">Thermocline</div>
          <div className="text-[11px] font-bold text-cyan-300">120m</div>
        </div>
        <div className="bg-slate-900/60 border border-cyan-500/15 rounded-lg p-1.5">
          <div className="text-[9px] text-slate-400 uppercase">Mixed Layer</div>
          <div className="text-[11px] font-bold text-emerald-300">35m</div>
        </div>
        <div className="bg-slate-900/60 border border-cyan-500/15 rounded-lg p-1.5">
          <div className="text-[9px] text-slate-400 uppercase">Surface Curr</div>
          <div className="text-[11px] font-bold text-amber-300">0.42 m/s</div>
        </div>
      </div>

      {/* 1-Click Sector Drilldown Chips */}
      <div className="flex flex-col gap-1 mt-0.5">
        <span className="text-[10px] font-mono text-slate-400">Active Sector Focus:</span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => selectRegionAndSwitchTo3D({
              id: 'arabian_sea',
              name: 'Arabian Sea Sector',
              minLon: 52.0,
              maxLon: 77.0,
              minLat: 6.0,
              maxLat: 25.0,
              centerLon: 65.0,
              centerLat: 15.0,
              minDepth: 0,
              maxDepth: 2000,
            })}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
              activeRegion?.id === 'arabian_sea'
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900/80 border-cyan-500/20 text-slate-300 hover:bg-cyan-500/15'
            }`}
          >
            Arabian Sea
          </button>
          <button
            onClick={() => selectRegionAndSwitchTo3D({
              id: 'bay_of_bengal',
              name: 'Bay of Bengal Sector',
              minLon: 78.0,
              maxLon: 96.0,
              minLat: 6.0,
              maxLat: 24.0,
              centerLon: 88.0,
              centerLat: 15.0,
              minDepth: 0,
              maxDepth: 2000,
            })}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
              activeRegion?.id === 'bay_of_bengal'
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900/80 border-cyan-500/20 text-slate-300 hover:bg-cyan-500/15'
            }`}
          >
            Bay of Bengal
          </button>
          <button
            onClick={() => selectRegionAndSwitchTo3D({
              id: 'full_domain',
              name: 'North Indian Ocean Basin',
              minLon: 50.0,
              maxLon: 95.0,
              minLat: 0.0,
              maxLat: 26.0,
              centerLon: 72.5,
              centerLat: 13.0,
              minDepth: 0,
              maxDepth: 2000,
            })}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
              activeRegion?.id === 'full_domain' || !activeRegion?.id
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-100 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900/80 border-cyan-500/20 text-slate-300 hover:bg-cyan-500/15'
            }`}
          >
            Full Basin
          </button>
        </div>
      </div>

      {/* Return to Globe Button (Master-Detail Handshake) */}
      <button
        onClick={() => setEngineMode('cesium')}
        className="w-full mt-1 py-2 px-3 bg-gradient-to-r from-sky-600/30 to-cyan-600/30 hover:from-sky-500/40 hover:to-cyan-500/40 border border-sky-400/40 hover:border-cyan-300 rounded-xl text-xs font-mono text-sky-200 hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_16px_rgba(56,189,248,0.3)] cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-cyan-300" />
        <span>Return to Globe (Cesium Master)</span>
      </button>
    </div>
  );
};
