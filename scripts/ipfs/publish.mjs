#!/usr/bin/env node
// Publish WAVE's precomputed tiles + JSON to IPFS through IPFS Meshkit (meshkit0) and Kubo,
// then write frontend/public/ipfs-manifest.json (POSIX path -> CIDv1).
//
//   npm run publish:ipfs                      # Kubo RPC at $KUBO_API or http://127.0.0.1:5001
//   node publish.mjs --dry-run                # list what would be published
//   node publish.mjs --public <dir> --api <url>
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init } from '@ipfs-meshkit/meshkit';
import { create as createKubo } from 'kubo-rpc-client';
import { collectFiles, buildManifest } from './lib/manifest.mjs';
import { assertCidV1, rawCidV1 } from './lib/cid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = 'unixfs-v1-2025';
const ONE_MIB = 1024 * 1024;
const PROFILE_HINT = `Kubo is not using the ${PROFILE} profile (CIDv1, raw leaves). ` +
  `Run "ipfs config profile apply ${PROFILE}" and restart the daemon, or use the ` +
  `docker-compose kubo service (infra/kubo/001-profile.sh).`;

function parseArgs(argv) {
  const args = { public: resolve(HERE, '../../frontend/public'), api: process.env.KUBO_API || 'http://127.0.0.1:5001', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--public') args.public = resolve(argv[++i]);
    else if (argv[i] === '--api') args.api = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function meshkitVersion() {
  try {
    return createRequire(import.meta.url)('@ipfs-meshkit/meshkit/package.json').version;
  } catch {
    return '1.2.1';
  }
}

function gitCommit(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const files = await collectFiles(args.public, ['tiles', 'api']);
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  console.log(`${files.length} files, ${(totalBytes / 1e6).toFixed(1)} MB under ${args.public}`);
  if (args.dryRun) {
    for (const f of files) console.log(`  ${f.path}  ${f.size}`);
    return;
  }

  const kubo = createKubo({ url: args.api });
  const { version: kuboVersion } = await kubo.version();
  const cidVersion = await kubo.config.get('Import.CidVersion').catch(() => null);
  if (Number(cidVersion) !== 1) fail(PROFILE_HINT);

  const { meshkit } = await init({ nodes: [args.api] });
  console.log(`Kubo ${kuboVersion} at ${args.api}, meshkit ${meshkitVersion()}`);

  // 1. Per-file upload through meshkit0, with pin + byte-exact read-back.
  const entries = [];
  const contents = [];
  for (const f of files) {
    const bytes = await readFile(f.abs);
    const cid = await meshkit.upload(bytes);
    try { assertCidV1(cid); } catch (e) { fail(`${f.path}: ${e.message}\n${PROFILE_HINT}`); }
    await meshkit.pin(cid);
    const back = await meshkit.retrieve(cid);
    if (!Buffer.from(back).equals(bytes)) fail(`${f.path}: retrieved bytes differ from the file`);
    entries.push({ path: f.path, cid, size: f.size, sha256: f.sha256 });
    contents.push({ path: f.path, content: bytes });
  }

  // 2. One directory root holding every file at its manifest path.
  let root = null;
  const dirCids = new Map();
  for await (const added of kubo.addAll(contents, { wrapWithDirectory: true, pin: true })) {
    if (added.path === '') root = added.cid.toString();
    else dirCids.set(added.path, added.cid.toString());
  }
  if (!root) fail('Kubo did not return a wrapping directory CID');

  // 3. Cross-backend invariant: meshkit Kubo CID == CID inside the root == meshkit S3-path CID.
  const mismatches = [];
  for (const [i, e] of entries.entries()) {
    const inDir = dirCids.get(e.path);
    const raw = e.size <= ONE_MIB ? await rawCidV1(contents[i].content) : null;
    if (inDir !== e.cid || (raw && raw !== e.cid)) mismatches.push({ path: e.path, meshkit: e.cid, inRoot: inDir, rawV1: raw });
  }
  if (mismatches.length) {
    console.table(mismatches);
    fail(`${mismatches.length} CID mismatch(es) between meshkit, the directory root and CIDv1-raw`);
  }

  const manifest = buildManifest(entries, {
    generator: `scripts/ipfs/publish.mjs (@ipfs-meshkit/meshkit ${meshkitVersion()})`,
    kuboVersion,
    profile: PROFILE,
    gitCommit: gitCommit(args.public),
    root,
  });
  const out = join(args.public, 'ipfs-manifest.json');
  await writeFile(out, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ ${entries.length} files pinned, 0 CID mismatches`);
  console.log(`  root  ${root}`);
  console.log(`  wrote ${out} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  process.exit(0);
}

main().catch((e) => fail(e?.stack || String(e)));
