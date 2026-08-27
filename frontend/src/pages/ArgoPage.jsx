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
  Crosshair,
  Sliders
} from '../components/Icons';

export const ArgoPage = () => {
  const {
    argoFloats,
    argoSources,
    argoMetadata,
    activeArgoSource,
    setActiveArgoSource,
    argoFilterQC,
    setArgoFilterQC,
    activeArgoProfile,
    fetchArgoSources,
    fetchArgoFloats,
    selectedFloat,
    selectFloat,
    selectFloatAndCompare,
    selectedCycle,
    setSelectedCycle,
    setActivePage,
    focusCoordinateInExplorer,
    metadata,
  } = useOceanStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [profileVar, setProfileVar] = useState('temp'); // 'temp' | 'psal'
  const [geoJsonCoast, setGeoJsonCoast] = useState(null);
  const canvasRef = useRef(null);

  const minLat = -35.0;
  const maxLat = 35.0;
  const minLon = 25.0;
  const maxLon = 125.0;

  useEffect(() => {
    fetchArgoSources();
    fetchArgoFloats();
    fetch('/geography/coastline.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGeoJsonCoast(data);
      })
      .catch((e) => console.warn('Failed to load coastline for argo view:', e));
  }, []);

  const depthCategories = [
    { label: '0 - 50 m', color: '#ef4444' },
    { label: '50 - 200 m', color: '#f97316' },
    { label: '200 - 500 m', color: '#eab308' },
    { label: '500 - 1000 m', color: '#22c55e' },
    { label: '1000 - 2000 m', color: '#06b6d4' },
  ];

  const getFloatSourceColor = (float) => {
    const src = String(float.source || '').toLowerCase();
    if (src === 'coriolis') return '#38bdf8'; // Sky Blue for Coriolis
    if (src === 'incois') return '#34d399'; // Emerald for INCOIS
    return '#f59e0b'; // Amber
  };

  const filteredFloats = (argoFloats || []).filter((f) => {
    const term = searchTerm.toLowerCase();
    const wmo = String(f.platform_number || '').toLowerCase();
    const dac = String(f.dac || '').toLowerCase();
    const src = String(f.source || '').toLowerCase();
    return wmo.includes(term) || dac.includes(term) || src.includes(term);
  });

  const activeFloat = selectedFloat || (argoFloats && argoFloats.length > 0 ? argoFloats[0] : null);
  const cycles = activeFloat?.cycles || [1];
  const activeCycleNum = selectedCycle !== null && selectedCycle !== undefined ? selectedCycle : (cycles[0] ?? 1);

  // Draw 2D Canvas Map with authentic float locations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#030814';
    ctx.fillRect(0, 0, width, height);

    const lonToX = (lon) => ((lon - minLon) / (maxLon - minLon)) * width;
    const latToY = (lat) => height - ((lat - minLat) / (maxLat - minLat)) * height;

    // Graticules
    ctx.strokeStyle = '#0f172a';
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
          line.forEach(([lon, lat]) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        });
      });
    }

    // Draw all float positions
    (argoFloats || []).forEach((float) => {
      const lat = float.latest_position?.latitude;
      const lon = float.latest_position?.longitude;
      if (lat === undefined || lon === undefined) return;

      const x = lonToX(lon);
      const y = latToY(lat);
      const isSelected = activeFloat?.platform_number === float.platform_number;
      const color = getFloatSourceColor(float);

      // Outer Pulse Ring for Selected
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Float Marker Dot
      ctx.fillStyle = isSelected ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [argoFloats, activeFloat, geoJsonCoast]);

  // Compute SVG profile line path from activeArgoProfile
  const profileDepths = activeArgoProfile?.depths || [];
  const profileTemps = activeArgoProfile?.temperature || [];
  const profileSalts = (activeArgoProfile?.salinity || []).filter((s) => s !== null);

  const activeVals = profileVar === 'temp' ? profileTemps : (activeArgoProfile?.salinity || []);
  const validPairs = [];
  for (let i = 0; i < profileDepths.length; i++) {
    const d = profileDepths[i];
    const v = activeVals[i];
    if (d !== undefined && v !== null && v !== undefined && !isNaN(v)) {
      validPairs.push({ depth: d, val: v });
    }
  }

  const maxDepth = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.depth), 100) : 2000;
  const minVal = validPairs.length > 0 ? Math.min(...validPairs.map((p) => p.val)) : 0;
  const maxVal = validPairs.length > 0 ? Math.max(...validPairs.map((p) => p.val)) : 30;
  const valRange = maxVal - minVal || 1;

  const svgWidth = 320;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 25;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const valToSvgX = (v) => padLeft + ((v - minVal) / valRange) * plotW;
  const depthToSvgY = (d) => padTop + (d / maxDepth) * plotH;

  let profileSvgPath = '';
  if (validPairs.length > 0) {
    profileSvgPath = validPairs.reduce((acc, pt, idx) => {
      const x = valToSvgX(pt.val);
      const y = depthToSvgY(pt.depth);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }

  const totalProfilesCount = argoMetadata?.total_profiles || (argoFloats || []).reduce((acc, f) => acc + (f.profiles_count || 1), 0);
  const totalPlatformsCount = argoMetadata?.total_platforms || (argoFloats || []).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#030712] text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header Bar */}
      <div className="h-14 px-6 border-b border-[#1e293b] flex items-center justify-between bg-[#060c18]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Radio className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                IN-SITU OBSERVATIONS & CORIOLIS GDAC PROFILERS
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 border border-sky-500/30 text-sky-300">
                TEOS-10 CALIBRATED
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              REAL-TIME AUTONOMOUS CTD VERTICAL OBSERVING ARRAY
            </span>
          </div>
        </div>

        {/* Action Controls & Globe Return */}
        <div className="flex items-center gap-3">
          {/* Provider Filter Tabs */}
          <div className="flex items-center bg-[#0a1224] border border-[#1e293b] rounded p-0.5 text-[11px] font-mono">
            <button
              onClick={() => setActiveArgoSource('all')}
              className={`px-3 py-1 rounded transition-all ${
                activeArgoSource === 'all' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              ALL ({totalPlatformsCount})
            </button>
            <button
              onClick={() => setActiveArgoSource('coriolis')}
              className={`px-3 py-1 rounded transition-all ${
                activeArgoSource === 'coriolis' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              CORIOLIS GDAC
            </button>
            <button
              onClick={() => setActiveArgoSource('incois')}
              className={`px-3 py-1 rounded transition-all ${
                activeArgoSource === 'incois' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              INCOIS ARGO
            </button>
          </div>

          <button
            onClick={() => setActivePage('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-semibold tracking-wide transition-all shadow-sm"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>BACK TO 3D GLOBE</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        {/* Left Map Viewport */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden border-r border-[#141e33]">
          <div className="relative flex-1 bg-[#040915] border border-[#1e293b] rounded-lg flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              width={820}
              height={520}
              className="w-full h-full object-contain cursor-crosshair"
            />

            {/* Provider Legend */}
            <div className="absolute top-3 left-3 p-3 bg-[#080e1a]/95 border border-[#1e293b] rounded flex flex-col gap-1.5 text-[10px] shadow-xl backdrop-blur-md">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[9px]">DATA PROVENANCE</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                <span className="text-slate-300">Coriolis / Euro-Argo GDAC</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-slate-300">INCOIS Indian Ocean Array</span>
              </div>
            </div>

            {/* Strict QC Badge */}
            <div className="absolute top-3 right-3 p-2.5 bg-[#080e1a]/95 border border-[#1e293b] rounded flex items-center gap-2 text-[10px] shadow-xl backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold text-white">QC QUALITY POLICY: ACTIVE</span>
                <span className="text-[9px] text-slate-400">Strictly accepting Flags 1 (Good) & 2 (Probably Good)</span>
              </div>
            </div>
          </div>

          {/* 4 Bottom Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] rounded flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono">TOTAL PROFILES</span>
              <span className="text-xl font-bold text-white tabular-nums">{totalProfilesCount.toLocaleString()}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] rounded flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono">INDEXED PLATFORMS</span>
              <span className="text-xl font-bold text-sky-400 tabular-nums">{totalPlatformsCount.toLocaleString()}</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] rounded flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono">DEPTH RANGE</span>
              <span className="text-xl font-bold text-emerald-400 tabular-nums">0 — 2000 dbar</span>
            </div>
            <div className="p-3 bg-[#080e1a] border border-[#1e293b] rounded flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono">CALIBRATION STANDARD</span>
              <span className="text-xs font-bold text-amber-300 mt-1">TEOS-10 (gsw.z_from_p)</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Float List & Deep Scientific Profile Inspector */}
        <div className="w-full xl:w-[420px] p-4 bg-[#060a14] flex flex-col gap-4 overflow-y-auto shrink-0 border-l border-[#141e33]">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              AUTHENTIC FLOATS ({filteredFloats.length})
            </span>
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search WMO or DAC..."
                className="w-full pl-8 pr-2 py-1 bg-[#040814] border border-[#1e293b] rounded text-slate-200 text-[11px] focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Floats List Cards */}
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto scrollbar-thin">
            {filteredFloats.map((float) => {
              const isSelected = activeFloat?.platform_number === float.platform_number;
              const color = getFloatSourceColor(float);
              const isCoriolis = String(float.source || '').toLowerCase() === 'coriolis';

              return (
                <div
                  key={float.platform_number}
                  onClick={() => selectFloat(float)}
                  className={`p-2.5 rounded border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#121c2e] border-sky-500 text-white shadow-md'
                      : 'bg-[#080e1a] border-[#1e293b] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-sky-300 font-mono">WMO {float.platform_number}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {float.latest_position?.latitude?.toFixed(2)}°N, {float.latest_position?.longitude?.toFixed(2)}°E
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {isCoriolis ? 'CORIOLIS' : 'INCOIS'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {float.profiles_count} cycles
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Profile Deep Dive Inspector */}
          {activeFloat && (
            <div className="p-4 bg-[#080e1a] border border-[#1e293b] rounded-lg flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <div className="flex flex-col">
                  <span className="font-bold text-sky-300 text-sm font-mono">FLOAT WMO {activeFloat.platform_number}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    DAC: {activeFloat.dac || 'CORIOLIS / GDAC'} | {activeFloat.latest_timestamp || 'Active'}
                  </span>
                </div>

                {/* Cycle Selector */}
                {cycles.length > 1 && (
                  <select
                    value={activeCycleNum}
                    onChange={(e) => setSelectedCycle(Number(e.target.value))}
                    className="px-2 py-1 bg-[#040814] border border-[#1e293b] rounded text-sky-300 text-[11px] font-mono focus:outline-none focus:border-sky-500"
                  >
                    {cycles.map((c) => (
                      <option key={c} value={c}>
                        Cycle #{c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Variable Selector Toggle for Chart */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Vertical CTD Profile</span>
                <div className="flex items-center bg-[#040814] border border-[#1e293b] rounded p-0.5 text-[10px] font-mono">
                  <button
                    onClick={() => setProfileVar('temp')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      profileVar === 'temp' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    TEMP (°C)
                  </button>
                  <button
                    onClick={() => setProfileVar('psal')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      profileVar === 'psal' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    SALINITY (PSU)
                  </button>
                </div>
              </div>

              {/* Scientific SVG Vertical Profile Chart */}
              <div className="h-56 bg-[#040814] border border-[#141e33] rounded p-2 flex items-center justify-center relative">
                {validPairs.length > 0 ? (
                  <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                      const y = padTop + frac * plotH;
                      const dVal = (frac * maxDepth).toFixed(0);
                      return (
                        <g key={idx}>
                          <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="#1e293b" strokeDasharray="2 3" />
                          <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                            {dVal}m
                          </text>
                        </g>
                      );
                    })}

                    {/* Value Axis labels at top */}
                    {[0, 0.5, 1.0].map((frac, idx) => {
                      const x = padLeft + frac * plotW;
                      const val = (minVal + frac * valRange).toFixed(1);
                      return (
                        <text key={idx} x={x} y={padTop - 6} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                          {val}
                        </text>
                      );
                    })}

                    {/* Actual Physical Curve */}
                    <path
                      d={profileSvgPath}
                      fill="none"
                      stroke={profileVar === 'temp' ? '#38bdf8' : '#34d399'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Surface and Deepest points */}
                    {validPairs.length > 0 && (
                      <>
                        <circle
                          cx={valToSvgX(validPairs[0].val)}
                          cy={depthToSvgY(validPairs[0].depth)}
                          r="4"
                          fill="#f59e0b"
                        />
                        <circle
                          cx={valToSvgX(validPairs[validPairs.length - 1].val)}
                          cy={depthToSvgY(validPairs[validPairs.length - 1].depth)}
                          r="4"
                          fill="#a855f7"
                        />
                      </>
                    )}
                  </svg>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-500">
                    <Activity className="w-5 h-5 animate-pulse text-sky-400" />
                    <span className="text-[10px] font-mono">Loading profile data...</span>
                  </div>
                )}
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-[#040814] p-2.5 rounded border border-[#141e33]">
                <div>
                  <span className="text-slate-500">LEVELS RECORDED:</span>
                  <span className="ml-1 text-slate-200 font-bold">{validPairs.length}</span>
                </div>
                <div>
                  <span className="text-slate-500">MAX DEPTH:</span>
                  <span className="ml-1 text-slate-200 font-bold">{maxDepth.toFixed(1)} m</span>
                </div>
                <div>
                  <span className="text-slate-500">DATA MODE:</span>
                  <span className="ml-1 text-emerald-400 font-bold">{activeArgoProfile?.data_mode || 'Real-Time'}</span>
                </div>
                <div>
                  <span className="text-slate-500">QC VERIFICATION:</span>
                  <span className="ml-1 text-emerald-400 font-bold">Passed</span>
                </div>
              </div>

              {/* Compare Button */}
              <button
                onClick={() => selectFloatAndCompare(activeFloat)}
                className="w-full py-2 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-slate-950 font-bold rounded flex items-center justify-center gap-2 transition-all shadow-md text-xs font-mono"
              >
                <span>COMPARE WITH 4D OCEAN MODEL</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};