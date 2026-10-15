#!/usr/bin/env node
// Retrieval benchmark for WAVE tiles: static HTTP vs Kubo gateway vs Helia verified-fetch.
//
//   npm run bench -- --static http://localhost:4173 --gateway http://127.0.0.1:8080
//
// Writes docs/IPFS_BENCHMARK.md. Every response is checked against the manifest's SHA-256,
// and failures are recorded, not hidden.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, platform, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVerifiedFetch } from '@helia/verified-fetch';
import { summarize } from './lib/stats.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const a = {
    n: 12,
    runs: 30,
    static: 'http://localhost:4173',
    gateway: process.env.KUBO_GATEWAY || 'http://127.0.0.1:8080',
    publicGateway: 'https://trustless-gateway.link',
    public: resolve(HERE, '../../frontend/public'),
    out: resolve(HERE, '../../docs/IPFS_BENCHMARK.md'),
    note: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--n') a.n = Number(v());
    else if (k === '--runs') a.runs = Number(v());
    else if (k === '--static') a.static = v().replace(/\/+$/, '');
    else if (k === '--gateway') a.gateway = v().replace(/\/+$/, '');
    else if (k === '--public-gateway') a.publicGateway = v().replace(/\/+$/, '');
    else if (k === '--public') a.public = resolve(v());
    else if (k === '--out') a.out = resolve(v());
    else if (k === '--note') a.note = v();
    else throw new Error(`Unknown argument: ${k}`);
  }
  return a;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const host = (url) => new URL(url).host;
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const pct = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : '—');

