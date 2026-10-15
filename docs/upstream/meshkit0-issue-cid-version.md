# Issue draft for IPFS-Meshkit/meshkit0

> Prepared by the WAVE team (SIH 2026, PS 26067). To be opened from a team member's GitHub
> account at https://github.com/IPFS-Meshkit/meshkit0/issues/new. Nothing has been posted yet.

---

**Title:** Same bytes get different CIDs on the Kubo and S3 backends (CIDv0 vs CIDv1); propose a `cidVersion` / `rawLeaves` option

### Environment

- `@ipfs-meshkit/meshkit` 1.2.1 (npm), Node 22
- Kubo 0.43.1 (official release binary), once with a default repo and once with the
  `unixfs-v1-2025` import profile

### What happens

`MeshkitClient` promises one interface over two backends, but the CID returned for the same
bytes depends on the backend and on the Kubo node's import config:

- **Kubo path:** `packages/core/src/create-client.ts` calls `ipfs.add(payload, { pin: false })` with
  no `cidVersion` / `rawLeaves`, so the node's `Import.*` defaults decide. A default Kubo repo
  produces **CIDv0 (`Qm…`, dag-pb)**.
- **S3 path:** `packages/core/src/create-filone-client.ts` computes
  `CID.create(1, raw.code, sha256(bytes))`, always **CIDv1 raw** over the whole file as one block.

### Reproduction

Script (in our repo): `scripts/ipfs/repro-cid-version.mjs`. It uploads three payloads through
`init({ nodes: [api] })` → `meshkit.upload(bytes)` and computes the S3-path CID locally with the
same algorithm.

**Default Kubo repo**

```
Kubo 0.43.1 at http://127.0.0.1:5002: Import.CidVersion=null Import.UnixFSRawLeaves=null Import.UnixFSChunker=null
┌─────────┬───────────┬──────────────────────────────────────────────────┬──────────────┬───────────────────────────────────────────────────────────────┬───────┐
│ (index) │ size      │ Kubo-path CID                                    │ Kubo v/codec │ S3-path CID                                                   │ match │
├─────────┼───────────┼──────────────────────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────┼───────┤
│ 0       │ '12 B'    │ 'QmYBvot6dZYFdg1TDq6jqLjskV8BVpjALAb4Ei14qnEb5S' │ 'v0/0x70'    │ 'bafkreie2n6a3zjdiiatw7jwfjczctksjmgqb6jist3b2jvpayjh6jlnxt4' │ false │
│ 1       │ '600 KiB' │ 'QmeqHWd7YuJc1yAQiampjeVfMVcK5zS63zD6vHG8qHN9xz' │ 'v0/0x70'    │ 'bafkreid5w7pafacsqljtgkssiegnlbxzu67dx5dhak4l5enyo6nyle5eo4' │ false │
│ 2       │ '2 MiB'   │ 'QmcNzqg5gHh8ZxMRhSvreBQrKRjAntV1jjg6eCqDLPhP4R' │ 'v0/0x70'    │ 'bafkreia6a5oi2r4k2imejyz6qmfgsxxqhjgsjcfwt3rhlpmji5qyxmn6dy' │ false │
└─────────┴───────────┴──────────────────────────────────────────────────┴──────────────┴───────────────────────────────────────────────────────────────┴───────┘
```

**Kubo with `ipfs config profile apply unixfs-v1-2025`** (CIDv1, raw leaves, 1 MiB chunks)

```
Kubo 0.43.1 at http://127.0.0.1:5001: Import.CidVersion=1 Import.UnixFSRawLeaves=true Import.UnixFSChunker="size-1048576"
┌─────────┬───────────┬───────────────────────────────────────────────────────────────┬──────────────┬───────────────────────────────────────────────────────────────┬───────┐
│ (index) │ size      │ Kubo-path CID                                                 │ Kubo v/codec │ S3-path CID                                                   │ match │
├─────────┼───────────┼───────────────────────────────────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────┼───────┤
│ 0       │ '12 B'    │ 'bafkreie2n6a3zjdiiatw7jwfjczctksjmgqb6jist3b2jvpayjh6jlnxt4' │ 'v1/0x55'    │ 'bafkreie2n6a3zjdiiatw7jwfjczctksjmgqb6jist3b2jvpayjh6jlnxt4' │ true  │
│ 1       │ '600 KiB' │ 'bafkreid5w7pafacsqljtgkssiegnlbxzu67dx5dhak4l5enyo6nyle5eo4' │ 'v1/0x55'    │ 'bafkreid5w7pafacsqljtgkssiegnlbxzu67dx5dhak4l5enyo6nyle5eo4' │ true  │
│ 2       │ '2 MiB'   │ 'bafybeihakzyqh6ih4iwgqily25hqovthaujdkbcfybornyhhbpoa63jwri' │ 'v1/0x70'    │ 'bafkreia6a5oi2r4k2imejyz6qmfgsxxqhjgsjcfwt3rhlpmji5qyxmn6dy' │ false │
└─────────┴───────────┴───────────────────────────────────────────────────────────────┴──────────────┴───────────────────────────────────────────────────────────────┴───────┘
```

### Expected

The same bytes get the same CID through every `MeshkitClient` backend, or at least the CID
format is chosen by meshkit, not by whatever config the Kubo node happens to have.

### Why it matters

- **Cross-backend dedupe and verification.** An app that stores a CID from one backend can't
  find or verify the same content through the other.
- **Browser verification.** `@helia/verified-fetch` and the IPFS docs' scientific-data
  guidance assume CIDv1. Your own Pinata integration in ZKMedical-Billing uses
  `cidVersion: 1`.
- **Large files.** For files above the chunk size (1 MiB with the profile), the S3 path hashes
  the whole file as a single raw block. That CID can never match a UnixFS DAG, and blocks over
  ~2 MiB cannot be transferred over Bitswap at all.

### Proposal

1. Add `upload(bytes, { cidVersion?: 0 | 1, rawLeaves?: boolean })` on the Kubo path, passed to
   `ipfs.add`. Default to `cidVersion: 1, rawLeaves: true` in the next major version (or now,
   with a CHANGELOG note), matching the S3 path for files up to one chunk.
2. For the S3 path, either build the UnixFS DAG (e.g. `ipfs-unixfs-importer` with 1 MiB chunks)
   so large files get the same CID as Kubo, or document that S3-path CIDs are bucket keys,
   not IPFS DAG roots, for files above the chunk size.
3. Add a Kubo integration test asserting `kubo.upload(x) === s3.upload(x)` for a < 1 MiB payload.

We're happy to send a PR for (1) and (3) if this direction works for you.

### How we found it

WAVE (INCOIS 3D ocean-data visualization) publishes 85 ocean-data tiles through meshkit 1.2.1.
Our publish script refuses non-CIDv1 output and cross-checks each file's meshkit CID against
the CID inside a directory root and the CIDv1-raw CID. With the profile, all 85 files (< 1 MiB
each) match.
