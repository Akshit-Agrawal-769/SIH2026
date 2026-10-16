// CID helpers for the WAVE IPFS publisher.
// rawCidV1 mirrors how @ipfs-meshkit/meshkit's S3 path names content
// (CIDv1, raw codec, sha2-256), which is also what a Kubo node running the
// unixfs-v1-2025 profile produces for any file that fits in one 1 MiB block.
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

/** CIDv1 (raw, sha2-256) of `bytes`, base32 string. */
export async function rawCidV1(bytes) {
  return CID.create(1, raw.code, await sha256.digest(bytes)).toString();
}

/** Throws unless `cid` parses as a version-1 CID. */
export function assertCidV1(cid) {
  let parsed;
  try {
    parsed = CID.parse(String(cid));
  } catch {
    throw new Error(`Not a valid CID: ${cid}`);
  }
  if (parsed.version !== 1) {
    throw new Error(`CIDv0 not allowed (${cid}); run Kubo with the unixfs-v1-2025 profile`);
  }
}
