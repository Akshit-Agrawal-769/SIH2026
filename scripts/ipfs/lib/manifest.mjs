// Builds frontend/public/ipfs-manifest.json: POSIX path -> { cid, size, sha256 }.
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, posix } from 'node:path';
import { assertCidV1 } from './cid.mjs';

export const MANIFEST_SCHEMA = 'incois-ipfs-manifest/1';

async function walk(publicDir, rel, out) {
  const entries = await readdir(join(publicDir, ...rel.split('/')), { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const childRel = posix.join(rel, e.name);
    if (e.isDirectory()) {
      await walk(publicDir, childRel, out);
    } else if (e.isFile()) {
      const abs = join(publicDir, ...childRel.split('/'));
      const bytes = await readFile(abs);
      out.push({
        path: childRel,
        abs,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}

/** Recursively lists files under each `subdir` of `publicDir`, sorted by POSIX path. */
export async function collectFiles(publicDir, subdirs) {
  const out = [];
  for (const sub of subdirs) await walk(publicDir, sub, out);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Assembles the manifest object; rejects duplicate paths and any CIDv0. */
export function buildManifest(entries, meta, now = new Date()) {
  const files = {};
  for (const { path, cid, size, sha256 } of entries) {
    if (Object.hasOwn(files, path)) throw new Error(`Duplicate manifest path: ${path}`);
    assertCidV1(cid);
    files[path] = { cid, size, sha256 };
  }
  assertCidV1(meta.root);
  return {
    schema: MANIFEST_SCHEMA,
    generated_at: now.toISOString(),
    generator: meta.generator,
    kubo_version: meta.kuboVersion,
    profile: meta.profile,
    git_commit: meta.gitCommit,
    root: meta.root,
    files,
  };
}
