import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VolumeEngine, DEFAULT_PARAMS, type RenderParams, type VolumeGeometryHints } from "../volumetric/VolumeEngine";
import {
  fetchDatasets,
  fetchMetadata,
  fetchVolume,
  VolumeApiError,
  type VolumeMeta,
  type VolumePayload,
} from "../volumetric/volumeApi";

interface Props {
  open: boolean;
  onClose: () => void;
  /** JWT from your auth store. Pass null only if the backend has auth disabled. */
  authToken: string | null;
  /** Optional preselection, e.g. the dataset currently shown on the globe. */
  initialFilename?: string;
  initialVariable?: string;
}

type Stage = "idle" | "datasets" | "metadata" | "volume" | "ready" | "error";

const W = 900;
const H = 600;

export default function VolumetricStudio({ open, onClose, authToken, initialFilename, initialVariable }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VolumeEngine | null>(null);
  const volumeRef = useRef<{ vol: VolumePayload; hints: VolumeGeometryHints } | null>(null);

  const [datasets, setDatasets] = useState<string[]>([]);
  const [filename, setFilename] = useState<string | undefined>(initialFilename);
  const [meta, setMeta] = useState<VolumeMeta | null>(null);
  const [variable, setVariable] = useState<string | undefined>(initialVariable);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ min: number; max: number; valid: number } | null>(null);

  // UI controls (kept in physical/index units; converted to u-space in `params`)
  const [mode, setMode] = useState<RenderParams["mode"]>("volume");
  const [iso, setIso] = useState(0.5);
  const [density, setDensity] = useState(DEFAULT_PARAMS.density);
  const [depthLevel, setDepthLevel] = useState(0);      // 0 = surface, exposes horizontal section
  const [lonCut, setLonCut] = useState(1);              // fraction west->east kept
  const [latCut, setLatCut] = useState(0);              // fraction removed from the south
  const [caps, setCaps] = useState(true);
  const [exaggeration, setExaggeration] = useState(DEFAULT_PARAMS.verticalExaggeration);
  const [flipVertical, setFlipVertical] = useState<boolean | null>(null); // null = auto from metadata

  /* ------------------------ draggable window ------------------------ */
  const [pos, setPos] = useState(() => ({
    x: Math.max(16, (window.innerWidth - W) / 2),
    y: Math.max(16, (window.innerHeight - H) / 2),
  }));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,select,input")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.min(Math.max(8 - W + 120, e.clientX - drag.current.dx), window.innerWidth - 120);
    const y = Math.min(Math.max(8, e.clientY - drag.current.dy), window.innerHeight - 48);
    setPos({ x, y });
  };
  const onPointerUp = () => (drag.current = null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ------------------------ engine lifecycle ------------------------ */
  useEffect(() => {
    if (!open || !viewportRef.current) return;
    let engine: VolumeEngine;
    try {
      engine = new VolumeEngine(viewportRef.current, (msg) => {
        setError(msg);
        setStage("error");
      });
    } catch (err) {
      console.error("[VolumetricStudio] engine init failed", err);
      setError((err as Error).message);
      setStage("error");
      return;
    }
    engineRef.current = engine;
    // Survives React StrictMode's mount/unmount/mount: re-apply any volume already loaded.
    if (volumeRef.current) engine.setVolume(volumeRef.current.vol, volumeRef.current.hints);
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [open]);

  /* ------------------------ dataset discovery ------------------------ */
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setStage("datasets");
    setError(null);
    fetchDatasets(authToken, ac.signal)
      .then((list) => {
        setDatasets(list);
        setFilename((f) => (f && list.includes(f) ? f : list[0]));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("[VolumetricStudio] dataset discovery failed", err);
        if (initialFilename) {
          // Discovery is only needed for the file picker; the requested file can still load.
          setDatasets([initialFilename]);
          setFilename(initialFilename);
          return;
        }
        setError(err instanceof VolumeApiError ? err.message : String(err));
        setStage("error");
      });
    return () => ac.abort();
  }, [open, authToken, initialFilename]);

  /* ------------------------ metadata ------------------------ */
  useEffect(() => {
    if (!open || !filename) return;
    const ac = new AbortController();
    setStage("metadata");
    setError(null);
    fetchMetadata(filename, authToken, ac.signal)
      .then((m) => {
        setMeta(m);
        if (m.variables.length === 0) {
          throw new VolumeApiError(`Metadata for ${filename} lists no variables.`);
        }
        setVariable((v) => (v && m.variables.includes(v) ? v : m.variables[0]));
        setDepthLevel(0);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("[VolumetricStudio] metadata failed", err);
        setError(err instanceof VolumeApiError ? err.message : String(err));
        setStage("error");
      });
    return () => ac.abort();
  }, [open, filename, authToken]);

  /* ------------------------ geometry hints ------------------------ */
  const autoBottomFirst = useMemo(() => {
    if (meta?.zAxis === "time") return true; // earliest month at the bottom, latest on top
    const d = meta?.depthLevels;
    return d ? d[0] > d[d.length - 1] : false;
  }, [meta]);
  const bottomFirst = flipVertical ?? autoBottomFirst;

  const hints = useMemo<VolumeGeometryHints>(() => {
    const lon = meta?.lon, lat = meta?.lat;
    return {
      lonSpan: lon ? Math.abs(lon[1] - lon[0]) : undefined,
      latSpan: lat ? Math.abs(lat[1] - lat[0]) : undefined,
      flipLon: lon ? lon[0] > lon[1] : false,
      flipLat: lat ? lat[0] > lat[1] : false,
      depthIndexZeroIsBottom: bottomFirst,
    };
  }, [meta, bottomFirst]);

  /* ------------------------ volume fetch ------------------------ */
  useEffect(() => {
    if (!open || !meta || !variable) return;
    const ac = new AbortController();
    setStage("volume");
    setError(null);
    fetchVolume(meta, variable, authToken, ac.signal)
      .then((vol) => {
        volumeRef.current = { vol, hints };
        engineRef.current?.setVolume(vol, hints);
        setStats({ min: vol.valueMin, max: vol.valueMax, valid: vol.validFraction });
        setStage("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("[VolumetricStudio] volume load failed", err);
        setError(err instanceof VolumeApiError ? err.message : String(err));
        setStage("error");
      });
    return () => ac.abort();
    // `hints` intentionally excluded: orientation changes re-upload below without refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meta, variable, authToken]);

  useEffect(() => {
    if (volumeRef.current) {
      volumeRef.current.hints = hints;
      engineRef.current?.setVolume(volumeRef.current.vol, hints);
    }
  }, [hints]);

  /* ------------------------ params -> engine ------------------------ */
  const nz = meta?.dims.nz ?? 1;
  const params = useMemo<Partial<RenderParams>>(() => {
    // Remove everything above the chosen level: the top cap becomes the horizontal section.
    const zTop = depthLevel === 0 ? 1 : 1 - (depthLevel + 0.5) / nz;
    return {
      mode,
      iso,
      density,
      caps,
      verticalExaggeration: exaggeration,
      clipMin: [0, latCut, 0],
      clipMax: [Math.max(lonCut, 0.01), 1, Math.max(zTop, 0.01)],
    };
  }, [mode, iso, density, caps, exaggeration, depthLevel, lonCut, latCut, nz]);

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params, stage]);

  /* ------------------------ labels ------------------------ */
  const units = (variable && meta?.units?.[variable]) || "";
  const toPhysical = useCallback(
    (f: number) => (stats ? stats.min + f * (stats.max - stats.min) : f),
    [stats]
  );
  const isTime = meta?.zAxis === "time";
  const depthLabel = (() => {
    const idx = bottomFirst ? nz - 1 - depthLevel : depthLevel;
    if (meta?.zLabels) return meta.zLabels[idx] ?? `Level ${depthLevel + 1} of ${nz}`;
    const d = meta?.depthLevels;
    if (!d) return `Level ${depthLevel + 1} of ${nz}`;
    return `${Math.round(d[idx]).toLocaleString()} m`;
  })();
  const lonLabel = meta?.lon ? `${(meta.lon[0] + lonCut * (meta.lon[1] - meta.lon[0])).toFixed(2)}°E` : `${Math.round(lonCut * 100)}%`;
  const latLabel = meta?.lat ? `${(meta.lat[0] + latCut * (meta.lat[1] - meta.lat[0])).toFixed(2)}°N` : `${Math.round(latCut * 100)}%`;

  if (!open) return null;

  const busy = stage === "datasets" || stage === "metadata" || stage === "volume";
  const busyText =
    stage === "datasets" ? "Looking for model files" :
    stage === "metadata" ? "Reading grid dimensions" :
    "Loading volume";

  return (
    <div
      role="dialog"
      aria-label="Volumetric studio"
      className="fixed z-50 flex flex-col overflow-hidden rounded-2xl bg-[#0A192F]/80 backdrop-blur-2xl border border-cyan-500/40 shadow-[0_0_60px_-12px_rgba(34,211,238,0.45)] text-slate-200"
      style={{ left: pos.x, top: pos.y, width: `min(${W}px, calc(100vw - 2rem))`, height: `min(${H}px, calc(100vh - 2rem))` }}
    >
      {/* Title bar — drag handle */}
      <div
        className="flex items-center gap-3 px-4 h-11 border-b border-cyan-500/20 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.7)]" aria-hidden />
        <h2 className="text-sm font-semibold tracking-wide text-cyan-100">Volumetric studio</h2>

        <select
          aria-label="Model file"
          className="ml-3 max-w-[240px] truncate rounded-md bg-cyan-950/60 border border-cyan-500/30 px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          value={filename ?? ""}
          onChange={(e) => setFilename(e.target.value)}
          disabled={datasets.length === 0}
        >
          {datasets.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          aria-label="Variable"
          className="rounded-md bg-cyan-950/60 border border-cyan-500/30 px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          value={variable ?? ""}
          onChange={(e) => setVariable(e.target.value)}
          disabled={!meta}
        >
          {meta?.variables.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>

        {meta && (
          <span className="text-[11px] text-cyan-300/70 tabular-nums">
            {meta.dims.nx}×{meta.dims.ny}×{meta.dims.nz}
          </span>
        )}

        <button
          onClick={() => engineRef.current?.resetView()}
          className="ml-auto rounded-md px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Reset view
        </button>
        <button
          onClick={onClose}
          aria-label="Close volumetric studio"
          className="rounded-md px-2 py-1 text-cyan-200 hover:bg-cyan-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Viewport */}
        <div className="relative flex-1 min-w-0">
          <div ref={viewportRef} className="absolute inset-0" />

          {busy && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="flex items-center gap-3 rounded-lg bg-[#0A192F]/70 px-4 py-2 border border-cyan-500/30 text-xs text-cyan-100">
                <span className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin motion-reduce:animate-none" />
                {busyText}
              </div>
            </div>
          )}

          {stage === "error" && error && (
            <div className="absolute inset-x-6 top-6 rounded-lg border border-rose-400/50 bg-rose-950/70 p-3 text-xs text-rose-100" role="alert">
              <p className="font-semibold mb-1">Volume could not be displayed</p>
              <p className="break-words">{error}</p>
              <p className="mt-1 text-rose-200/70">Full details are in the browser console.</p>
            </div>
          )}

          {stats && stage === "ready" && (
            <div className="absolute left-3 bottom-3 rounded-md bg-[#0A192F]/70 border border-cyan-500/20 px-3 py-2 text-[11px] tabular-nums">
              <div className="h-2 w-48 rounded-sm mb-1"
                style={{ background: "linear-gradient(90deg,#30123b,#4662d7,#36aaf9,#1ae4b6,#72fe5e,#c8ef34,#faba39,#f66b19,#ca2a04,#7a0403)" }} />
              <div className="flex justify-between w-48 text-cyan-100/80">
                <span>{stats.min.toFixed(2)}</span>
                <span>{variable} {units && `(${units})`}</span>
                <span>{stats.max.toFixed(2)}</span>
              </div>
              <div className="text-cyan-300/60 mt-0.5">{(stats.valid * 100).toFixed(1)}% ocean voxels</div>
            </div>
          )}
        </div>

        {/* Control rail */}
        <aside className="w-64 shrink-0 border-l border-cyan-500/20 p-4 space-y-5 overflow-y-auto text-xs">
          <fieldset>
            <legend className="text-cyan-100 font-medium mb-2">Rendering</legend>
            <div className="grid grid-cols-2 rounded-lg border border-cyan-500/30 p-0.5">
              {(["volume", "iso"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-md py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    mode === m ? "bg-cyan-500/25 text-cyan-50" : "text-cyan-200/70 hover:text-cyan-100"
                  }`}
                >
                  {m === "volume" ? "Volume" : "Isosurface"}
                </button>
              ))}
            </div>
          </fieldset>

          {mode === "iso" ? (
            <Slider
              label="Isosurface threshold"
              value={iso} min={0.01} max={0.99} step={0.005}
              display={`${toPhysical(iso).toFixed(2)} ${units}`}
              onChange={setIso}
            />
          ) : (
            <Slider
              label="Density"
              value={density} min={0.1} max={5} step={0.05}
              display={density.toFixed(2)}
              onChange={setDensity}
            />
          )}

          <fieldset className="space-y-4">
            <legend className="text-cyan-100 font-medium mb-2">Slices</legend>
            <Slider
              label={isTime ? "Time slice" : "Depth slice"}
              value={depthLevel} min={0} max={Math.max(0, nz - 1)} step={1}
              display={depthLabel}
              onChange={setDepthLevel}
            />
            <Slider
              label="Longitude slice"
              value={lonCut} min={0.02} max={1} step={0.005}
              display={lonLabel}
              onChange={setLonCut}
            />
            <Slider
              label="Latitude slice"
              value={latCut} min={0} max={0.98} step={0.005}
              display={latLabel}
              onChange={setLatCut}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={caps} onChange={(e) => setCaps(e.target.checked)} className="accent-cyan-400" />
              Show cut faces
            </label>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-cyan-100 font-medium mb-2">Geometry</legend>
            <Slider
              label="Vertical exaggeration"
              value={exaggeration} min={0.05} max={1} step={0.01}
              display={`${exaggeration.toFixed(2)}×`}
              onChange={setExaggeration}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={bottomFirst}
                onChange={(e) => setFlipVertical(e.target.checked)}
                className="accent-cyan-400"
              />
              {isTime ? "Earliest month at the bottom" : "First level is the seabed"}
            </label>
            {isTime && (
              <p className="text-cyan-300/50 leading-snug">
                {meta?.filename} has no depth axis, so the vertical axis is time: {nz} monthly
                surface fields stacked {meta?.zLabels ? `${meta.zLabels[0]} → ${meta.zLabels[nz - 1]}` : ""}.
              </p>
            )}
            {!isTime && !meta?.depthLevels && (
              <p className="text-cyan-300/50 leading-snug">
                No depth coordinates in metadata, so levels are evenly spaced and orientation can't be detected.
              </p>
            )}
          </fieldset>
        </aside>
      </div>
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const id = `vs-${props.label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label htmlFor={id} className="text-cyan-200/80">{props.label}</label>
        <span className="tabular-nums text-cyan-50">{props.display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
      />
    </div>
  );
}
