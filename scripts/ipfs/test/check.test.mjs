import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checkManifest } from '../lib/check.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'wave-check-'));
  await mkdir(join(dir, 'tiles/t/2019-01-29'), { recursive: true });
  await mkdir(join(dir, 'api'), { recursive: true });
  await writeFile(join(dir, 'tiles/t/2019-01-29/0.0.bin'), 'AAAA');
  await writeFile(join(dir, 'api/x.json'), '{}');
  const manifest = { files: {
    'tiles/t/2019-01-29/0.0.bin': { cid: 'bafk1', size: 4, sha256: sha('AAAA') },
    'api/x.json': { cid: 'bafk2', size: 2, sha256: sha('{}') },
  } };
  return { dir, manifest };
}

test('checkManifest: a manifest that matches the files has no problems', async () => {
  const { dir, manifest } = await fixture();
  assert.deepEqual(await checkManifest(dir, manifest), []);
});

test('checkManifest: reports changed, missing and unpublished files', async () => {
  const { dir, manifest } = await fixture();
  await writeFile(join(dir, 'tiles/t/2019-01-29/0.0.bin'), 'BBBB');           // regenerated tile
  await writeFile(join(dir, 'tiles/t/2019-01-29/10.0.bin'), 'CCCC');          // new, unpublished
  manifest.files['api/gone.json'] = { cid: 'bafk3', size: 1, sha256: 'x' };   // deleted file
  const problems = await checkManifest(dir, manifest);
  assert.deepEqual(problems.sort(), [
    'changed since publish: tiles/t/2019-01-29/0.0.bin',
    'missing on disk: api/gone.json',
    'not in manifest: tiles/t/2019-01-29/10.0.bin',
  ]);
});
