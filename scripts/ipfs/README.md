# WAVE IPFS tools

Publishes WAVE's precomputed ocean tiles (`frontend/public/tiles/**`) and catalog JSON
(`frontend/public/api/**`) to IPFS with **[IPFS Meshkit](https://github.com/IPFS-Meshkit/meshkit0)**
(`@ipfs-meshkit/meshkit` 1.2.1) on top of a **Kubo** node, and writes
`frontend/public/ipfs-manifest.json`, which the frontend uses to fetch and *verify* tiles by CID
with `@helia/verified-fetch`.

Only the derived tiles and JSON (~45 MB, 85 files) are published, not the 9.2 GB source NetCDF.

## 1. Run a Kubo node

**Option A: Docker (recommended)**

```bash
docker compose up -d kubo
```

`infra/kubo/001-profile.sh` applies the `unixfs-v1-2025` profile before the daemon starts.
RPC is on `127.0.0.1:5001` (loopback only; it is an admin API, never expose it). The gateway
is on `127.0.0.1:8080`.

**Option B: Kubo binary** ([install](https://docs.ipfs.tech/install/command-line/))

```bash
ipfs init --profile unixfs-v1-2025      # or, on an existing repo:
ipfs config profile apply unixfs-v1-2025
ipfs daemon
```

### Why the profile matters

`unixfs-v1-2025` makes Kubo produce **CIDv1 with raw leaves and 1 MiB chunks**, the IPFS docs'
recommendation for scientific data. With it, every tile (< 1 MiB) gets the *same* CID from
meshkit's Kubo path, from meshkit's S3 path (`CIDv1 raw sha2-256`), and from inside the
directory root. A default node would produce legacy CIDv0 (`Qm…`), so `publish.mjs`
**refuses to run** without the profile.

## 2. Publish

```bash
cd scripts/ipfs
npm install
npm run publish:ipfs            # KUBO_API=http://127.0.0.1:5001 by default
node publish.mjs --dry-run      # list the 85 files without touching IPFS
```

For every file the script uploads and pins through meshkit, reads it back byte-for-byte,
then adds the whole tree once to get a single **root CID**. It checks three CIDs per file
(meshkit, inside the root, CIDv1-raw) and stops on any mismatch.

## 3. The manifest

`frontend/public/ipfs-manifest.json`:

```json
{
  "schema": "incois-ipfs-manifest/1",
  "generated_at": "…", "generator": "scripts/ipfs/publish.mjs (@ipfs-meshkit/meshkit 1.2.1)",
  "kubo_version": "0.43.1", "profile": "unixfs-v1-2025", "git_commit": "…",
  "root": "bafybei…",
  "files": { "tiles/temperature/2019-01-29/0.0.bin": { "cid": "bafkrei…", "size": 582432, "sha256": "…" } }
}
```

Commit it. A CID proves the bytes are intact, but not *who* published them, so Git history is
the trusted channel that says which CIDs are WAVE's (the same pattern as ORCESTRA's
`pinlist.yaml`).

## 4. Keep the data reachable

Content stays retrievable only while some node provides it. A laptop node goes offline when
the laptop sleeps. To replicate everything, pin the single root:

```bash
ipfs pin add <root>                     # on any other Kubo node
```

or pin `<root>` with a pinning service (Pinata, Filebase, …). Static files in
`frontend/public` stay as the final fallback, so the app never depends on IPFS alone.

> **Before pinning to public IPFS:** confirm that the INCOIS / CMEMS data terms allow
> redistributing these derived tiles. Replicated content cannot be recalled.

## 5. Benchmark

```bash
npm run bench     # needs Kubo + `npx vite preview` (frontend) running; writes docs/IPFS_BENCHMARK.md
```
