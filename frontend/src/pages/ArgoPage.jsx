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
  Sliders,
  Globe,
  Database,
} from 'lucide-react';
import { normalizeTrajectory } from '../utils/argo';
import { ArgoCycleNavigator } from '../components/ArgoCycleNavigator';
import { ArgoProfile } from '../components/ArgoProfile';
import { useArgoTrajectory } from '../hooks/useArgoTrajectory';

export const ArgoPage = () => {
  const {
    argoFloats,
    argoSources,
    argoMetadata,
    activeArgoSource,
    setActiveArgoSource,
    activeArgoProfile,
    fetchArgoSources,
    fetchArgoFloats,
    selectedFloat,
    selectFloat,
    setActivePage,
  } = useOceanStore();

  const { activeCycle } = useArgoTrajectory();

  const [searchTerm, setSearchTerm] = useState('');
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

  // Draw 2D Canvas Map with authentic float locations & multi-cycle trajectory
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, width, height);

    const lonToX = (lon) => ((lon - minLon) / (maxLon - minLon)) * width;
    const latToY = (lat) => height - ((lat - minLat) / (maxLat - minLat)) * height;

    // Graticules
    ctx.strokeStyle = '#0b1324';
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

    // Draw Multi-Cycle Trajectory for selectedFloat if available
    if (activeFloat?.trajectory) {
      const normTraj = normalizeTrajectory(activeFloat.trajectory, activeFloat.cycles);
      if (normTraj.length >= 2) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        normTraj.forEach((pt, idx) => {
          const x = lonToX(pt.longitude);
          const y = latToY(pt.latitude);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw small cycle dots
        normTraj.forEach((pt) => {
          const x = lonToX(pt.longitude);
          const y = latToY(pt.latitude);
          const isAct = pt.cycleNumber === activeCycle;
          ctx.fillStyle = isAct ? '#38bdf8' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(x, y, isAct ? 4 : 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
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
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Float Marker Dot
      ctx.fillStyle = isSelected ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [argoFloats, activeFloat, activeCycle, geoJsonCoast]);

  const totalProfilesCount = argoMetadata?.total_profiles || (argoFloats || []).reduce((acc, f) => acc + (f.profiles_count || 1), 0);
  const totalPlatformsCount = argoMetadata?.total_platforms || (argoFloats || []).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--surface-base)] text-slate-200 overflow-hidden font-mono select-none">
      {/* Top Header Bar */}
      <div className="h-9 px-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--surface-header)] shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
          <span className="font-bold text-xs text-slate-100 tracking-wide uppercase">
            In-Situ Ocean Observations & Coriolis GDAC Array
          </span>
          <span className="px-1.5 py-0.2 rounded-[2px] text-[9px] bg-sky-950 border border-sky-400 text-sky-300">
            TEOS-10 CALIBRATED
          </span>
        </div>

        {/* Action Controls & Globe Return */}
        <div className="flex items-center gap-2 text-xs">
          {/* Provider Filter Tabs */}
          <div className="segmented-control">
            <button
              onClick={() => setActiveArgoSource('all')}
              className={`segmented-option ${activeArgoSource === 'all' ? 'segmented-option-active font-bold text-sky-400' : ''}`}
            >
              ALL ({totalPlatformsCount})
            </button>
            <button
              onClick={() => setActiveArgoSource('coriolis')}
              className={`segmented-option ${activeArgoSource === 'coriolis' ? 'segmented-option-active font-bold text-sky-400' : ''}`}
            >
              CORIOLIS
            </button>
            <button
              onClick={() => setActiveArgoSource('incois')}
              className={`segmented-option ${activeArgoSource === 'incois' ? 'segmented-option-active font-bold text-sky-400' : ''}`}
            >
              INCOIS
            </button>
          </div>

          <button
            onClick={() => setActivePage('home')}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--surface-well)] hover:bg-[var(--surface-well-hover)] border border-[var(--border-hairline)] text-sky-300 text-[11px] rounded-[2px] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>3D EXPLORER</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        {/* Left Map Viewport */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden border-r border-[var(--border-hairline)]">
          <div className="relative flex-1 bg-[var(--surface-base)] border border-[var(--border-hairline)] rounded-sm flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              width={820}
              height={520}
              className="w-full h-full object-contain cursor-crosshair"
            />

            {/* Provider Legend */}
            <div className="absolute top-2 left-2 p-2 bg-[var(--surface-rack-backdrop)] border border-[var(--border-hairline)] rounded-sm flex flex-col gap-1 text-[9px] shadow-xl backdrop-blur-md">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px]">DATA PROVENANCE</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="text-slate-300">Coriolis / Euro-Argo GDAC</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-slate-300">INCOIS Indian Ocean Array</span>
              </div>
            </div>

            {/* Strict QC Badge */}
            <div className="absolute top-2 right-2 p-2 bg-[var(--surface-rack-backdrop)] border border-[var(--border-hairline)] rounded-sm flex items-center gap-1.5 text-[9px] shadow-xl backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={1.75} />
              <div className="flex flex-col">
                <span className="font-bold text-slate-200">QC POLICY ACTIVE</span>
                <span className="text-[8px] text-slate-400">Strictly accepting Flags 1 & 2</span>
              </div>
            </div>
          </div>

          {/* 4 Bottom Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs font-mono">
            <div className="p-2 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">TOTAL PROFILES</span>
              <span className="text-base font-bold text-slate-100 tabular-nums">{totalProfilesCount.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">INDEXED PLATFORMS</span>
              <span className="text-base font-bold text-sky-400 tabular-nums">{totalPlatformsCount.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">DEPTH SPAN</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">0 — 2000 dbar</span>
            </div>
            <div className="p-2 bg-[var(--surface-well)] border border-[var(--border-hairline)] rounded-sm flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">STANDARD</span>
              <span className="text-xs font-bold text-amber-300 mt-0.5">TEOS-10 (gsw.z_from_p)</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Float Dossier & Deep Scientific Profile Inspector */}
        <div className="w-full xl:w-96 p-3 bg-[var(--surface-rack)] flex flex-col gap-2.5 overflow-y-auto shrink-0 border-l border-[var(--border-hairline)]">
          {activeFloat && (
            <>
              <ArgoCycleNavigator />
              <ArgoProfile activeCycle={activeCycle} />
            </>
          )}

          {/* Float Array Selector */}
          <div className="instrument-well p-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-wider">
              <span>ACTIVE ARGO PLATFORMS</span>
              <span className="text-amber-400">{filteredFloats.length} loaded</span>
            </div>

            <div className="relative">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search WMO or provider..."
                className="w-full pl-6 pr-2 py-0.5 bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-200 text-[10px] focus:outline-none focus:border-amber-400 rounded-[2px]"
              />
            </div>

            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
              {filteredFloats.map((fl) => {
                const isSelected = activeFloat?.platform_number === fl.platform_number;
                return (
                  <button
                    key={fl.platform_number}
                    onClick={() => selectFloat(fl)}
                    className={`flex items-center justify-between p-1 rounded-[2px] text-left transition-all ${
                      isSelected
                        ? 'bg-amber-950/60 border border-amber-400 text-amber-200 font-bold'
                        : 'bg-[var(--surface-base)] border border-[var(--border-hairline)] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>WMO {fl.platform_number}</span>
                    <span className="text-[9px] text-slate-500 shrink-0">
                      {fl.profiles_count || fl.cycles?.length || 1} cyc
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};