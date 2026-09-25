import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useShallow } from 'zustand/react/shallow';
import { X, Maximize2, Minimize2, RotateCcw, Play, Pause, AlertTriangle, CheckCircle, Database, Radio, ArrowDown } from 'lucide-react';
import { useOceanStore } from '../store/useOceanStore';
import {
  canonicalInstrumentId,
  fetchInstrumentProfile,
  fetchInstruments,
  fetchOceanTile,
  InstrumentProfileResponse,
  OceanTileData
} from '../api/client';
import { renderTileToCanvas, sampleColormap, sampleOceanDataAt } from '../rendering/colormaps';
import { GRID } from '../rendering/grid';
import { scalePosition } from '../rendering/scale';
import { mackenzieInRange, mackenzieSoundSpeed } from '../science/soundSpeed';

const CUBE_W = 10;
const CUBE_L = 10;
const CUBE_H = 14; // y = +7 is the sea surface, y = -7 is 2000 m
const MAX_DEPTH = 2000;
const HALF_WINDOW_DEG = 5; // the cube top shows +/- 5 degrees around the selected point
const ACCENT = 0x14b8a6;

const depthToY = (d: number) => CUBE_H / 2 - (Math.min(Math.max(d, 0), MAX_DEPTH) / MAX_DEPTH) * CUBE_H;

/** Crop the rendered field to a lon/lat window (canvas rows run north -> south). */
function cropWindow(full: HTMLCanvasElement, lon: number, lat: number): HTMLCanvasElement {
  const col = (x: number) => Math.round((x - GRID.lon0) / GRID.dlon);
  const row = (y: number) => Math.round((y - GRID.lat0) / GRID.dlat);
  const c0 = col(lon - HALF_WINDOW_DEG);
  const c1 = col(lon + HALF_WINDOW_DEG);
  const r0 = row(lat - HALF_WINDOW_DEG);
  const r1 = row(lat + HALF_WINDOW_DEG);
  const out = document.createElement('canvas');
  out.width = 256;
  out.height = 256;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.imageSmoothingEnabled = false;
  const sx = c0, sw = c1 - c0 + 1;
  const sy = GRID.height - 1 - r1, sh = r1 - r0 + 1;
  // Portions outside the served grid stay transparent (no data), never filled.
  ctx.drawImage(full, sx, sy, sw, sh, 0, 0, 256, 256);
  return out;
}

function wallTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(38, 38, 38, 0.35)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.fillStyle = 'rgba(229,229,229,0.85)';
  ctx.font = '14px monospace';
  for (const d of [0, 100, 250, 500, 1000, 1500, 2000]) {
    const y = Math.min(c.height - 2, (d / MAX_DEPTH) * c.height + 1);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
    ctx.fillText(`${d} m`, 8, Math.max(16, y - 4));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      const map = (m as THREE.MeshBasicMaterial).map;
      if (map) map.dispose();
      m.dispose();
    }
  });
}

const ARGO_KEY: Record<string, 'temperature' | 'salinity' | 'chlorophyll' | undefined> = {
  temperature: 'temperature',
  salinity: 'salinity',
  chlorophyll: 'chlorophyll'
};

