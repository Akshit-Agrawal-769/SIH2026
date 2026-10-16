#!/usr/bin/env node
// Reproduction for an IPFS Meshkit issue: the Kubo backend's CID format depends on the node's
// import config, while the S3 backend always computes CIDv1 raw sha2-256.
//
//   node repro-cid-version.mjs --api http://127.0.0.1:5001
import { init } from '@ipfs-meshkit/meshkit';
import { create as createKubo } from 'kubo-rpc-client';
import { CID } from 'multiformats/cid';
import { rawCidV1 } from './lib/cid.mjs';

const api = process.argv.includes('--api') ? process.argv[process.argv.indexOf('--api') + 1] : 'http://127.0.0.1:5001';
const pattern = (n) => Uint8Array.from({ length: n }, (_, i) => i % 251);
const payloads = [
  ['12 B', new TextEncoder().encode('hello meshki')],
  ['600 KiB', pattern(600 * 1024)],
  ['2 MiB', pattern(2 * 1024 * 1024)],
];

const kubo = createKubo({ url: api });
const { version } = await kubo.version();
const cfg = async (k) => JSON.stringify(await kubo.config.get(k).catch(() => null));
console.log(`Kubo ${version} at ${api}: Import.CidVersion=${await cfg('Import.CidVersion')} Import.UnixFSRawLeaves=${await cfg('Import.UnixFSRawLeaves')} Import.UnixFSChunker=${await cfg('Import.UnixFSChunker')}`);

const { meshkit } = await init({ nodes: [api] });
const rows = [];
for (const [label, bytes] of payloads) {
  const kuboCid = await meshkit.upload(bytes); // meshkit0 Kubo path: ipfs.add(payload, { pin: false })
  const s3Cid = await rawCidV1(bytes);         // meshkit0 S3 path: CID.create(1, raw.code, sha256(bytes))
  const c = CID.parse(kuboCid);
  rows.push({ size: label, 'Kubo-path CID': kuboCid, 'Kubo v/codec': `v${c.version}/0x${c.code.toString(16)}`, 'S3-path CID': s3Cid, match: kuboCid === s3Cid });
}
console.table(rows);
process.exit(0);
