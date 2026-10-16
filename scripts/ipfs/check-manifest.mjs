#!/usr/bin/env node
// Fails (exit 1) when frontend/public/ipfs-manifest.json no longer matches the files it describes,
// so "IPFS ✓ verified" can never be shown for stale data. Run after regenerating tiles; re-publish to fix.
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest } from './lib/check.mjs';

const publicDir = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '../../frontend/public'));
let manifest;
try {
  manifest = JSON.parse(await readFile(join(publicDir, 'ipfs-manifest.json'), 'utf8'));
} catch {
  console.log('No ipfs-manifest.json: nothing to check.');
  process.exit(0);
}
const problems = await checkManifest(publicDir, manifest);
if (problems.length) {
  console.error(`IPFS manifest is stale (${problems.length}):\n  ${problems.join('\n  ')}\nRe-run: cd scripts/ipfs && npm run publish:ipfs`);
  process.exit(1);
}
console.log(`IPFS manifest OK: ${Object.keys(manifest.files).length} files match.`);
