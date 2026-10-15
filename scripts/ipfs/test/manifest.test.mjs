import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { collectFiles, buildManifest } from '../lib/manifest.mjs';
import { rawCidV1 } from '../lib/cid.mjs';

const TILE = Uint8Array.from([1, 2, 3, 4]);
const JSON_TEXT = '{"x":1}';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'wave-ipfs-'));
  await mkdir(join(dir, 'tiles/a/2019-01-29'), { recursive: true });
  await mkdir(join(dir, 'api'), { recursive: true });
  await writeFile(join(dir, 'tiles/a/2019-01-29/0.0.bin'), TILE);
  await writeFile(join(dir, 'tiles/.hidden'), 'skip me');
  await writeFile(join(dir, 'api/x.json'), JSON_TEXT);
  return dir;
}

test('collectFiles lists files sorted by POSIX path, skipping dotfiles', async () => {
  const dir = await fixture();
  const files = await collectFiles(dir, ['tiles', 'api']);
  assert.deepEqual(files.map((f) => f.path), ['api/x.json', 'tiles/a/2019-01-29/0.0.bin']);
  assert.deepEqual(files.map((f) => f.size), [Buffer.byteLength(JSON_TEXT), 4]);
  assert.equal(files[1].abs, join(dir, 'tiles/a/2019-01-29/0.0.bin'));
});

test('collectFiles records the sha256 of each file', async () => {
  const dir = await fixture();
  const files = await collectFiles(dir, ['tiles', 'api']);
  assert.equal(files[1].sha256, createHash('sha256').update(TILE).digest('hex'));
});

const META = async () => ({
  generator: 'gen', kuboVersion: '0.43.1', profile: 'unixfs-v1-2025', gitCommit: 'abc',
  root: await rawCidV1(new TextEncoder().encode('root')),
});

test('buildManifest produces the incois-ipfs-manifest/1 shape', async () => {
  const C = await rawCidV1(TILE);
  const meta = await META();
  const m = buildManifest([{ path: 'tiles/a.bin', cid: C, size: 4, sha256: 'ab' }], meta, new Date('2026-10-15T00:00:00Z'));
  assert.deepEqual(m, {
    schema: 'incois-ipfs-manifest/1',
    generated_at: '2026-10-15T00:00:00.000Z',
    generator: 'gen',
    kubo_version: '0.43.1',
    profile: 'unixfs-v1-2025',
    git_commit: 'abc',
    root: meta.root,
    files: { 'tiles/a.bin': { cid: C, size: 4, sha256: 'ab' } },
  });
});

test('buildManifest rejects duplicate paths', async () => {
  const C = await rawCidV1(TILE);
  const e = { path: 'tiles/a.bin', cid: C, size: 4, sha256: 'ab' };
  assert.throws(() => buildManifest([e, e], {}), /duplicate/i);
});

test('buildManifest rejects CIDv0', async () => {
  const meta = await META();
  assert.throws(
    () => buildManifest([{ path: 'tiles/a.bin', cid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', size: 4, sha256: 'ab' }], meta),
    /QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/
  );
});
