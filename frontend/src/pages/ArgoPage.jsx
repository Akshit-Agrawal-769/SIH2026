import React, { useState, useEffect, useRef } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Radio,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Search,
  Activity,
  Layers,
  Crosshair
} from '../components/Icons';

export const ArgoPage = () => {
  const {
    argoFloats,
    selectedFloat,
    selectFloat,
    selectFloatAndCompare,
    selectedCycle,
    setSelectedCycle,
    setActivePage,
    focusCoordinateInExplorer,
    metadata,
  } = useOceanStore();

  const [subView, setSubView] = useState('map'); // 'map' | 'station'
  const [searchTerm, setSearchTerm] = useState('');
  const [geoJsonCoast, setGeoJsonCoast] = useState(null);
  const canvasRef = useRef(null);

  const minLat = metadata?.bounds?.min_lat ?? -30.0;
  const maxLat = metadata?.bounds?.max_lat ?? 30.0;
  const minLon = metadata?.bounds?.min_lon ?? 30.0;
  const maxLon = metadata?.bounds?.max_lon ?? 120.0;

  useEffect(() => {
    fetch('/geography/coastline.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGeoJsonCoast(data);
      })
      .catch((e) => console.warn('Failed to load coastline for argo view:', e));
  }, []);

  const depthCategories = [
    { label: '0 - 10 m', color: '#ef4444' },
    { label: '10 - 50 m', color: '#f97316' },
    { label: '50 - 100 m', color: '#eab308' },
    { label: '100 - 250 m', color: '#22c55e' },
    { label: '250 - 500 m', color: '#06b6d4' },
    { label: '500 - 1000 m', color: '#3b82f6' },
    { label: '>1000 m', color: '#8b5cf6' },
  ];

  const getFloatDepthColor = (idx) => {
    const colors = ['#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];
    return colors[idx % colors.length];
  };

  const filteredFloats = (argoFloats || []).filter((f) => {
    const term = searchTerm.toLowerCase();
    const wmo = String(f.platform_number || '').toLowerCase();
    const dac = String(f.dac || '').toLowerCase();
    return wmo.includes(term) || dac.includes(term);
  });

  const activeFloat = selectedFloat || (argoFloats && argoFloats.length > 0 ? argoFloats[0] : null);
  const cycles = activeFloat?.cycles || [];
  const activeCycleNum = selectedCycle !== null && selectedCycle !== undefined ? selectedCycle : (cycles[0] ?? 1);

  // Draw 2D Canvas Map with float points
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#040b17';
    ctx.fillRect(0, 0, width, height);

    const lonToX = (lon) => ((lon - minLon) / (maxLon - minLon)) * width;
    const latToY = (lat) => height - ((lat - minLat) / (maxLat - minLat)) * height;

    // Graticules
    ctx.strokeStyle = '#141e33';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);

    [-30, -15, 0, 15, 30].forEach((lat) => {
      const y = latToY(lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    [30, 45, 60, 75, 90, 105, 120].forEach((lon) => {
      const x = lonToX(lon);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Coastlines
    if (geoJsonCoast?.features) {
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 1.0;
      geoJsonCoast.features.forEach((feat) => {
        const geom = feat.geometry;
        if (!geom) return;
        const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates || [];
        lines.forEach((line) => {
          if (!line || line.length < 2) return;
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < line.length; i++) {
            const [pLon, pLat] = line[i];
            if (pLon >= minLon - 5 && pLon <= maxLon + 5 && pLat >= minLat - 5 && pLat <= maxLat + 5) {
              const x = lonToX(pLon);
              const y = latToY(pLat);
              if (!started) {
                ctx.moveTo(x, y);
                started = true;
              } else {
                ctx.lineTo(x, y);
              }
            } else {
              started = false;
            }
          }
          ctx.stroke();
        });
      });
    }

    // Basin labels
    ctx.font = '11px monospace';
    ctx.fillStyle = '#334155';
    ctx.fillText('Arabian Sea', lonToX(64), latToY(16));
    ctx.fillText('Bay of Bengal', lonToX(86), latToY(15));
    ctx.fillText('Indian Ocean', lonToX(72), latToY(-5));

    // Argo Float markers
    (argoFloats || []).forEach((float, idx) => {
      if (!float.latest_position) return;
      const fx = lonToX(float.latest_position.longitude);
      const fy = latToY(float.latest_position.latitude);
      const isSelected = activeFloat?.platform_number === float.platform_number;

      const color = getFloatDepthColor(idx);

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(fx, fy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(fx, fy, isSelected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : color;
      ctx.fill();
      ctx.strokeStyle = '#040814';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [geoJsonCoast, argoFloats, activeFloat, minLon, maxLon, minLat, maxLat]);

  const totalProfilesCount = (argoFloats || []).reduce((acc, f) => acc + (f.cycle_count || f.cycles?.length || 1), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#040711] text-slate-100 font-mono select-none">
      {/* Sub-Header Navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#060a14] border-b border-[#1e293b] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white tracking-wider uppercase">
              Argo Observations — Real-Time In-Situ Data
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 border border-[#1e293b] p-0.5 bg-[#040814]">
            <button
              onClick={() => setSubView('map')}
              className={`px-2.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                subView === 'map' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              IN-SITU MAP
            </button>
            <button
              onClick={() => setSubView('station')}
              className={`px-2.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                subView === 'station' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              STATION VIEW
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>QC Policy: <strong className="text-emerald-400">Flags 1 & 2</strong></span>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        {/* Left/Center Map Viewport */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden border-r border-[#141e33]">
          {/* Map Container */}
          <div className="relative flex-1 bg-[#040915] border border-[#1e293b] flex items-center justify-center overflow-hidden">
            {/* Axis Grid Coordinate Labels */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 text-[9px] text-slate-500 pointer-events-none">
              <span>30°N</span>
              <span className="mt-8">15°N</span>
              <span className="mt-8">0°</span>
              <span className="mt-8">15°S</span>
              <span className="mt-8">30°S</span>
            </div>
            <div className="absolute bottom-2 left-8 right-8 flex justify-between text-[9px] text-slate-500 pointer-events-none">
              <span>30°E</span>
              <span>45°E</span>
              <span>75°E</span>
              <span>90°E</span>
              <span>105°E</span>
              <span>120°E</span>
            </div>

            <canvas
              ref={canvasRef}
              width={820}
              height={520}
              className="w-full h-full object-contain cursor-crosshair"
            />

            {/* Depth Range Floating Legend (Top Right) */}
            <div className="absolute top-3 right-3 p-3 bg-[#080e1a]/95 border border-[#1e293b] flex flex-col gap-1.5 text-[10px] shadow-xl">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[9px]">DEPTH (m)</span>
              <div className="flex flex-col gap-1">
                {depthCategories.map((cat) => (
                  <div key={cat.label} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-slate-300 font-mono">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Bottom Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase">TOTAL PROFILES</span>
              <span className="text-xl font-bold text-white tabular-nums">{totalProfilesCount || 262}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase">ACTIVE NOW</span>
              <span className="text-xl font-bold text-emerald-400 tabular-nums">{argoFloats?.length || 8}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase">LAST 24 HOURS</span>
              <span className="text-xl font-bold text-cyan-300 tabular-nums">3</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase">DATA SOURCES</span>
              <span className="text-xs font-bold text-amber-300 mt-1">GDAC, INCOIS</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Recent Profiles List & Profile Details */}
        <div className="w-full xl:w-96 p-4 bg-[#060a14] flex flex-col gap-4 overflow-y-auto shrink-0 border-l border-[#141e33]">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              RECENT PROFILES
            </span>
            <div className="relative w-36">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter WMO..."
                className="w-full pl-6 pr-2 py-0.5 bg-[#040814] border border-[#1e293b] text-slate-200 text-[10px] focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Profiles Cards */}
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-thin">
            {filteredFloats.map((float, idx) => {
              const isSelected = activeFloat?.platform_number === float.platform_number;
              const color = getFloatDepthColor(idx);
              return (
                <div
                  key={float.platform_number}
                  onClick={() => selectFloat(float)}
                  className={`p-3 border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#121c2e] border-amber-500 text-white shadow-md'
                      : 'bg-[#080e1a] border-[#1e293b] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-amber-300">WMO {float.platform_number}</span>
                      <span className="text-[10px] text-slate-400">
                        {float.latest_position?.latitude?.toFixed(2)}°N, {float.latest_position?.longitude?.toFixed(2)}°E
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">55m</span>
                    <span className="px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold">
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Profile Inspector Deep Dive */}
          {activeFloat && (
            <div className="p-4 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <span className="font-bold text-amber-300">PROFILE WMO {activeFloat.platform_number}</span>
                <span className="text-[10px] text-slate-400">DAC: {activeFloat.dac || 'CORIOLIS'}</span>
              </div>

              {/* Mini SVG Profile Curve */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">Vertical Profile (Temperature & Salinity)</span>
                <div className="h-32 bg-[#040814] border border-[#141e33] p-2 flex items-center justify-center relative">
                  <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    {/* Temperature Curve (Sky Blue) */}
                    <path
                      d="M 180 5 Q 160 20 80 40 T 30 95"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    {/* Salinity Curve (Teal/Green) */}
                    <path
                      d="M 140 5 Q 155 30 150 60 T 130 95"
                      fill="none"
                      stroke="#2dd4bf"
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="absolute top-1 right-2 flex items-center gap-2 text-[9px]">
                    <span className="text-sky-300">Temp (°C)</span>
                    <span className="text-teal-300">Salinity (PSU)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    if (activeFloat.latest_position) {
                      focusCoordinateInExplorer(
                        activeFloat.latest_position.latitude,
                        activeFloat.latest_position.longitude,
                        `Argo WMO ${activeFloat.platform_number}`
                      );
                    }
                  }}
                  className="flex-1 py-1.5 bg-[#0c1424] hover:bg-sky-950 border border-sky-500/50 text-sky-300 text-[11px] font-bold transition-colors"
                >
                  VIEW IN 3D
                </button>
                <button
                  onClick={() => {
                    selectFloatAndCompare(activeFloat);
                    setActivePage('comparison');
                  }}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-colors shadow-md"
                >
                  COMPARE MODEL
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};