export const OceanWaterCubeModal: React.FC = () => {
  const { target, closeWaterBlock, selectedTime, catalog, storeVariable, colorRange, colorPalette, scaleType } = useOceanStore(
    useShallow((s) => ({
      target: s.activeWaterBlockTarget,
      closeWaterBlock: s.closeWaterBlock,
      selectedTime: s.selectedTime,
      catalog: s.catalog,
      storeVariable: s.selectedVariable,
      colorRange: s.colorRange,
      colorPalette: s.colorPalette,
      scaleType: s.scaleType
    }))
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeVar, setActiveVar] = useState<string>(storeVariable);
  const [sliceDepth, setSliceDepth] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tile, setTile] = useState<OceanTileData | null>(null);
  const [tileState, setTileState] = useState<'loading' | 'ok' | 'nodata'>('loading');
  const [profile, setProfile] = useState<InstrumentProfileResponse | null>(null);
  const [profileNote, setProfileNote] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const sceneRef = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; renderer: THREE.WebGLRenderer;
    group: THREE.Group; topMat: THREE.MeshBasicMaterial; slice: THREE.Mesh; argo: THREE.Group; mld: THREE.Mesh;
  } | null>(null);

  // Scene: created once per opened target, fully disposed on close.
  useEffect(() => {
    if (!target || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0a');
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 1000);
    camera.position.set(16, 11, 20);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxDistance = 50;
    controls.minDistance = 6;

    const group = new THREE.Group();
    scene.add(group);
    const walls = wallTexture();
    const wallMat = () => new THREE.MeshBasicMaterial({ map: walls, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const topMat = new THREE.MeshBasicMaterial({ color: 0x262626, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x171717, transparent: true, opacity: 0.9 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(CUBE_W, CUBE_H, CUBE_L),
      [wallMat(), wallMat(), topMat, floorMat, wallMat(), wallMat()]);
    group.add(box);
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_W, CUBE_H, CUBE_L)),
      new THREE.LineBasicMaterial({ color: ACCENT })));

    // Depth plane (textured only where a gridded level exists).
    const sliceGeo = new THREE.PlaneGeometry(CUBE_W * 0.99, CUBE_L * 0.99);
    sliceGeo.rotateX(Math.PI / 2); // texture top (north) -> +Z, same as the box top face
    const slice = new THREE.Mesh(sliceGeo, new THREE.MeshBasicMaterial({ color: 0x737373, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    slice.position.y = depthToY(0);
    group.add(slice);

    // North marker on the +Z edge of the top face.
    const north = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 12), new THREE.MeshBasicMaterial({ color: 0xe5e5e5 }));
    north.rotation.x = Math.PI / 2;
    north.position.set(0, CUBE_H / 2 + 0.2, CUBE_L / 2 + 0.6);
    group.add(north);

    const argo = new THREE.Group();
    group.add(argo);
    const mldGeo = new THREE.PlaneGeometry(CUBE_W * 0.98, CUBE_L * 0.98);
    mldGeo.rotateX(Math.PI / 2);
    const mld = new THREE.Mesh(mldGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    mld.visible = false;
    group.add(mld);

    sceneRef.current = { scene, camera, controls, renderer, group, topMat, slice, argo, mld };

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (autoRotateRef.current) group.rotation.y += 0.003;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWaterBlock(); };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      controls.dispose();
      disposeObject(scene);
      walls.dispose();
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [target, closeWaterBlock]);

  // Real gridded field for the selected variable at the timeline's timestep.
  useEffect(() => {
    if (!target) return;
    let active = true;
    const meta = catalog?.variables[activeVar];
    const hasDate = meta?.timesteps.includes(selectedTime.slice(0, 10));
    setTileState('loading');
    if (!meta || !hasDate) {
      setTile(null);
      setTileState('nodata');
      return;
    }
    fetchOceanTile(activeVar, selectedTime, meta.depths[0])
      .then((t) => { if (active) { setTile(t); setTileState('ok'); } })
      .catch(() => { if (active) { setTile(null); setTileState('nodata'); } });
    return () => { active = false; };
  }, [target, activeVar, selectedTime, catalog]);

  const range: [number, number] = activeVar === storeVariable ? colorRange : (catalog?.variables[activeVar]?.display_range ?? [0, 1]);
  const palette = activeVar === storeVariable ? colorPalette : activeVar === 'salinity' || activeVar === 'mld' ? 'viridis' : activeVar === 'chlorophyll' ? 'gfdl_chl' : activeVar === 'currents' ? 'turbo' : 'noaa_sst';
  const isLog = activeVar === storeVariable ? scaleType === 'log' : activeVar === 'chlorophyll';

  // Apply the field texture to the top face and to the depth plane when it sits on a real level.
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || !target) return;
    const oldTop = sc.topMat.map;
    const sliceMat = sc.slice.material as THREE.MeshBasicMaterial;
    const oldSlice = sliceMat.map;
    if (tile) {
      const full = renderTileToCanvas(tile, { palette, customRange: range, scaleType: isLog ? 'log' : 'linear', opacity: 1 });
      const tex = new THREE.CanvasTexture(cropWindow(full, target.lon, target.lat));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      sc.topMat.map = tex;
      sc.topMat.color.set(0xffffff);
      const onLevel = catalog?.variables[activeVar]?.depths.some((d) => Math.abs(d - sliceDepth) < 1e-6);
      sliceMat.map = onLevel ? tex : null;
      sliceMat.color.set(onLevel ? 0xffffff : 0x737373);
      sliceMat.opacity = onLevel ? 0.9 : 0.18;
    } else {
      sc.topMat.map = null;
      sc.topMat.color.set(0x262626);
      sliceMat.map = null;
      sliceMat.color.set(0x737373);
      sliceMat.opacity = 0.18;
    }
    sc.topMat.needsUpdate = true;
    sliceMat.needsUpdate = true;
    if (oldTop && oldTop !== sc.topMat.map) oldTop.dispose();
    if (oldSlice && oldSlice !== oldTop && oldSlice !== sliceMat.map) oldSlice.dispose();
    sc.slice.position.y = depthToY(sliceDepth);
  }, [tile, sliceDepth, palette, range[0], range[1], isLog, target, activeVar, catalog]);

  // Real Argo profile: the target float, or the nearest catalogued float (distance is reported).
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setProfileLoading(true);
    setProfile(null);
    (async () => {
      let id = target.instrumentId ? canonicalInstrumentId(target.instrumentId) : null;
      let note = '';
      if (!id) {
        const fc = await fetchInstruments();
        let best: { id: string; km: number } | null = null;
        for (const f of fc.features) {
          const [lo, la] = f.geometry.coordinates;
          const dLat = ((la - target.lat) * Math.PI) / 180;
          const dLon = ((lo - target.lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((la * Math.PI) / 180) * Math.cos((target.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          const km = 12742 * Math.asin(Math.sqrt(a));
          if (!best || km < best.km) best = { id: f.id, km };
        }
        if (best && best.km <= 500) {
          id = best.id;
          note = `Nearest catalogued float, ${best.km.toFixed(0)} km from the selected point`;
        } else {
          note = best ? `No float within 500 km (nearest ${best.km.toFixed(0)} km)` : 'No floats catalogued';
        }
      }
      if (id) {
        const p = await fetchInstrumentProfile(id, controller.signal);
        setProfile(p);
      }
      setProfileNote(note);
    })()
      .catch((err) => { if (err?.name !== 'AbortError') setProfileNote('Profile could not be loaded'); })
      .finally(() => setProfileLoading(false));
    return () => controller.abort();
  }, [target]);

  // Draw the measured profile as a vertical column of coloured levels, plus its observed MLD.
  // The column uses its own (labelled) range: a surface colour range would saturate at depth.
  const argoKey = ARGO_KEY[activeVar];
  const columnRange = useMemo<[number, number] | null>(() => {
    if (!profile || !argoKey) return null;
    const vals = profile.measurements.map((m) => m[argoKey]).filter((v): v is number => v !== null && v !== undefined);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
  }, [profile, argoKey]);
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || !target) return;
    disposeObject(sc.argo);
    sc.argo.clear();
    sc.mld.visible = false;
    if (!profile) return;
    const x = ((profile.longitude - target.lon) / HALF_WINDOW_DEG) * (CUBE_W / 2);
    const z = ((profile.latitude - target.lat) / HALF_WINDOW_DEG) * (CUBE_L / 2);
    const px = Math.max(-CUBE_W / 2 + 0.3, Math.min(CUBE_W / 2 - 0.3, x));
    const pz = Math.max(-CUBE_L / 2 + 0.3, Math.min(CUBE_L / 2 - 0.3, z));
    const levels = profile.measurements.filter((m) => argoKey && m[argoKey] !== null && m[argoKey] !== undefined && m.depth <= MAX_DEPTH);
    const geo = new THREE.BoxGeometry(0.35, 0.06, 0.35);
    for (const m of levels) {
      const v = m[argoKey!] as number;
      const t = scalePosition(v, columnRange![0], columnRange![1], isLog) ?? 0;
      const c = sampleColormap(t, palette);
      const mesh = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.r / 255, c.g / 255, c.b / 255) }));
      mesh.position.set(px, depthToY(m.depth), pz);
      sc.argo.add(mesh);
    }
    geo.dispose();
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, CUBE_H / 2, pz), new THREE.Vector3(px, depthToY(profile.measurements[profile.measurements.length - 1]?.depth ?? 0), pz)]),
      new THREE.LineBasicMaterial({ color: 0xfcd34d })
    );
    sc.argo.add(line);
    const mldM = profile.analysis?.mld_meters;
    if (mldM !== null && mldM !== undefined) {
      sc.mld.position.y = depthToY(mldM);
      sc.mld.visible = true;
    }
  }, [profile, target, argoKey, columnRange, isLog, palette]);

  const closest = useMemo(() => {
    if (!profile) return null;
    let best: InstrumentProfileResponse['measurements'][number] | null = null;
    for (const m of profile.measurements) {
      if (m.temperature === null || m.temperature === undefined) continue;
      if (!best || Math.abs(m.depth - sliceDepth) < Math.abs(best.depth - sliceDepth)) best = m;
    }
    return best && Math.abs(best.depth - sliceDepth) <= 50 ? best : null;
  }, [profile, sliceDepth]);

  if (!target) return null;

  const meta = catalog?.variables[activeVar];
  const units = meta?.units ?? '';
  const modelValue = tile ? sampleOceanDataAt(tile, target.lon, target.lat).value : null;
  const levelExists = meta?.depths.some((d) => Math.abs(d - sliceDepth) < 1e-6) ?? false;
  const sound = closest && closest.salinity !== null && closest.salinity !== undefined && closest.temperature !== null && closest.temperature !== undefined
    ? { c: mackenzieSoundSpeed(closest.temperature, closest.salinity, closest.depth), ok: mackenzieInRange(closest.temperature, closest.salinity, closest.depth) }
    : null;
  const variables = catalog ? Object.keys(catalog.variables) : ['temperature'];

  return (
    <>
      <div className="fixed inset-0 bg-neutral-950/85 z-40 animate-in fade-in duration-[500ms]" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Water-column view"
        className={`fixed z-50 flex flex-col glass-panel shadow-2xl overflow-hidden border border-white/15 ${
          isFullscreen ? 'inset-2 rounded-2xl' : 'right-6 top-16 bottom-16 w-[940px] max-w-[calc(100vw-3rem)] rounded-2xl'
        }`}
      >
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/40 gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-ocean-accent/15 text-ocean-accent px-2 py-0.5 rounded-full border border-ocean-accent/30">
              Water-column view · 0–2000 m frame
            </span>
            <h2 className="text-sm font-bold text-white mt-1 truncate">
              {target.name || 'Water column'}{' '}
              <span className="text-xs font-mono text-ocean-muted font-normal">
                ({target.lat.toFixed(2)}°N, {target.lon.toFixed(2)}°E · top face ±{HALF_WINDOW_DEG}°)
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setAutoRotate(!autoRotate)} aria-pressed={autoRotate} aria-label="Toggle auto-rotation"
              className="p-1.5 rounded-lg border border-white/10 text-ocean-text-secondary hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent">
              {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button aria-label="Reset camera" onClick={() => {
              const sc = sceneRef.current;
              if (sc) { sc.camera.position.set(16, 11, 20); sc.controls.target.set(0, 0, 0); sc.group.rotation.y = 0; }
            }} className="p-1.5 rounded-lg border border-white/10 text-ocean-text-secondary hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg border border-white/10 text-ocean-text-secondary hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent">
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button aria-label="Close water-column view" onClick={closeWaterBlock}
              className="p-1.5 rounded-lg text-ocean-muted hover:text-red-400 hover:bg-red-500/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 relative h-64 md:h-auto bg-neutral-950">
            <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing outline-none" />
            <div className="absolute bottom-3 left-3 bg-black/70 px-3 py-1.5 rounded-lg border border-ocean-accent/40 text-xs font-mono text-ocean-accent">
              Depth plane: <strong className="text-white">{sliceDepth} m</strong> {levelExists ? '' : '· no gridded level'}
            </div>
          </div>

          <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 p-3.5 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar text-xs">
            <section className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
              <h3 className="flex items-center gap-1.5 font-bold text-ocean-accent"><Database className="w-3.5 h-3.5" /> Gridded field</h3>
              {tileState === 'loading' ? (
                <p className="text-[10px] font-mono text-ocean-muted" role="status">Loading…</p>
              ) : tileState === 'ok' && modelValue !== null ? (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-mono text-[10px] text-emerald-200 flex items-center justify-between">
                  <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> surface value</span>
                  <span className="font-bold text-white">{modelValue.toFixed(activeVar === 'chlorophyll' ? 3 : 2)} {units}</span>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[10px] text-amber-200 flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{tileState === 'ok' ? 'No data at this point (land or outside the source grid).' : `No ${activeVar} field for ${selectedTime.slice(0, 10)}.`}</span>
                </div>
              )}
              <p className="text-[9px] text-ocean-muted leading-snug">
                {meta ? `${catalog?.sources[meta.source_id]?.title ?? meta.source_id} · ${meta.vertical_coverage ?? ''}. ` : ''}
                Below the surface the frame is empty on purpose: no subsurface model levels exist and none are interpolated.
              </p>
            </section>

            <section className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
              <h3 className="flex items-center gap-1.5 font-bold text-amber-300"><Radio className="w-3.5 h-3.5" /> Argo profile</h3>
              {profileLoading ? (
                <p className="text-[10px] font-mono text-ocean-muted" role="status">Loading…</p>
              ) : profile ? (
                <>
                  <p className="text-[10px] font-mono text-ocean-text-secondary">
                    WMO {profile.metadata?.wmo} · cycle {profile.cycle_number} · {profile.timestamp.slice(0, 10)}
                  </p>
                  {profileNote && <p className="text-[10px] text-amber-200">{profileNote}</p>}
                  <p className="text-[10px] text-ocean-muted">
                    Column colour: {argoKey && columnRange
                      ? `${activeVar}, profile range ${columnRange[0].toFixed(2)}–${columnRange[1].toFixed(2)} ${units}`
                      : `no Argo measurement of ${activeVar}`}.
                    Amber plane: observed MLD {profile.analysis?.mld_meters ?? 'n/a'} m.
                  </p>
                  <dl className="space-y-1 font-mono">
                    <div className="flex justify-between"><dt className="text-ocean-muted">Nearest level</dt><dd>{closest ? `${closest.depth.toFixed(1)} m` : `none within 50 m of ${sliceDepth} m`}</dd></div>
                    <div className="flex justify-between"><dt className="text-ocean-muted">Temperature</dt><dd>{closest?.temperature != null ? `${closest.temperature.toFixed(3)} °C` : '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-ocean-muted">Salinity</dt><dd>{closest?.salinity != null ? `${closest.salinity.toFixed(3)} PSU` : '—'}</dd></div>
                    <div className="flex justify-between" title="Mackenzie (1981) from the measured T, S and depth">
                      <dt className="text-ocean-muted">Sound speed</dt>
                      <dd>{sound ? `${sound.c.toFixed(1)} m/s${sound.ok ? '' : ' (outside formula range)'}` : '—'}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="text-[10px] text-amber-200">{profileNote || 'No profile.'}</p>
              )}
            </section>
          </div>
        </div>

        <div className="p-3 border-t border-white/10 bg-black/40 flex flex-col gap-2.5">
          <div role="tablist" aria-label="Variable" className="flex flex-wrap items-center gap-1.5">
            {variables.map((v) => (
              <button key={v} role="tab" aria-selected={activeVar === v} onClick={() => setActiveVar(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-accent ${
                  activeVar === v ? 'bg-ocean-accent/20 text-ocean-accent border border-ocean-accent/50' : 'text-ocean-muted hover:text-white glass-pill'
                }`}>
                {catalog?.variables[v]?.long_name ?? v}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
            <span className="text-xs font-mono text-ocean-accent flex items-center gap-1 shrink-0"><ArrowDown className="w-3.5 h-3.5" /> Depth plane</span>
            <input type="range" min={0} max={MAX_DEPTH} step={10} value={sliceDepth}
              onChange={(e) => setSliceDepth(parseFloat(e.target.value))}
              aria-label="Depth plane in metres" className="flex-1 accent-teal-400 cursor-pointer" />
            <span className="text-xs font-mono text-white font-bold w-16 text-right">{sliceDepth} m</span>
          </label>
        </div>
      </div>
    </>
  );
};
