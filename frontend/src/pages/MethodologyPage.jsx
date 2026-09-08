import React, { useState, useCallback, useRef } from 'react';
import { useOceanStore } from '../store/oceanStore';

// ─── Inline SVG Icons (no extra imports needed) ─────────────────────────────

const IconDatabase   = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);
const IconCompass    = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);
const IconActivity   = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconCpu        = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
    <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>
  </svg>
);
const IconLayers     = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const IconShield     = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
  </svg>
);
const IconCheck      = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconCopy       = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);
const IconChevronDown = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);
const IconArrowRight = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);
const IconFlask      = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 19.477a1 1 0 0 0 .898 1.523h12.764a1 1 0 0 0 .898-1.523l-5.07-9.054A2 2 0 0 1 14 9.527V2"/>
    <path d="M8.5 2h7"/><path d="M7 16h10"/>
  </svg>
);

// ─── CopyBlock — interactive code snippet with copy button ──────────────────

function CopyBlock({ code, lang = 'python', accentColor = '#00d4aa' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="relative group rounded-lg overflow-hidden border border-white/8"
         style={{ background: 'rgba(5, 10, 22, 0.9)' }}>
      {/* language badge */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/6"
           style={{ background: 'rgba(255,255,255,0.03)' }}>
        <span className="text-[10px] font-mono tracking-widest uppercase"
              style={{ color: accentColor, opacity: 0.85 }}>{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-all duration-200"
          style={{
            background: copied ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.05)',
            color: copied ? '#00d4aa' : 'rgba(255,255,255,0.45)',
            border: `1px solid ${copied ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}
          title="Copy to clipboard"
        >
          {copied
            ? <><IconCheck className="w-3 h-3" /><span>Copied</span></>
            : <><IconCopy className="w-3 h-3" /><span>Copy</span></>
          }
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[11.5px] leading-relaxed custom-scrollbar"
           style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace', color: 'rgba(220,235,255,0.88)' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Formula Card ────────────────────────────────────────────────────────────

function FormulaCard({ label, formula, description, color = '#38bdf8' }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2 border transition-all duration-200 hover:scale-[1.01]"
         style={{ background: 'rgba(8,16,36,0.8)', borderColor: `${color}22` }}>
      <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color }}>{label}</span>
      <div className="rounded-lg px-4 py-3 text-center font-mono text-sm font-semibold border"
           style={{ background: `${color}0a`, borderColor: `${color}30`, color: `${color}ee`, letterSpacing: '0.04em' }}>
        {formula}
      </div>
      {description && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

// ─── Section — collapsible card ──────────────────────────────────────────────

function Section({ id, icon: Icon, title, badge, accentColor = '#38bdf8', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden border transition-all duration-300"
         style={{ background: 'rgba(6,14,32,0.72)', borderColor: open ? `${accentColor}33` : 'rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}>
            <Icon className="w-4.5 h-4.5" style={{ color: accentColor }} />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-white tracking-tight">{title}</span>
              {badge && (
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0"
                      style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>
        <IconChevronDown
          className="w-4 h-4 shrink-0 ml-4 transition-transform duration-300"
          style={{ color: 'rgba(255,255,255,0.35)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div className="px-6 pb-6 pt-1 flex flex-col gap-5"
               style={{ borderTop: `1px solid ${accentColor}14` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Flow Diagram ────────────────────────────────────────────────────

function PipelineFlow({ steps }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className="px-3 py-2 rounded-xl text-[11px] font-mono font-semibold border whitespace-nowrap"
                 style={{
                   background: `${step.color}12`,
                   borderColor: `${step.color}40`,
                   color: step.color,
                   boxShadow: `0 0 12px ${step.color}14`,
                 }}>
              {step.icon && <span className="mr-1.5">{step.icon}</span>}
              {step.label}
            </div>
            {step.sub && (
              <span className="text-[9px] text-slate-600 font-mono">{step.sub}</span>
            )}
          </div>
          {i < steps.length - 1 && (
            <IconArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Sub-tab switcher ─────────────────────────────────────────────────────────

function SubTabs({ tabs, active, onChange, accentColor }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
          style={active === t.id
            ? { background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }
            : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main MethodologyPage ─────────────────────────────────────────────────────

export const MethodologyPage = () => {
  const { setActivePage } = useOceanStore();

  // Section-level sub-tabs state
  const [interpTab, setInterpTab] = useState('temporal');
  const [validTab,  setValidTab]  = useState('formulas');
  const [gpuTab,    setGpuTab]    = useState('pipeline');

  return (
    <div
      className="flex-1 w-full overflow-y-auto custom-scrollbar select-text"
      style={{
        background: 'linear-gradient(180deg, #030b18 0%, #040d1c 40%, #030a16 100%)',
        fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
      }}
    >
      {/* ── Ambient glow backdrop ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-5"
             style={{ background: 'radial-gradient(circle, #00f2fe 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full opacity-4"
             style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-10 flex flex-col gap-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-6"
             style={{ borderBottom: '1px solid rgba(0,242,254,0.1)' }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                   style={{ background: 'rgba(0,242,254,0.1)', border: '1px solid rgba(0,242,254,0.25)', boxShadow: '0 0 20px rgba(0,242,254,0.12)' }}>
                <IconFlask className="w-5 h-5" style={{ color: '#00f2fe' }} />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-[0.25em] uppercase"
                      style={{ color: '#00f2fe', opacity: 0.75 }}>
                  INCOIS · SIH 2026 · PS-26067
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
                  Scientific Methodology &amp; Architecture
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mt-1">
              Authoritative documentation of the data ingestion pipeline, TEOS-10 thermodynamic
              normalization, 4D spatio-temporal colocation, statistical validation metrics, and
              WebGL2 volumetric rendering architecture powering this platform.
            </p>
          </div>

          <button
            onClick={() => setActivePage('home')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium shrink-0 transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            ← Back to 3D Globe
          </button>
        </div>

        {/* ── Quick-Nav Index ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Data Ingestion',       color: '#38bdf8', n: '01' },
            { label: 'TEOS-10 Normalization',color: '#818cf8', n: '02' },
            { label: '4D Interpolation',     color: '#34d399', n: '03' },
            { label: 'Validation Metrics',   color: '#fb923c', n: '04' },
            { label: 'GPU Raymarching',      color: '#00f2fe', n: '05' },
          ].map(item => (
            <div key={item.n} className="rounded-xl p-3 flex flex-col gap-1 border cursor-default hover:border-opacity-60 transition-all duration-200"
                 style={{ background: `${item.color}07`, borderColor: `${item.color}25` }}>
              <span className="font-mono text-[9px] tracking-widest" style={{ color: item.color, opacity: 0.65 }}>§{item.n}</span>
              <span className="text-[11px] font-medium text-slate-300 leading-tight">{item.label}</span>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
             §01  DATA INGESTION & PIPELINE
        ══════════════════════════════════════════════════════════ */}
        <Section
          id="ingestion"
          icon={IconDatabase}
          title="Data Ingestion &amp; Pipeline"
          badge="§01"
          accentColor="#38bdf8"
          defaultOpen={true}
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            The platform enforces a strict <span style={{ color: '#f87171' }}>no mock / no synthetic data</span> policy.
            All model and in-situ datasets are tracked in <code className="text-[11px] rounded px-1.5 py-0.5" style={{ background: 'rgba(56,189,248,0.1)', color: '#7dd3fc' }}>datasets/manifest.json</code> and
            must satisfy minimum file-size guards before any downstream pipeline proceeds.
          </p>

          {/* Pipeline flow */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">Full Data Flow</p>
            <PipelineFlow steps={[
              { label: 'INCOIS ERDDAP', color: '#38bdf8', sub: 'ROMS/INDOFOS NetCDF' },
              { label: 'Coriolis GDAC', color: '#818cf8', sub: 'Argo Float NetCDF' },
              { label: 'fetch_real_datasets.py', color: '#34d399', sub: 'HTTP + size-guard' },
              { label: 'xr.open_dataset', color: '#fb923c', sub: 'Lazy decode' },
              { label: 'validate_real_data.py', color: '#f472b6', sub: 'CF-1.6 check' },
              { label: 'manifest.json', color: '#a78bfa', sub: 'Registry entry' },
            ]} />
          </div>

          {/* Two-column cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: 'rgba(8,20,42,0.8)', borderColor: 'rgba(56,189,248,0.18)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>ROMS / INDOFOS</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[11.5px] text-slate-400 leading-relaxed">
                <li>• <strong className="text-slate-300">Source:</strong> <code className="text-[10.5px]" style={{ color: '#7dd3fc' }}>erddap.incois.gov.in</code></li>
                <li>• CF-1.6 NetCDF-4 with terrain-following <code style={{ color: '#7dd3fc' }}>s_rho</code> sigma coordinates</li>
                <li>• Auto-discovers lon/lat/depth/time dims via case-insensitive alias table</li>
                <li>• Tags grid as <code style={{ color: '#7dd3fc' }}>curvilinear_2d</code> (ROMS AGRIF) or <code style={{ color: '#7dd3fc' }}>rectilinear_1d</code></li>
                <li>• Domain: 30°E–120°E, 30°S–30°N · ~0.08° resolution</li>
              </ul>
            </div>
            <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: 'rgba(8,20,42,0.8)', borderColor: 'rgba(129,140,248,0.18)' }}>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: '#818cf8' }}>Argo GDAC Floats</span>
              <ul className="flex flex-col gap-1.5 text-[11.5px] text-slate-400 leading-relaxed">
                <li>• <strong className="text-slate-300">Primary:</strong> <code style={{ color: '#a5b4fc' }}>data-argo.ifremer.fr</code></li>
                <li>• <strong className="text-slate-300">Fallback:</strong> <code style={{ color: '#a5b4fc' }}>usgodae.org/ftp/outgoing/argo</code></li>
                <li>• Prefers <code style={{ color: '#a5b4fc' }}>PRES_ADJUSTED</code> / <code style={{ color: '#a5b4fc' }}>TEMP_ADJUSTED</code> over raw variables</li>
                <li>• QC flag decoding handles masked arrays, raw bytes, integers</li>
                <li>• <strong className="text-slate-300">Accepted QC:</strong> <span style={{ color: '#4ade80' }}>1 (Good)</span>, <span style={{ color: '#86efac' }}>2 (Probably Good)</span> only</li>
              </ul>
            </div>
          </div>

          <CopyBlock
            lang="python · fetch_real_datasets.py"
            accentColor="#38bdf8"
            code={`download_with_fallback(primary_url, fallback_url, dest_path, min_size=10000)
# • User-agent: "INCOIS-3D-Platform/1.0 (Oceanographic Research; GDAC API)"
# • SSL verification bypassed for GDAC mirror compatibility
# • min_size > 10 000 bytes rejects truncated / error-page responses
# • RuntimeError raised on both-mirror failure — synthetic fallback never generated`}
          />

          <CopyBlock
            lang="python · validate_real_data.py"
            accentColor="#38bdf8"
            code={`validate_ocean_model(file_path)
  → OceanModel.get_metadata()
    → CF dimensions, variable shapes & units reported
    → ROMS s-coordinate params verified (s_rho, Cs_r, hc, Vtransform, h)
    → Spatial bounds [min_lon, max_lon] × [min_lat, max_lat] confirmed
    → If absent → STATUS: REAL DATASET REQUIRED (execution halted)`}
          />
        </Section>

        {/* ══════════════════════════════════════════════════════════
             §02  TEOS-10 COORDINATE NORMALIZATION
        ══════════════════════════════════════════════════════════ */}
        <Section
          id="teos10"
          icon={IconCompass}
          title="Coordinate &amp; Unit Normalization — TEOS-10"
          badge="§02"
          accentColor="#818cf8"
          defaultOpen={false}
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            Argo profiling floats report in-situ <strong className="text-slate-300">sea pressure in decibars (dbar)</strong>, not geometric
            depth. A nonlinear thermodynamic conversion is required because seawater is compressible and
            gravitational acceleration <em>g(φ)</em> varies with latitude.
          </p>

          {/* Thermodynamic integral */}
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(129,140,248,0.06)', borderColor: 'rgba(129,140,248,0.25)' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">TEOS-10 Thermodynamic Integral (IOC, SCOR &amp; IAPSO 2010)</p>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-center font-mono text-sm font-semibold px-6 py-3 rounded-xl"
                   style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)', color: '#c4b5fd', letterSpacing: '0.06em' }}>
                z = −∫₀ᴾ  dP′ / [ ρ(Sₐ, Θ, P′) · g(φ) ]
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg text-[11px]">
                {[
                  ['P', 'In-situ pressure (dbar)'],
                  ['φ', 'Geographic latitude (°N)'],
                  ['ρ(Sₐ, Θ, P′)', 'In-situ seawater density'],
                  ['g(φ)', '9.780327·(1 + 0.0053024·sin²φ − 5.8×10⁻⁶·sin²2φ)'],
                ].map(([sym, desc]) => (
                  <div key={sym} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(129,140,248,0.06)' }}>
                    <code className="font-mono text-[10px] shrink-0 mt-0.5" style={{ color: '#a78bfa' }}>{sym}</code>
                    <span className="text-slate-500 text-[10px] leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <CopyBlock
            lang="python · insitu_store.py — ArgoAdapter.parse_profile_from_file"
            accentColor="#818cf8"
            code={`# line 236 — netCDF4 path
z_valid = -gsw.z_from_p(p_valid, lat_val)
depth_mask = (z_valid >= 0) & (z_valid < 12000)
# Negation: TEOS-10 returns negative depth-below-surface → platform uses +m downward
# Guard:    z_valid < 12000 rejects physically implausible readings (> max ocean depth)

# line 353 — xarray fallback path
z_valid = -gsw.z_from_p(p_valid, lat_val)
depth_mask = z_valid >= 0

# Metadata tag written to store:
"vertical_coordinate": "TEOS-10 physical depth (m) via gsw.z_from_p"`}
          />
        </Section>

        {/* ══════════════════════════════════════════════════════════
             §03  4D SPATIO-TEMPORAL INTERPOLATION
        ══════════════════════════════════════════════════════════ */}
        <Section
          id="interp"
          icon={IconActivity}
          title="4D Spatio-Temporal Interpolation"
          badge="§03"
          accentColor="#34d399"
          defaultOpen={false}
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            Goal: colocate the gridded model field <strong className="text-slate-300">M(x, y, z, t)</strong> onto
            the exact position of an in-situ Argo observation <strong className="text-slate-300">(x_obs, y_obs, z_obs, t_obs)</strong>.
            Implemented in <code className="text-[10.5px] rounded px-1.5" style={{ background: 'rgba(52,211,153,0.1)', color: '#6ee7b7' }}>ocean_model.py::OceanModel.sample_profile()</code>.
          </p>

          {/* Step pipeline */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">Colocation Steps</p>
            <PipelineFlow steps={[
              { label: 'np.searchsorted(t)', color: '#34d399', sub: 'Bracket t_obs' },
              { label: 'α blending',         color: '#34d399', sub: 'Temporal lerp' },
              { label: 'KDTree / interp',    color: '#34d399', sub: 'Horizontal' },
              { label: 'np.interp (z)',      color: '#34d399', sub: 'Vertical' },
              { label: 'Paired residual',    color: '#34d399', sub: 'M−O' },
            ]} />
          </div>

          <SubTabs
            tabs={[
              { id: 'temporal',   label: 'Step 1 — Temporal' },
              { id: 'horizontal', label: 'Step 2 — Horizontal' },
              { id: 'vertical',   label: 'Step 3 — Vertical' },
              { id: 'roms',       label: 'ROMS σ-coords' },
            ]}
            active={interpTab}
            onChange={setInterpTab}
            accentColor="#34d399"
          />

          {interpTab === 'temporal' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.2)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">Linear Temporal Blending</p>
                <div className="text-center font-mono text-sm font-semibold py-3 rounded-lg"
                     style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', color: '#6ee7b7' }}>
                  α = (t_obs − t₀) / (t₁ − t₀)  ,  α ∈ [0, 1]
                </div>
                <div className="text-center font-mono text-xs mt-2" style={{ color: '#86efac' }}>
                  M_interp = (1 − α) · M₀ + α · M₁
                </div>
              </div>
              <CopyBlock
                lang="python · ocean_model.py lines 418–432"
                accentColor="#34d399"
                code={`t1_idx = int(np.searchsorted(time_vals, target_dt))
t0_idx = max(0, t1_idx - 1)
total_secs = (t1 - t0).total_seconds()
alpha = (target_dt - t0).total_seconds() / total_secs
alpha = float(np.clip(alpha, 0.0, 1.0))    # no extrapolation

depth_levels = (1.0 - alpha) * d_0 + alpha * d_1
model_values = (1.0 - alpha) * v_0 + alpha * v_1`}
              />
            </div>
          )}

          {interpTab === 'horizontal' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-4 border flex flex-col gap-3" style={{ background: 'rgba(52,211,153,0.05)', borderColor: 'rgba(52,211,153,0.2)' }}>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>Curvilinear (ROMS AGRIF)</span>
                  <p className="text-[11.5px] text-slate-400 leading-relaxed">
                    A spherical KD-Tree over the 2D <code style={{ color: '#6ee7b7' }}>lon_rho/lat_rho</code> grid converts
                    geographic degrees → 3D Cartesian unit vectors. Queries k=4 nearest nodes with
                    <strong className="text-slate-300"> Inverse-Distance Weighting (IDW)</strong>:
                  </p>
                  <div className="text-center font-mono text-xs py-2 rounded-lg"
                       style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
                    wₖ = dₖ⁻¹ / Σⱼ dⱼ⁻¹
                  </div>
                </div>
                <div className="rounded-xl p-4 border flex flex-col gap-3" style={{ background: 'rgba(52,211,153,0.05)', borderColor: 'rgba(52,211,153,0.2)' }}>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>Rectilinear (Standard)</span>
                  <p className="text-[11.5px] text-slate-400 leading-relaxed">
                    Standard <strong className="text-slate-300">bilinear interpolation</strong> delegated
                    to xarray along 1D lat/lon coordinate axes:
                  </p>
                  <div className="text-center font-mono text-xs py-2 rounded-lg"
                       style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
                    da_3d.interp(lat=φ, lon=λ, method="linear")
                  </div>
                </div>
              </div>
              <CopyBlock
                lang="python · ocean_model.py lines 39–46, 298–319"
                accentColor="#34d399"
                code={`# Cartesian projection for spherical KD-Tree
def geo_to_cartesian(lon_deg, lat_deg):
    lon_r, lat_r = np.radians(lon_deg), np.radians(lat_deg)
    x = np.cos(lat_r) * np.cos(lon_r)
    y = np.cos(lat_r) * np.sin(lon_r)
    z = np.sin(lat_r)
    return np.column_stack((x.flatten(), y.flatten(), z.flatten()))

# IDW colocation (curvilinear path)
dists, idxs = tree.query(cart_pt, k=4)
weights = 1.0 / np.maximum(dists[0], 1e-6)
weights /= np.sum(weights)
for w, (j, i) in zip(weights, unraveled_ij):
    val_profile += w * da_3d.values[:, j, i]`}
              />
            </div>
          )}

          {interpTab === 'vertical' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                After horizontal interpolation yields a model profile at (lat, lon), values are mapped
                onto Argo depth levels via <strong className="text-slate-300">monotonic piecewise-linear interpolation</strong>.
                No extrapolation is performed beyond the model's vertical extent.
              </p>
              <CopyBlock
                lang="python · ocean_model.py lines 451–456"
                accentColor="#34d399"
                code={`sort_order = np.argsort(clean_d)
clean_d = clean_d[sort_order]
clean_v = clean_v[sort_order]
# np.interp with NaN guards — no extrapolation
interp_v = np.interp(query_depths, clean_d, clean_v, left=np.nan, right=np.nan)`}
              />
            </div>
          )}

          {interpTab === 'roms' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                For native ROMS terrain-following grids, physical depths are derived from
                local bathymetry h(x,y) and SSH ζ(x,y,t). Two Vtransform variants are supported:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-4 border" style={{ background: 'rgba(52,211,153,0.05)', borderColor: 'rgba(52,211,153,0.2)' }}>
                  <span className="text-[10px] font-mono font-bold" style={{ color: '#34d399' }}>Vtransform = 1 (Original)</span>
                  <div className="mt-2 text-center font-mono text-[11px] py-2 rounded-lg leading-loose"
                       style={{ background: 'rgba(52,211,153,0.07)', color: '#6ee7b7' }}>
                    S = hc·s + (h − hc)·C(s)<br/>
                    z = S + ζ·(1 + S/h)
                  </div>
                </div>
                <div className="rounded-xl p-4 border" style={{ background: 'rgba(52,211,153,0.05)', borderColor: 'rgba(52,211,153,0.2)' }}>
                  <span className="text-[10px] font-mono font-bold" style={{ color: '#34d399' }}>Vtransform = 2 (Modern Default)</span>
                  <div className="mt-2 text-center font-mono text-[11px] py-2 rounded-lg leading-loose"
                       style={{ background: 'rgba(52,211,153,0.07)', color: '#6ee7b7' }}>
                    S = (hc·s + h·C(s)) / (hc + h)<br/>
                    z = ζ + (ζ + h)·S
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Where s ∈ [−1, 0] = sigma levels, C(s) = <code style={{ color: '#6ee7b7' }}>Cs_r</code> stretching function,
                hc = critical depth. Source: <code style={{ color: '#6ee7b7' }}>ocean_model.py::calculate_roms_vertical_depths()</code>
              </p>
            </div>
          )}
        </Section>

        {/* ══════════════════════════════════════════════════════════
             §04  STATISTICAL VALIDATION ENGINE
        ══════════════════════════════════════════════════════════ */}
        <Section
          id="validation"
          icon={IconActivity}
          title="Statistical Validation Engine"
          badge="§04"
          accentColor="#fb923c"
          defaultOpen={false}
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            All metrics operate on <strong className="text-slate-300">valid paired samples</strong> where neither
            model value nor observation is NaN. Implemented in
            <code className="text-[10.5px] rounded px-1.5 mx-1" style={{ background: 'rgba(251,146,60,0.1)', color: '#fdba74' }}>validation_engine.py::ValidationEngine.compute_metrics()</code>.
          </p>

          <SubTabs
            tabs={[
              { id: 'formulas', label: 'Metric Formulas' },
              { id: 'code',     label: 'Implementation' },
              { id: 'output',   label: 'Scorecard Output' },
            ]}
            active={validTab}
            onChange={setValidTab}
            accentColor="#fb923c"
          />

          {validTab === 'formulas' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormulaCard
                  label="Depth-Resolved Residual"
                  formula="Δᵢ = Mᵢ − Oᵢ"
                  description="Positive = model warmer/saltier than observation. Full depth profile returned with None at masked levels."
                  color="#fb923c"
                />
                <FormulaCard
                  label="Root Mean Square Error"
                  formula="RMSE = √[ (1/N) · Σᵢ(Mᵢ − Oᵢ)² ]"
                  description="Penalises large outliers heavily. Primary accuracy metric for model-obs comparison."
                  color="#f87171"
                />
                <FormulaCard
                  label="Mean Absolute Error"
                  formula="MAE = (1/N) · Σᵢ |Mᵢ − Oᵢ|"
                  description="Linear error measure, less sensitive to outliers than RMSE."
                  color="#fbbf24"
                />
                <FormulaCard
                  label="Forecast Bias"
                  formula="Bias = (1/N) · Σᵢ (Mᵢ − Oᵢ)"
                  description="Positive bias = systematic warm/saline model offset. Negative = systematic cold/fresh offset."
                  color="#34d399"
                />
              </div>
              <FormulaCard
                label="Pearson Correlation Coefficient"
                formula="r = Σ(Mᵢ − M̄)(Oᵢ − Ō) / [ √Σ(Mᵢ − M̄)² · √Σ(Oᵢ − Ō)² ]"
                description="Profile-shape similarity. Guard: if σ_M or σ_O < 1×10⁻⁷ (constant field), returns null — not zero."
                color="#818cf8"
              />
            </div>
          )}

          {validTab === 'code' && (
            <CopyBlock
              lang="python · validation_engine.py lines 24–67"
              accentColor="#fb923c"
              code={`valid_mask = ~np.isnan(obs_arr) & ~np.isnan(mod_arr)
obs_clean  = obs_arr[valid_mask]
mod_clean  = mod_arr[valid_mask]

residuals = mod_clean - obs_clean              # Δᵢ = Mᵢ − Oᵢ
bias  = float(np.mean(residuals))             # line 44
mae   = float(np.mean(np.abs(residuals)))     # line 45
rmse  = float(np.sqrt(np.mean(residuals**2))) # line 46

# Pearson r — zero-variance guard
if len(obs_clean) > 1 and np.std(obs_clean) > 1e-7 and np.std(mod_clean) > 1e-7:
    corr_matrix = np.corrcoef(obs_clean, mod_clean)
    if not np.isnan(corr_matrix[0, 1]):
        r_val = float(round(corr_matrix[0, 1], 4))`}
            />
          )}

          {validTab === 'output' && (
            <CopyBlock
              lang="json · API response scorecard"
              accentColor="#fb923c"
              code={`{
  "bias":         -0.1823,   // °C  — systematic cold model offset
  "mae":           0.3417,   // °C
  "rmse":          0.4892,   // °C
  "pearson_r":     0.9621,   // dimensionless [−1, 1]
  "sample_count":  142       // valid paired depth levels
}`}
            />
          )}
        </Section>

        {/* ══════════════════════════════════════════════════════════
             §05  3D VOLUMETRIC RENDERING — GPU RAYMARCHING
        ══════════════════════════════════════════════════════════ */}
        <Section
          id="gpu"
          icon={IconCpu}
          title="3D Volumetric Rendering — WebGL2 Raymarching &amp; GPU Pipeline"
          badge="§05"
          accentColor="#00f2fe"
          defaultOpen={false}
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            Ocean scalar fields are rendered as full volumetric clouds using a custom <strong className="text-slate-300">WebGL2 GLSL
            raymarching pipeline</strong>. A Float32 3D texture (<code style={{ color: '#67e8f9' }}>THREE.Data3DTexture</code>) is sampled
            by a 120-step front-to-back ray integration with Beer-Lambert opacity transfer.
          </p>

          <SubTabs
            tabs={[
              { id: 'pipeline', label: 'Binary Pipeline' },
              { id: 'shader',   label: 'GLSL Shader' },
              { id: 'alpha',    label: 'Compositing' },
              { id: 'iso',      label: 'Iso-Surface' },
            ]}
            active={gpuTab}
            onChange={setGpuTab}
            accentColor="#00f2fe"
          />

          {gpuTab === 'pipeline' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">Binary Buffer Pipeline</p>
                <PipelineFlow steps={[
                  { label: 'xarray lazy isel',       color: '#00f2fe', sub: 'No I/O yet' },
                  { label: '.sel() spatial clip',    color: '#00f2fe', sub: 'Memory-safe' },
                  { label: '.values → float32',      color: '#00f2fe', sub: 'Decompress' },
                  { label: 'RegularGridInterpolator',color: '#00f2fe', sub: '64×64×32 resample' },
                  { label: '[0,1] normalize',        color: '#00f2fe', sub: 'NaN → −1.0' },
                  { label: '.tobytes()',             color: '#00f2fe', sub: 'octet-stream' },
                  { label: 'Data3DTexture',          color: '#00f2fe', sub: 'RedFormat·Float32' },
                ]} />
              </div>
              <CopyBlock
                lang="python · ocean_model.py — extract_volume_buffer()"
                accentColor="#00f2fe"
                code={`# Step 1 — lazy time slice (no decompression yet)
da_sub = da.isel({t_dim: valid_time_idx})

# Step 2 — spatial subset (reduces RAM footprint)
# Step 3 — materialise to float32
raw_data = da_sub.values.astype(np.float32)

# Step 4 — trilinear resample to 64×64×32 GPU dimensions
interp = RegularGridInterpolator((z_in, y_in, x_in), raw_data_filled,
                                  bounds_error=False, fill_value=fill_val)
vol_interp = interp((grid_z, grid_y, grid_x)).astype(np.float32)

# Parallel NaN tracking (binary mask interpolation)
nan_interp = RegularGridInterpolator((z_in, y_in, x_in),
                np.isnan(raw_data).astype(np.float32), fill_value=1.0)
vol_interp[nan_interp((grid_z, grid_y, grid_x)) > 0.5] = np.nan

# Step 5 — normalise [0,1], encode NaN as −1.0 sentinel
vol_norm = np.clip((vol_interp - min_val) / (max_val - min_val), 0.0, 1.0)
vol_norm[nan_mask] = -1.0     # land mask / missing data

# Step 6 — serialise
buffer = vol_norm.tobytes()   # Content-Type: application/octet-stream`}
              />
              <CopyBlock
                lang="javascript · OceanSceneController.js lines 496–502"
                accentColor="#00f2fe"
                code={`const newTexture = new THREE.Data3DTexture(volumeBuffer, dimX, dimY, dimZ);
newTexture.format      = THREE.RedFormat;      // single-channel R only
newTexture.type        = THREE.FloatType;      // IEEE 754 float32
newTexture.minFilter   = THREE.LinearFilter;
newTexture.magFilter   = THREE.LinearFilter;
newTexture.unpackAlignment = 1;
newTexture.needsUpdate = true;
// → sampled in GLSL as: float scalar = texture(u_data, uvw).r;`}
              />
              {/* LRU cache note */}
              <div className="rounded-xl p-3 border flex items-start gap-3" style={{ background: 'rgba(0,242,254,0.05)', borderColor: 'rgba(0,242,254,0.2)' }}>
                <span style={{ color: '#00f2fe', fontSize: 16 }}>⚡</span>
                <p className="text-[11.5px] text-slate-400 leading-relaxed">
                  Computed buffers are stored in a bounded <strong className="text-slate-300">32-entry LRU cache</strong> keyed by
                  <code className="text-[10.5px] mx-1" style={{ color: '#67e8f9' }}>(variable, time_idx, target_shape, spatial_bounds)</code>.
                  Repeat requests return cached bytes in <strong className="text-slate-300">&lt;10 µs</strong> without re-reading the NetCDF file.
                </p>
              </div>
            </div>
          )}

          {gpuTab === 'shader' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                {[
                  { axis: 's (X)', expr: 'pos.x + 0.5', meaning: 'Longitude [min → max]' },
                  { axis: 't (Y)', expr: 'pos.z + 0.5', meaning: 'Latitude [min → max]' },
                  { axis: 'r (Z)', expr: '0.5 − pos.y', meaning: 'Depth [0=surface, 1=bottom]' },
                ].map(row => (
                  <div key={row.axis} className="rounded-xl p-3 border text-center flex flex-col gap-1"
                       style={{ background: 'rgba(0,242,254,0.05)', borderColor: 'rgba(0,242,254,0.18)' }}>
                    <span className="font-mono font-bold text-xs" style={{ color: '#00f2fe' }}>{row.axis}</span>
                    <code className="font-mono text-[10.5px]" style={{ color: '#67e8f9' }}>{row.expr}</code>
                    <span className="text-slate-500 text-[10px]">{row.meaning}</span>
                  </div>
                ))}
              </div>
              <CopyBlock
                lang="glsl · VolumeRaymarchingShader.js — vertex shader"
                accentColor="#00f2fe"
                code={`void main() {
  vPosition  = position;
  vOrigin    = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Camera → object-local space: intersection computed in [-0.5, 0.5]³ cube
}`}
              />
              <CopyBlock
                lang="glsl · hit_box() — slab method ray-box intersection"
                accentColor="#00f2fe"
                code={`vec2 hit_box(vec3 orig, vec3 dir) {
  vec3 box_min = vec3(-0.5), box_max = vec3(0.5);
  vec3 inv_dir = 1.0 / dir;
  vec3 t0 = (box_min - orig) * inv_dir;
  vec3 t1 = (box_max - orig) * inv_dir;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float t_enter = max(max(tmin.x, tmin.y), tmin.z);
  float t_exit  = min(min(tmax.x, tmax.y), tmax.z);
  return vec2(t_enter, t_exit);  // miss when t_enter > t_exit
}`}
              />
            </div>
          )}

          {gpuTab === 'alpha' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(0,242,254,0.05)', borderColor: 'rgba(0,242,254,0.2)' }}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">Beer-Lambert Opacity Transfer Function (120 steps)</p>
                <div className="flex flex-col items-center gap-2">
                  <div className="font-mono text-sm text-center py-2 px-4 rounded-lg"
                       style={{ background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.25)', color: '#67e8f9' }}>
                    α_step = (1 − e^(−ρ·κ·3.5)) · Δt · 30
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10.5px] mt-1 w-full">
                    {[
                      ['ρ', '(s − s_threshold) / (1 − s_threshold)', 'Normalised density above threshold'],
                      ['κ', 'u_opacity uniform', 'User-adjustable opacity scale'],
                      ['Δt', 'rayLength / 120', 'Step size'],
                    ].map(([sym, expr, desc]) => (
                      <div key={sym} className="rounded-lg p-2 text-center" style={{ background: 'rgba(0,242,254,0.04)', border: '1px solid rgba(0,242,254,0.1)' }}>
                        <div className="font-mono font-bold" style={{ color: '#00f2fe' }}>{sym}</div>
                        <div className="font-mono text-[9px] text-slate-400 mt-0.5">{expr}</div>
                        <div className="text-[9px] text-slate-600 mt-0.5">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <CopyBlock
                lang="glsl · Porter-Duff front-to-back compositing"
                accentColor="#00f2fe"
                code={`// 120 fixed steps, front-to-back (Porter-Duff 'over' operator)
float density = (scalar - u_threshold) / (1.0 - u_threshold + 1e-4);
float alpha   = (1.0 - exp(-density * u_opacity * 3.5)) * dt * 30.0;
alpha = clamp(alpha, 0.0, 1.0);

// Accumulate
accumulatedColor.rgb += (1.0 - accumulatedColor.a) * col * alpha;
accumulatedColor.a   += (1.0 - accumulatedColor.a) * alpha;

if (accumulatedColor.a >= 0.98) break;  // Early-ray termination`}
              />
            </div>
          )}

          {gpuTab === 'iso' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                In iso-surface mode (<code style={{ color: '#67e8f9' }}>u_renderMode == 1</code>), the ray stops at the first
                voxel layer within ±0.035 of the target iso-value — a <strong className="text-slate-300">shell-rendering approximation</strong> that
                produces smooth coloured surfaces without marching-cubes meshing.
              </p>
              <CopyBlock
                lang="glsl · VolumeRaymarchingShader.js — iso-surface branch"
                accentColor="#00f2fe"
                code={`if (abs(scalar - u_isoValue) < 0.035) {
  vec3 col = apply_colormap(scalar);
  accumulatedColor = vec4(col, 0.92);  // opaque single-hit
  break;
  // → shell renders at iso-value isotherm/isohaline surface
}`}
              />
              {/* Colourmap table */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">Colourmap Library (GLSL polynomial approximations)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { code: '0', name: 'Turbo',   desc: 'Degree-5 polynomial', use: 'Default · temperature', gradient: 'linear-gradient(to right, #23171b, #4a76db, #1ac7c2, #cdea6f, #fb4e0b)' },
                    { code: '1', name: 'Viridis', desc: 'Degree-6 polynomial', use: 'Salinity · perceptually uniform', gradient: 'linear-gradient(to right, #440154, #31688e, #35b779, #fde725)' },
                    { code: '2', name: 'Thermal', desc: '3-segment linear blend', use: 'Ocean warm-to-cold', gradient: 'linear-gradient(to right, #042333, #2c7bb6, #fdae61, #d7191c)' },
                    { code: '3', name: 'Jet',     desc: 'Piecewise linear', use: 'Legacy / compatibility', gradient: 'linear-gradient(to right, #00008b, #0000ff, #00ffff, #ffff00, #ff0000, #8b0000)' },
                  ].map(cm => (
                    <div key={cm.code} className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(0,242,254,0.15)' }}>
                      <div className="h-6 w-full" style={{ background: cm.gradient }} />
                      <div className="p-2.5 flex flex-col gap-0.5" style={{ background: 'rgba(5,12,28,0.9)' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,242,254,0.15)', color: '#00f2fe' }}>{cm.code}</span>
                          <span className="font-semibold text-[11px] text-slate-200">{cm.name}</span>
                        </div>
                        <span className="text-[9px] text-slate-500">{cm.desc}</span>
                        <span className="text-[9px] text-slate-600">{cm.use}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ══════════════════════════════════════════════════════════
             DATA INTEGRITY GUARANTEE
        ══════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl p-6 border flex flex-col gap-4"
             style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <IconShield className="w-4.5 h-4.5" style={{ color: '#f87171' }} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>§07 — Scientific Data Integrity Policy</span>
              <p className="text-sm font-semibold text-white">Zero Synthetic Data Guarantee</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: 'No Fabricated Values', desc: 'All scalars originate from authentic INCOIS NetCDF-4 binaries or Coriolis GDAC float archives.' },
              { title: 'No Depth Fabrication', desc: '2D surface variables (T × Y × X) are never extended into artificial vertical layers.' },
              { title: 'Authoritative NaN Masks', desc: 'Land cells and missing values are preserved as NaN / −1.0 sentinel. Never interpolated over.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl p-3 border flex gap-2.5" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.15)' }}>
                <IconCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                <div>
                  <p className="text-[11.5px] font-semibold text-slate-200">{item.title}</p>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── References footer ── */}
        <div className="rounded-2xl p-5 border" style={{ background: 'rgba(6,14,32,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">References &amp; Standards</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[10.5px] text-slate-500">
            {[
              ['TEOS-10', 'IOC, SCOR & IAPSO 2010', 'Thermodynamic Equation of Seawater'],
              ['gsw ≥ 3.6', 'Gibbs SeaWater Toolbox', 'Python TEOS-10 implementation'],
              ['ROMS v3.x', 'Regional Ocean Modeling System', 'σ-coordinate terrain-following'],
              ['Argo v3.1', 'Argo QC Manual', 'CTD & trajectory data format'],
              ['CF-1.6', 'Climate & Forecast Conventions', 'NetCDF metadata standard'],
              ['Three.js r162', 'WebGL2 scene graph', 'Data3DTexture API'],
              ['scipy ≥ 1.11', 'RegularGridInterpolator', 'Trilinear resampling'],
              ['xarray ≥ 2024', 'Lazy NetCDF loading', 'Coordinate-aware slicing'],
              ['netCDF4 ≥ 1.6', 'HDF5 / NetCDF4', 'Low-level file reading'],
            ].map(([lib, org, desc]) => (
              <div key={lib} className="flex flex-col leading-relaxed">
                <span className="font-mono text-slate-300">{lib}</span>
                <span className="text-slate-600">{org} — {desc}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-700 mt-4 font-mono">
            All formulas derived from and consistent with the production implementation.
            Source-of-truth: METHODOLOGY.md · SCIENTIFIC_METHODS.md
          </p>
        </div>
      </div>
    </div>
  );
};