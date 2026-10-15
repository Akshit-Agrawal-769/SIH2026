// Detects a stale IPFS manifest: tiles/JSON regenerated or added without re-publishing.
// Node built-ins only, so CI can run it without installing the publish tooling.
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, posix } from 'node:path';

async function listFiles(publicDir, rel, out) {
  let entries;
  try {
    entries = await readdir(join(publicDir, ...rel.split('/')), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const child = posix.join(rel, e.name);
    if (e.isDirectory()) await listFiles(publicDir, child, out);
    else if (e.isFile()) out.push(child);
  }
}

/** Problems as human-readable strings; [] when every published file matches the manifest. */
export async function checkManifest(publicDir, manifest, subdirs = ['tiles', 'api']) {
  const problems = [];
  const onDisk = [];
  for (const sub of subdirs) await listFiles(publicDir, sub, onDisk);
  for (const [path, entry] of Object.entries(manifest.files)) {
    let bytes;
    try {
      bytes = await readFile(join(publicDir, ...path.split('/')));
    } catch {
      problems.push(`missing on disk: ${path}`);
      continue;
    }
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) problems.push(`changed since publish: ${path}`);
  }
  for (const path of onDisk) if (!Object.hasOwn(manifest.files, path)) problems.push(`not in manifest: ${path}`);
  return problems;
}