/** One timed fetch: { ok, ttfb, total, bytes, intact, error }. */
async function timed(doFetch, expectSha) {
  const t0 = performance.now();
  try {
    const res = await doFetch(AbortSignal.timeout(TIMEOUT_MS));
    const ttfb = performance.now() - t0;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const total = performance.now() - t0;
    return { ok: true, ttfb, total, bytes: bytes.length, intact: sha256(bytes) === expectSha };
  } catch (e) {
    return { ok: false, total: performance.now() - t0, error: String(e?.message || e).slice(0, 120) };
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(join(a.public, 'ipfs-manifest.json'), 'utf8'));
  const tilePaths = Object.keys(manifest.files).filter((p) => p.startsWith('tiles/')).sort();
  const step = tilePaths.length / Math.min(a.n, tilePaths.length);
  const tiles = Array.from({ length: Math.min(a.n, tilePaths.length) }, (_, i) => tilePaths[Math.floor(i * step)]);

  const verifiedLocal = await createVerifiedFetch({ gateways: [a.gateway], routers: [], allowInsecure: true, allowLocal: true });
  const verifiedPublic = await createVerifiedFetch({ gateways: [a.publicGateway], routers: [] });

  const paths = [
    { id: 'static', label: `Static HTTP (${host(a.static)})`, fetch: (p, cid, signal) => fetch(`${a.static}/${p}`, { signal }) },
    { id: 'gateway', label: `Kubo gateway, unverified (${host(a.gateway)})`, fetch: (p, cid, signal) => fetch(`${a.gateway}/ipfs/${cid}`, { signal }) },
    { id: 'verified-local', label: `verified-fetch → Kubo gateway (${host(a.gateway)})`, fetch: (p, cid, signal) => verifiedLocal(`ipfs://${cid}`, { signal }) },
    { id: 'verified-public', label: `verified-fetch → public gateway (${host(a.publicGateway)})`, fetch: (p, cid, signal) => verifiedPublic(`ipfs://${cid}`, { signal }) },
  ];

  const results = {};
  for (const path of paths) {
    const cold = [];
    const warm = [];
    for (let i = 0; i < a.runs; i++) {
      const p = tiles[i % tiles.length];
      const entry = manifest.files[p];
      const r = await timed((signal) => path.fetch(p, entry.cid, signal), entry.sha256);
      (i < tiles.length ? cold : warm).push(r);
    }
    results[path.id] = { cold, warm };
    const all = [...cold, ...warm];
    console.log(`${path.label}: ${all.filter((r) => r.ok).length}/${all.length} ok`);
  }

  // Cost of the integrity check itself: one SHA-256 over each tile's bytes.
  const hashMs = [];
  for (const p of tiles) {
    const bytes = await readFile(join(a.public, ...p.split('/')));
    const t0 = performance.now();
    sha256(bytes);
    hashMs.push(performance.now() - t0);
  }

  const row = (label, rs) => {
    const ok = rs.filter((r) => r.ok);
    const t = summarize(ok.map((r) => r.total));
    const f = summarize(ok.map((r) => r.ttfb));
    return `| ${label} | ${rs.length} | ${fmt(t.median)} | ${fmt(t.p95)} | ${fmt(f.median)} | ${pct(ok.length, rs.length)} | ${pct(ok.filter((r) => r.intact).length, ok.length)} |`;
  };
  // Rank on cold fetches: warm verified-fetch repeats are served from its in-memory block cache.
  const medianCold = (id) => summarize(results[id].cold.filter((r) => r.ok).map((r) => r.total)).median;
  const ranked = paths
    .map((p) => ({ label: p.label, m: medianCold(p.id) }))
    .filter((x) => Number.isFinite(x.m))
    .sort((x, y) => x.m - y.m);
  const failures = paths.flatMap((p) => {
    const errs = [...results[p.id].cold, ...results[p.id].warm].filter((r) => !r.ok).map((r) => r.error);
    return errs.length ? [`- **${p.label}**: ${errs.length} failed — e.g. \`${errs[0]}\``] : [];
  });
  const tileBytes = manifest.files[tiles[0]].size;

  const md = `# IPFS retrieval benchmark

Generated by \`scripts/ipfs/benchmark.mjs\` on **${new Date().toISOString()}**.

| | |
|---|---|
| Tiles | ${tiles.length} distinct tiles (${(tileBytes / 1024).toFixed(0)} KiB each), ${a.runs} fetches per path |
| Kubo | ${manifest.kubo_version}, profile \`${manifest.profile}\`, root \`${manifest.root}\` |
| Gateways | local \`${host(a.gateway)}\`, public \`${host(a.publicGateway)}\` |
| Machine | ${cpus()[0]?.model ?? 'unknown CPU'}, ${platform()} ${release()}, Node ${process.version}${a.note ? `, ${a.note}` : ''} |

"Cold" is the first fetch of each tile, "warm" the repeats. Times are milliseconds; TTFB is the
time to the response headers. Integrity compares the SHA-256 of the received bytes with the
manifest. **Warm verified-fetch rows are served from verified-fetch's in-memory block cache**
(no network), so compare paths on the cold table.

| Path · cold | Fetches | p50 total | p95 total | p50 TTFB | Success | Integrity |
|---|---|---|---|---|---|---|
${paths.map((p) => row(p.label, results[p.id].cold)).join('\n')}

| Path · warm | Fetches | p50 total | p95 total | p50 TTFB | Success | Integrity |
|---|---|---|---|---|---|---|
${paths.map((p) => row(p.label, results[p.id].warm)).join('\n')}

**Cost of verification:** one SHA-256 over a tile takes p50 **${fmt(summarize(hashMs).median)} ms**
(p95 ${fmt(summarize(hashMs).p95)} ms) on this machine. verified-fetch adds that hashing plus
block handling on top of the gateway request.

## What this shows

${ranked.length ? `Cold fetches, fastest first: ${ranked.map((x) => `${x.label} ${fmt(x.m)} ms`).join(' → ')}.` : 'No path completed successfully.'}

${[a.static, a.gateway].every((u) => /\/\/(localhost|127\.0\.0\.1)[:/]/.test(u))
    ? 'Every local path here runs on the same machine, so differences of a few milliseconds reflect the servers used (e.g. a single-threaded static file server), not network delivery. Across a real network, a CDN-hosted static copy will be the fastest path; verified-fetch then costs one gateway round trip plus hashing (above).'
    : 'Across a network, the CDN-hosted static copy is expected to be the fastest path; verified-fetch costs one gateway round trip plus hashing (above).'}

IPFS is not here for speed. It adds **verifiability**: a verified-fetch response is hash-checked against a CID taken from the
Git-tracked manifest, so no gateway can alter ocean data unnoticed. It also adds
**replication**: anyone can mirror the whole dataset with one \`ipfs pin add ${manifest.root}\`.
That is why the app keeps the static copy as its final fallback.

${failures.length ? `## Failures (recorded, not hidden)\n\n${failures.join('\n')}\n\nA public-gateway failure usually means no reachable node is providing the content (e.g. it is pinned only on a private or firewalled Kubo) or the network blocks the gateway; pin the root on a public node or pinning service to fix it.` : '## Failures\n\nNone.'}
`;
  await writeFile(a.out, md);
  console.log(`wrote ${a.out}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
