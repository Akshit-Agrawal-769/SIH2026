import React, { useState, useEffect, useRef } from 'react';
import { useOceanStore } from '../store/oceanStore';
import {
  Compass,
  Radio,
  Layers,
  Activity,
  Crosshair,
  RotateCcw,
  Search,
  Maximize2,
  Database,
  Info,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sliders
} from '../components/Icons';
import {
  lonLatToWorld,
  worldToLonLat,
  DEFAULT_INDIAN_OCEAN_BOUNDS,
  calculateNearestGridCell,
  validateCoordinates
} from '../utils/geography';

export const HomePage = () => {
  const {
    metadata,
    activeDataset,
    variable,
    setVariable,
    timeIndex,
    argoFloats,
    selectedFloat,
    selectFloat,
    focusCoordinateInExplorer,
    setActivePage,
    platformTelemetry,
  } = useOceanStore();

  const [inspectorTab, setInspectorTab] = useState('inspector'); // 'inspector' | 'station'
  const [latInput, setLatInput] = useState('12.8300');
  const [lonInput, setLonInput] = useState('69.0000');
  const [selectedCoord, setSelectedCoord] = useState({ lat: 12.83, lon: 69.00 });
  const [selectedDepth, setSelectedDepth] = useState(0);
  const [inputError, setInputError] = useState(null);
  const [geoJsonCoast, setGeoJsonCoast] = useState(null);

  const canvasRef = useRef(null);

  const minLat = metadata?.bounds?.min_lat ?? -30.0;
  const maxLat = metadata?.bounds?.max_lat ?? 30.0;
  const minLon = metadata?.bounds?.min_lon ?? 30.0;
  const maxLon = metadata?.bounds?.max_lon ?? 120.0;

  // Load Natural Earth Coastline for 2D Canvas rendering
  useEffect(() => {
    fetch('/geography/coastline.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGeoJsonCoast(data);
      })
      .catch((e) => console.warn('Failed to load 2D coastline geojson:', e));
  }, []);

  // Compute nearest model grid cell for selected point
  const nearestGrid = calculateNearestGridCell(selectedCoord.lat, selectedCoord.lon, 0.0833, {
    minLon, maxLon, minLat, maxLat
  });

  const iGrid = Math.min(1080, Math.max(0, Math.round(((selectedCoord.lon - minLon) / (maxLon - minLon)) * 1080)));
  const jGrid = Math.min(755, Math.max(0, Math.round(((selectedCoord.lat - minLat) / (maxLat - minLat)) * 755)));

  // Simulated scientific scalar values derived from geographic latitude/longitude climatology
  const tempVal = (29.5 - Math.abs(selectedCoord.lat) * 0.35 - (selectedDepth / 2000) * 22).toFixed(2);
  const saltVal = (35.2 + Math.sin(selectedCoord.lon * 0.05) * 0.8 - (selectedDepth / 2000) * 0.4).toFixed(2);

  const handleLocate = (e) => {
    if (e) e.preventDefault();
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    const valid = validateCoordinates(lat, lon, { minLon, maxLon, minLat, maxLat });
    if (!valid.isValid) {
      setInputError(valid.error);
      return;
    }
    setInputError(null);
    setSelectedCoord({ lat, lon });
  };

  const handleFitDomain = () => {
    setSelectedCoord({ lat: 0.0, lon: 75.0 });
    setLatInput('0.0000');
    setLonInput('75.0000');
  };

  const handleResetView = () => {
    setSelectedCoord({ lat: 12.83, lon: 69.00 });
    setLatInput('12.8300');
    setLonInput('69.0000');
  };

  // Draw 2D Interactive Indian Ocean Basin Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Background: Deep Indian Ocean Navy
    ctx.fillStyle = '#040b17';
    ctx.fillRect(0, 0, width, height);

    // Geographic domain transformation helper
    const lonToX = (lon) => ((lon - minLon) / (maxLon - minLon)) * width;
    const latToY = (lat) => height - ((lat - minLat) / (maxLat - minLat)) * height;

    // 1. Draw Thermal Gradient Field Overlay
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0.0, '#0c2447'); // NW Arabian Sea
    grad.addColorStop(0.3, '#0b3d68'); // Central North
    grad.addColorStop(0.5, '#0284c7'); // Tropical Equator
    grad.addColorStop(0.8, '#1e3a5f'); // Southern Indian Ocean
    grad.addColorStop(1.0, '#040d1a'); // Antarctic Convergence
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Latitude & Longitude Grid Lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    const lats = [-30, -15, 0, 15, 30];
    const lons = [30, 45, 60, 75, 90, 105, 120];

    lats.forEach((lat) => {
      const y = latToY(lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    lons.forEach((lon) => {
      const x = lonToX(lon);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    ctx.setLineDash([]);

    // 3. Draw Natural Earth Coastlines
    if (geoJsonCoast?.features) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 1;

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
      ctx.shadowBlur = 0;
    }

    // 4. Major Geographic Basin Labels
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText('Arabian', lonToX(64), latToY(18));
    ctx.fillText('Sea', lonToX(67), latToY(15));

    ctx.fillText('Bay of', lonToX(86), latToY(16));
    ctx.fillText('Bengal', lonToX(86), latToY(13));

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Indian Ocean', lonToX(72), latToY(-5));

    // 5. Render Real In-Situ Argo Float Markers
    (argoFloats || []).forEach((float) => {
      if (!float.latest_position) return;
      const fx = lonToX(float.latest_position.longitude);
      const fy = latToY(float.latest_position.latitude);

      const isSelected = selectedFloat?.platform_number === float.platform_number;

      ctx.beginPath();
      ctx.arc(fx, fy, isSelected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#040814';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 6. Selected Coordinate Pin
    const selX = lonToX(selectedCoord.lon);
    const selY = latToY(selectedCoord.lat);

    ctx.beginPath();
    ctx.arc(selX, selY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(selX, selY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Crosshair Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(selX - 14, selY);
    ctx.lineTo(selX + 14, selY);
    ctx.moveTo(selX, selY - 14);
    ctx.lineTo(selX, selY + 14);
    ctx.stroke();
  }, [geoJsonCoast, selectedCoord, argoFloats, selectedFloat, minLon, maxLon, minLat, maxLat]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = clickX / rect.width;
    const normY = clickY / rect.height;

    const lon = minLon + normX * (maxLon - minLon);
    const lat = minLat + (1.0 - normY) * (maxLat - minLat);

    setSelectedCoord({ lat, lon });
    setLatInput(lat.toFixed(4));
    setLonInput(lon.toFixed(4));
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row overflow-hidden bg-[#040711] text-slate-100 font-mono select-none">
      {/* Central 2D Basin Overview & Map Viewport */}
      <div className="flex-1 flex flex-col relative overflow-hidden p-3 sm:p-4 border-r border-[#141e33]">
        {/* Map Header Status Strip */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#141e33] text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400" />
            <span className="font-bold text-slate-200 uppercase tracking-wider">
              Indian Ocean Synoptic Basin Overview
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Domain: <strong className="text-slate-200">30°E—120°E, 30°S—30°N</strong></span>
            <span className="text-slate-600">|</span>
            <span>Floats: <strong className="text-amber-400">{argoFloats?.length || 0} In-Situ</strong></span>
          </div>
        </div>

        {/* 2D Canvas Container */}
        <div className="relative flex-1 bg-[#040915] border border-[#1e293b] flex items-center justify-center overflow-hidden">
          {/* Axis Labels Overlay (Top & Left) */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 text-[9px] text-slate-500 z-10 pointer-events-none">
            <span>30°N</span>
            <span className="mt-8">15°N</span>
            <span className="mt-8">0°</span>
            <span className="mt-8">15°S</span>
            <span className="mt-8">30°S</span>
          </div>

          <div className="absolute bottom-2 left-8 right-8 flex justify-between text-[9px] text-slate-500 z-10 pointer-events-none">
            <span>30°E</span>
            <span>45°E</span>
            <span>60°E</span>
            <span>75°E</span>
            <span>90°E</span>
            <span>105°E</span>
            <span>120°E</span>
          </div>

          {/* Interactive 2D Map Canvas */}
          <canvas
            ref={canvasRef}
            width={880}
            height={560}
            onClick={handleCanvasClick}
            className="w-full h-full object-contain cursor-crosshair"
          />

          {/* Map Overlay: Action Controls (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            <button
              onClick={handleFitDomain}
              className="px-3 py-1.5 bg-[#080e1a]/90 border border-cyan-500 text-cyan-300 hover:bg-cyan-950 text-xs font-bold transition-colors shadow-lg"
            >
              Fit Domain
            </button>
            <button
              onClick={handleResetView}
              className="px-3 py-1.5 bg-[#080e1a]/90 border border-[#1e293b] text-slate-300 hover:border-slate-500 text-xs font-bold transition-colors shadow-lg"
            >
              Reset View
            </button>
          </div>

          {/* Map Overlay: Temperature Colorbar Legend (Right) */}
          <div className="absolute top-4 right-4 z-20 p-2.5 bg-[#080e1a]/95 border border-[#1e293b] flex flex-col gap-1 text-[10px] shadow-xl">
            <span className="font-bold text-slate-300">Temperature (°C)</span>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-36 border border-slate-700"
                style={{
                  background: 'linear-gradient(to bottom, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #1e3a8a)',
                }}
              />
              <div className="flex flex-col justify-between h-36 text-[9px] text-slate-400 font-mono">
                <span>31.0</span>
                <span>27.5</span>
                <span>24.0</span>
                <span>20.5</span>
                <span>17.0</span>
                <span>13.5</span>
                <span>10.0</span>
                <span>7.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Inspector & Station Tabbed Panel */}
      <div className="w-full xl:w-96 p-4 bg-[#060a14] flex flex-col gap-4 overflow-y-auto shrink-0 border-l border-[#141e33]">
        {/* Panel Tabs */}
        <div className="flex items-center border-b border-[#1e293b]">
          <button
            onClick={() => setInspectorTab('inspector')}
            className={`flex-1 py-2 text-xs font-bold tracking-wider transition-colors border-b-2 ${
              inspectorTab === 'inspector'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            INSPECTOR
          </button>
          <button
            onClick={() => setInspectorTab('station')}
            className={`flex-1 py-2 text-xs font-bold tracking-wider transition-colors border-b-2 ${
              inspectorTab === 'station'
                ? 'border-amber-400 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            STATION
          </button>
        </div>

        {inspectorTab === 'inspector' ? (
          <div className="flex flex-col gap-4">
            {/* Go To Location Section */}
            <div className="p-3.5 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Go To Location</span>
                </span>
                <span className="text-[10px] text-slate-500">EPSG:4326</span>
              </div>

              <form onSubmit={handleLocate} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Latitude (°N)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      placeholder="12.8300"
                      className="px-2 py-1.5 bg-[#040814] border border-[#1e293b] text-slate-100 text-xs font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Longitude (°E)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lonInput}
                      onChange={(e) => setLonInput(e.target.value)}
                      placeholder="69.0000"
                      className="px-2 py-1.5 bg-[#040814] border border-[#1e293b] text-slate-100 text-xs font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {inputError && (
                  <span className="text-[10px] text-amber-400">{inputError}</span>
                )}

                <button
                  type="submit"
                  className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider transition-colors shadow-md"
                >
                  LOCATE
                </button>
              </form>
            </div>

            {/* Selected Coordinate Details */}
            <div className="p-3.5 bg-[#080e1a] border border-[#1e293b] flex flex-col gap-3 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                SELECTED POINT
              </span>
              <div className="text-sm font-bold text-cyan-300">
                {selectedCoord.lat >= 0 ? `${selectedCoord.lat.toFixed(4)}° N` : `${Math.abs(selectedCoord.lat).toFixed(4)}° S`},{' '}
                {selectedCoord.lon >= 0 ? `${selectedCoord.lon.toFixed(4)}° E` : `${Math.abs(selectedCoord.lon).toFixed(4)}° W`}
              </div>

              <div className="p-2.5 bg-[#040814] border border-[#141e33] flex flex-col gap-1 text-[11px]">
                <span className="text-slate-500 uppercase text-[9px]">NEAREST MODEL POINT</span>
                <div className="flex items-center justify-between text-slate-200 font-bold">
                  <span>{nearestGrid.nearestLat.toFixed(2)}° N, {nearestGrid.nearestLon.toFixed(2)}° E</span>
                  <span className="text-slate-400 font-normal text-[10px]">(i: {iGrid}, j: {jGrid})</span>
                </div>
              </div>

              {/* Depth Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">DEPTH LEVEL</label>
                <select
                  value={selectedDepth}
                  onChange={(e) => setSelectedDepth(parseInt(e.target.value, 10))}
                  className="px-2 py-1.5 bg-[#040814] border border-[#1e293b] text-slate-200 text-xs font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={0}>Surface (0 m)</option>
                  <option value={50}>50 m</option>
                  <option value={100}>100 m</option>
                  <option value={200}>200 m</option>
                  <option value={500}>500 m</option>
                  <option value={1000}>1000 m</option>
                  <option value={2000}>2000 m</option>
                </select>
              </div>

              {/* Physical Properties Values */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#141e33]">
                <div className="p-2 bg-[#040814] border border-[#141e33] flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase">TEMPERATURE</span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">
                    {tempVal} <span className="text-[10px] font-normal text-slate-400">°C</span>
                  </span>
                </div>
                <div className="p-2 bg-[#040814] border border-[#141e33] flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase">SALINITY</span>
                  <span className="text-sm font-bold text-teal-300 tabular-nums">
                    {saltVal} <span className="text-[10px] font-normal text-slate-400">PSU</span>
                  </span>
                </div>
              </div>

              {/* Action: Focus in 3D Explorer */}
              <button
                onClick={() => focusCoordinateInExplorer(selectedCoord.lat, selectedCoord.lon, `Point (${selectedCoord.lat.toFixed(2)}°, ${selectedCoord.lon.toFixed(2)} resilience)`)}
                className="w-full py-2 mt-1 bg-[#0c1424] hover:bg-cyan-950 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>OPEN IN 3D EXPLORER</span>
              </button>
            </div>
          </div>
        ) : (
          /* Station Telemetry Tab */
          <div className="p-4 bg-[#080e1a] border border-amber-500/40 flex flex-col gap-3 text-xs">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="font-bold text-white text-xs">{platformTelemetry.name}</span>
                <span className="text-[10px] text-slate-400">ID: {platformTelemetry.id}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-[#040814] border border-[#141e33]">
                <span className="text-[9px] text-slate-500 uppercase">SST</span>
                <div className="text-amber-300 font-bold">{platformTelemetry.sea_surface_temp} °C</div>
              </div>
              <div className="p-2 bg-[#040814] border border-[#141e33]">
                <span className="text-[9px] text-slate-500 uppercase">SALINITY</span>
                <div className="text-teal-300 font-bold">{platformTelemetry.salinity} PSU</div>
              </div>
              <div className="p-2 bg-[#040814] border border-[#141e33]">
                <span className="text-[9px] text-slate-500 uppercase">WAVE HEIGHT (Hs)</span>
                <div className="text-sky-300 font-bold">{platformTelemetry.wave_height_hs} m</div>
              </div>
              <div className="p-2 bg-[#040814] border border-[#141e33]">
                <span className="text-[9px] text-slate-500 uppercase">WIND SPEED</span>
                <div className="text-slate-200 font-bold">{platformTelemetry.wind_speed} kts</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e293b] text-[10px] text-slate-400">
              <span>Status: <strong className="text-emerald-400 font-bold">OPERATIONAL</strong></span>
              <span>Battery: <strong className="text-slate-200">{platformTelemetry.battery_level}%</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};