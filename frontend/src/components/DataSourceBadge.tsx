import React, { useEffect, useState } from 'react';
import { HardDrive, Server, ShieldCheck } from 'lucide-react';
import {
  getDataSourceMode,
  getLoadedManifest,
  onModeChange,
  onTileSource,
  setDataSourceMode,
  type DataSourceMode,
  type TileSourceInfo,
} from '../api/ipfsSource';

const MODES: { value: DataSourceMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Live API, then IPFS, then the static copy' },
  { value: 'ipfs', label: 'IPFS', hint: 'Content-addressed tiles, hash-verified in your browser' },
  { value: 'server', label: 'Server', hint: 'Live API, then the static copy (no IPFS)' },
];

const shortCid = (cid: string) => (cid.length > 14 ? `${cid.slice(0, 6)}…${cid.slice(-4)}` : cid);

/**
 * Where the field on screen came from, and a switch for the data-source mode.
 * "IPFS ✓ verified" is shown only for bytes returned by @helia/verified-fetch for the manifest CID.
 */
export const DataSourceBadge: React.FC = () => {
  const [info, setInfo] = useState<TileSourceInfo | null>(null);
  const [mode, setMode] = useState<DataSourceMode>(getDataSourceMode);

  useEffect(() => {
    const offTile = onTileSource(setInfo);
    const offMode = onModeChange(setMode);
    return () => { offTile(); offMode(); };
  }, []);

  if (!info) return null;
  const manifest = getLoadedManifest();
  const verified = info.source === 'ipfs' && Boolean(info.cid);

  return (
    <div className="fixed left-4 bottom-24 w-72 z-30 glass-panel rounded-xl px-3 py-2.5 text-[11px] flex flex-col gap-2 border border-white/10">
      <div className="flex items-center gap-2 min-w-0" aria-live="polite">
        {verified ? (
          <>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
            <span
              className="text-emerald-300 font-medium"
              title="Fetched by content ID with Helia verified-fetch: the bytes were hashed in your browser and matched the CID, so no gateway could have altered them."
            >
              IPFS ✓ verified
            </span>
            <a
              href={`https://trustless-gateway.link/ipfs/${info.cid}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto font-mono text-ocean-text-secondary hover:text-white truncate"
              title={`CID ${info.cid}${manifest ? `\nmanifest root ${manifest.root}\ncommit ${manifest.git_commit.slice(0, 7)}` : ''}`}
            >
              {shortCid(info.cid!)}
            </a>
          </>
        ) : info.source === 'api' ? (
          <>
            <Server className="w-4 h-4 text-sky-300 shrink-0" aria-hidden />
            <span className="text-sky-200">Live API</span>
          </>
        ) : (
          <>
            <HardDrive className="w-4 h-4 text-ocean-text-secondary shrink-0" aria-hidden />
            <span className="text-ocean-text-secondary" title="Bundled copy shipped with the site; not hash-verified.">
              Static (unverified)
            </span>
          </>
        )}
      </div>
      <div role="radiogroup" aria-label="Data source" className="grid grid-cols-3 gap-1 rounded-lg bg-black/30 p-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            title={m.hint}
            onClick={() => setDataSourceMode(m.value)}
            className={`rounded-md py-1 transition-colors ${
              mode === m.value ? 'bg-white/15 text-white' : 'text-ocean-text-secondary hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
};
