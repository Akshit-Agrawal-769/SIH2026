import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { rawCidV1, assertCidV1 } from '../lib/cid.mjs';

const V0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

test('rawCidV1 is a CIDv1 raw sha2-256 of the bytes', async () => {
  const bytes = new TextEncoder().encode('ocean tile');
  const cid = CID.parse(await rawCidV1(bytes));
  assert.equal(cid.version, 1);
  assert.equal(cid.code, 0x55);
  assert.equal(cid.multihash.code, 0x12);
  assert.equal(Buffer.from(cid.multihash.digest).toString('hex'), createHash('sha256').update(bytes).digest('hex'));
});

test('assertCidV1 accepts v1, rejects v0 and garbage', async () => {
  assertCidV1(await rawCidV1(new Uint8Array([7])));
  assert.throws(() => assertCidV1(V0), new RegExp(V0));
  assert.throws(() => assertCidV1('not-a-cid'), /not-a-cid/);
});
