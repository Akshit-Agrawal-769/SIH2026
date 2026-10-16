# IPFS Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve WAVE's precomputed tiles over IPFS (published with Meshkit0, fetched and verified with Helia) as a third data source, with a UI badge and a benchmark.

**Architecture:** A Node publish script uploads `frontend/public/{tiles,api}` to Kubo through `@ipfs-meshkit/meshkit` and writes `frontend/public/ipfs-manifest.json` (path → CID). The frontend's new `ipfsSource.ts` resolves a tile to its CID and fetches it with `@helia/verified-fetch`; `client.ts::loadTile()` orders sources by a persisted mode (`auto | ipfs | server`). A benchmark script measures static vs local-gateway vs public-verified retrieval.

**Tech Stack:** Node ≥ 20 ESM, `@ipfs-meshkit/meshkit@1.2.1` (exact), `kubo-rpc-client@^7.1.0`, `multiformats@^14`, Kubo `v0.43.1`, `@helia/verified-fetch@^8.1.2`, React 18 + TypeScript + Vite 5, vitest 2, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-15-ipfs-data-layer-design.md`

**Revision 2 (2026-10-15 19:00):** folds in `reports/IPFS stack and mentor profile 2.md` — CIDv1 end to end via Kubo profile `unixfs-v1-2025`, a directory root CID, cross-backend CID check, honest badge/benchmark, and a prepared meshkit0 upstream issue + patch (new Task 7).

## Global Constraints

- Branch `feat/ipfs-meshkit`; never commit to `main`. Commit author `Akshit Agrawal <akshitisagrawal@gmail.com>`.
- Manifest schema string: `incois-ipfs-manifest/1`; file `frontend/public/ipfs-manifest.json`; shape `{ schema, generated_at, generator, kubo_version, profile, git_commit, root, files: { "<posix path>": { cid, size, sha256 } } }`; keys are POSIX paths relative to `frontend/public` (e.g. `tiles/temperature/2019-01-29/0.0.bin`); `root` is the CID of the directory holding every published file at those paths.
- Kubo runs with `ipfs config profile apply unixfs-v1-2025` (CIDv1, raw leaves, 1 MiB chunks). Every CID in the manifest must be CIDv1; publishing fails on any CIDv0 (`Qm…`).
- `@ipfs-meshkit/meshkit` pinned to exactly `1.2.1`; attach with `init({ nodes: [KUBO_API] })`, never `localNode: true`. Port 5001 is bound to 127.0.0.1 only.
- Mode values `auto | ipfs | server`; `localStorage` key `wave.dataSource`; default `auto`.
- The badge says `IPFS ✓ verified` only for bytes returned by `@helia/verified-fetch` for the manifest CID; otherwise `Live API` or `Static (unverified)`.
- IPFS request timeout `8000` ms. Gateways from `VITE_IPFS_GATEWAYS` (comma-separated); default `https://trustless-gateway.link`, with `http://127.0.0.1:8080` prepended when `import.meta.env.DEV`.
- Kubo RPC default `http://127.0.0.1:5001` (env `KUBO_API`); gateway `http://127.0.0.1:8080` (env `KUBO_GATEWAY`).
- Nothing existing is removed; static files stay the final fallback; with no manifest the app behaves exactly as on `main`.
- The repo lives on Windows. Never run `npm install` inside the mounted `frontend/` or `scripts/ipfs/` (it would swap Windows-native binaries such as esbuild for Linux ones). Install, test and build in a VM-local copy (`$HOME/work/SIH2026`, synced with `rsync --exclude node_modules`), then copy only source, `package.json` and `package-lock.json` back.
- Git-ignore `.ipfs/` and `scripts/ipfs/node_modules/`.
- Run every git command from the VM as `git -c core.autocrlf=true …` (the Windows checkout uses CRLF; without it git reports ~200 phantom modifications).

## Review Focus

1. Manifest absent, 404, HTML (SPA fallback) or malformed JSON → `loadIpfsManifest()` returns `null`, no console error spam, and tiles load exactly as today. (Task 3 test `returns null for html / invalid manifest`.)
2. Tile not in manifest (live-built months) → IPFS step is skipped silently and the next source is used. (Task 4 test `auto: tile missing from manifest falls to static`.)
3. Gateways down or slow → each IPFS fetch aborts at 8000 ms and falls through to static; IPFS bytes that fail `parseOceanTileBuffer` also fall through rather than surfacing an error. (Task 4 tests `ipfs failure falls back to static`, `corrupt ipfs bytes fall back to static`.)
4. Live API answers JSON 404 "no data" in `auto` → still `NoDataError`, IPFS is not consulted. (Task 4 test `auto: live no-data stays NoDataError`.)
5. `localStorage` throws (private mode) → mode reads as `auto` and setting it does not throw; switching mode clears the tile cache so the next fetch uses the new source. (Task 3 test `mode survives throwing storage`; Task 4 test `mode change clears cache`.)
6. A node without the profile (someone's default Kubo) → publish exits 1 with the profile hint instead of writing a CIDv0 manifest. (Task 1 test: `buildManifest` throws on v0; Task 2 Step 2.)

---

### Task 1: Publish tooling — manifest library

**Files:**
- Create: `scripts/ipfs/package.json`, `scripts/ipfs/lib/manifest.mjs`, `scripts/ipfs/lib/cid.mjs`, `scripts/ipfs/test/manifest.test.mjs`, `scripts/ipfs/test/cid.test.mjs`
- Modify: `.gitignore` (append `.ipfs/`, `scripts/ipfs/node_modules/`)

**Interfaces:**
- Produces:
  - `collectFiles(publicDir: string, subdirs: string[]): Promise<{ path: string; abs: string; size: number; sha256: string }[]>` — recursive, POSIX `path` relative to `publicDir`, sorted by `path`, skips dotfiles, `sha256` lowercase hex.
  - `buildManifest(entries: { path: string; cid: string; size: number; sha256: string }[], meta: { generator: string; kuboVersion: string; profile: string; gitCommit: string; root: string }, now?: Date): Manifest` (shape per Global Constraints; throws on duplicate path or any CIDv0 via `assertCidV1`).
  - `lib/cid.mjs`: `assertCidV1(cid: string): void` (throws `Error` naming the CID if unparsable or version 0); `rawCidV1(bytes: Uint8Array): Promise<string>` = base32 `CID.create(1, raw.code, sha256(bytes))` — the algorithm meshkit0's S3 path uses.
  - `package.json`: `"type": "module"`, `"engines": { "node": ">=20" }`, deps `@ipfs-meshkit/meshkit@1.2.1`, `kubo-rpc-client@^7.1.0`, `multiformats@^14.0.5`, `@helia/verified-fetch@^8.1.2`; scripts `test: node --test test/`, `publish:ipfs: node publish.mjs`, `bench: node benchmark.mjs`. (Script name `publish:ipfs`, not `publish`, so `npm publish` is never triggered by accident.)

- [ ] **Step 1: Write failing tests** in `test/manifest.test.mjs` using a temp dir with `tiles/a/2019-01-29/0.0.bin` (4 bytes), `api/x.json`, and `tiles/.hidden`:
  - `collectFiles(dir, ['tiles','api'])` deep-equals paths `['api/x.json', 'tiles/a/2019-01-29/0.0.bin']` with sizes `[n, 4]`.
  - `collectFiles` gives the 4-byte file `sha256` equal to `createHash('sha256')` of its bytes.
  - `buildManifest([{path:'tiles/a.bin',cid:C,size:4,sha256:'ab'}], {generator:'gen',kuboVersion:'0.43.1',profile:'unixfs-v1-2025',gitCommit:'abc',root:R}, new Date('2026-10-15T00:00:00Z'))` deep-equals `{ schema:'incois-ipfs-manifest/1', generated_at:'2026-10-15T00:00:00.000Z', generator:'gen', kubo_version:'0.43.1', profile:'unixfs-v1-2025', git_commit:'abc', root:R, files:{ 'tiles/a.bin':{cid:C,size:4,sha256:'ab'} } }` where `C`, `R` are CIDv1 strings made with `rawCidV1`.
  - `buildManifest` throws on a duplicate `path`, and on a file CID `QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG` (v0).
  - `cid.test.mjs`: `rawCidV1(bytes)` parses to version 1, codec `0x55`, and its multihash digest equals sha256(bytes); `assertCidV1` passes it, throws on the v0 string above and on `'not-a-cid'`.
- [ ] **Step 2:** In `$HOME/work/SIH2026/scripts/ipfs`: `npm install && npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement `lib/cid.mjs` (`multiformats/cid`, `multiformats/codecs/raw`, `multiformats/hashes/sha2`) and `lib/manifest.mjs` (`readdir` with `withFileTypes`, `path.posix` joins).
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Copy back source + `package.json` + `package-lock.json`; commit `feat(ipfs): manifest builder for Meshkit publish`.

### Task 2: Publish script + Kubo service

**Files:**
- Create: `scripts/ipfs/publish.mjs`, `scripts/ipfs/README.md`, `infra/kubo/001-profile.sh`
- Modify: `docker-compose.yml` (add `kubo` service + `ipfs_data` volume)

**Interfaces:**
- Consumes: `collectFiles`, `buildManifest`, `assertCidV1`, `rawCidV1` (Task 1).
- Produces: `frontend/public/ipfs-manifest.json` per Global Constraints. CLI flags: `--public <dir>` (default `../../frontend/public` resolved from the script), `--api <url>` (default `KUBO_API`), `--dry-run` (hash nothing, list files).

- [ ] **Step 1:** Add the `kubo` service: `image: ipfs/kubo:v0.43.1`, `container_name: incois_kubo`, ports `127.0.0.1:5001:5001`, `127.0.0.1:8080:8080`, `4001:4001`, volumes `ipfs_data:/data/ipfs` and `./infra/kubo/001-profile.sh:/container-init.d/001-profile.sh:ro`, healthcheck `ipfs id`. `001-profile.sh` runs `ipfs config profile apply unixfs-v1-2025`. Run `docker compose config -q` (or a YAML parse if Docker is absent) → exit 0.
- [ ] **Step 2:** Implement `publish.mjs`:
  1. `init({ nodes: [api] })` from `@ipfs-meshkit/meshkit`; read `kubo_version` from the node (`kubo-rpc-client` `version()`).
  2. Per file: `cid = await meshkit.upload(bytes)`, `assertCidV1(cid)` (on failure print "Kubo is not using unixfs-v1-2025 — see infra/kubo/001-profile.sh" and exit 1), `await meshkit.pin(cid)`, `retrieve(cid)` and assert byte-equality.
  3. Root: `kubo-rpc-client` `addAll(files as {path, content}, { wrapWithDirectory: true, pin: true })` with no CID options (the node profile decides); the wrapping entry's CID is `root`.
  4. Cross-check per file: the directory entry CID === the meshkit CID, and for files ≤ 1 MiB === `rawCidV1(bytes)`. Print a table of mismatches; any mismatch exits 1 (this is the upstream evidence for Task 7).
  5. Write the manifest (`git_commit` from `git rev-parse HEAD`, `'unknown'` on failure; `profile: 'unixfs-v1-2025'`; generator `scripts/ipfs/publish.mjs (@ipfs-meshkit/meshkit <version from its package.json>)`), 2-space JSON; print count, total bytes, root, elapsed.
- [ ] **Step 3:** `node publish.mjs --dry-run` → lists 85 files (76 `tiles/**/*.bin` + 9 `api/**/*.json`).
- [ ] **Step 4:** With Kubo running (`docker compose up -d kubo`, or the npm `kubo` binary with `ipfs init --profile unixfs-v1-2025` if Docker is unavailable): `npm run publish:ipfs` → manifest with 85 entries, every CID starting `bafy`/`bafk`, 0 cross-check mismatches; `curl -s http://127.0.0.1:8080/ipfs/<root>/tiles/temperature/2019-01-29/0.0.bin | cmp - ../../frontend/public/tiles/temperature/2019-01-29/0.0.bin` → no output. If neither Kubo route is reachable from the VM, stop and hand this step to the user on Windows with the exact commands.
- [ ] **Step 5:** `scripts/ipfs/README.md`: prerequisites, the two Kubo options, the profile and why (CIDv1 matches meshkit0's S3 path and the mentor's Pinata `cidVersion: 1`), publish command, replicating with one `ipfs pin add <root>` or a pinning service, what the manifest is and that Git history is its trusted channel. Commit `feat(ipfs): publish tiles via Meshkit0 + Kubo service` (include the generated manifest).

### Task 3: Frontend `ipfsSource.ts`

**Files:**
- Create: `frontend/src/api/ipfsSource.ts`, `frontend/src/api/ipfsSource.test.ts`
- Modify: `frontend/package.json` (+ `@helia/verified-fetch@^8.1.2`), `frontend/package-lock.json`, `frontend/src/api/config.ts` (export `IPFS_GATEWAYS: string[]`, `IPFS_TIMEOUT_MS = 8000`), `frontend/.env.example` (`VITE_IPFS_GATEWAYS=`)

**Interfaces:**
- Produces:
  - `type DataSourceMode = 'auto' | 'ipfs' | 'server'`
  - `type TileSource = 'api' | 'ipfs' | 'static'`
  - `interface IpfsManifest { schema: string; generated_at: string; generator: string; kubo_version: string; profile: string; git_commit: string; root: string; files: Record<string, { cid: string; size: number; sha256: string }> }`
  - `parseIpfsManifest(json: unknown): IpfsManifest | null`
  - `tileManifestPath(variable: string, date: string, depth: number): string` → `tiles/${variable}/${dateKey(date)}/${depthKey(depth)}.bin`
  - `loadIpfsManifest(fetchImpl?: typeof fetch): Promise<IpfsManifest | null>` — fetches `/ipfs-manifest.json` once, memoised.
  - `type CidFetcher = (cid: string, signal: AbortSignal) => Promise<ArrayBuffer>`; default implementation lazy-imports `createVerifiedFetch({ gateways: IPFS_GATEWAYS })` and requests `ipfs://<cid>`.
  - `getLoadedManifest(): IpfsManifest | null` (the memoised manifest, for the badge's details)
  - `fetchFromIpfs(path: string, opts?: { fetcher?: CidFetcher; manifest?: IpfsManifest | null }): Promise<{ buffer: ArrayBuffer; cid: string } | null>` — `null` if no manifest or path absent; rejects on fetch error or `IPFS_TIMEOUT_MS` timeout.
  - `getDataSourceMode(): DataSourceMode`, `setDataSourceMode(mode: DataSourceMode): void`
  - `reportTileSource(info: { source: TileSource; cid?: string }): void`, `onTileSource(listener): () => void`, `onModeChange(listener): () => void`
  - `__resetIpfsSourceForTests(): void` (clears memoised manifest and listeners)

- [ ] **Step 1: Failing tests** in `ipfsSource.test.ts`:
  - `parses a valid manifest`; `returns null for html / invalid manifest` (wrong schema, missing `files`, missing `root`, and a fetchImpl answering `content-type: text/html` → `loadIpfsManifest` resolves `null`).
  - `tileManifestPath('temperature','2019-01-29T00:00:00Z',0)` === `'tiles/temperature/2019-01-29/0.0.bin'`.
  - `fetchFromIpfs` returns `{buffer, cid:'bafyT'}` via a fake fetcher called with `'bafyT'`; returns `null` for an absent path; rejects with a timeout when the fake fetcher never resolves (use `vi.useFakeTimers()` and advance 8000 ms).
  - `mode survives throwing storage`: stub `localStorage.getItem/setItem` to throw → `getDataSourceMode()` === `'auto'`, `setDataSourceMode('ipfs')` does not throw and `getDataSourceMode()` then returns `'ipfs'` (in-memory).
  - `onTileSource` listener receives a reported `{source:'ipfs', cid:'bafyT'}`; the unsubscribe stops delivery.
- [ ] **Step 2:** In the VM copy of `frontend/`: `npm ci && npm i @helia/verified-fetch@^8.1.2 && npx vitest run src/api/ipfsSource.test.ts` → FAIL.
- [ ] **Step 3:** Implement `ipfsSource.ts` and the `config.ts` constants.
- [ ] **Step 4:** `npx vitest run` → all tests pass (existing ones included).
- [ ] **Step 5:** Copy back; commit `feat(frontend): IPFS source with Helia verified-fetch`.

### Task 4: Wire IPFS into `loadTile()`

**Files:**
- Modify: `frontend/src/api/client.ts` (`OceanTileData`, `loadTile`, new `clearTileCache`)
- Create: `frontend/src/api/client.ipfs.test.ts`

**Interfaces:**
- Consumes: Task 3 exports.
- Produces: `OceanTileData` gains optional `source?: TileSource; cid?: string`; `export function clearTileCache(): void`; `client.ts` subscribes to `onModeChange` and calls `clearTileCache()`.

- [ ] **Step 1: Failing tests** with `vi.mock('./ipfsSource', …)` and a stubbed global `fetch`, using a real 32-byte-header temperature tile buffer built in the test (`INCO`, varCode 1, 2×1 grid):
  - `server: never calls fetchFromIpfs` (live 200 → `source:'api'`).
  - `auto: live down → ipfs` (live fetch rejects; `liveApiAvailable` false path) → `source:'ipfs'`, `cid:'bafyT'`, `reportTileSource` called with the same.
  - `auto: tile missing from manifest falls to static` (`fetchFromIpfs` → `null`) → `source:'static'`.
  - `ipfs failure falls back to static` (`fetchFromIpfs` rejects) → `source:'static'`.
  - `corrupt ipfs bytes fall back to static` (IPFS returns a salinity-coded tile for a temperature request) → `source:'static'`.
  - `auto: live no-data stays NoDataError` (live 404 `application/json`) → rejects `NoDataError`, `fetchFromIpfs` not called.
  - `ipfs mode skips the live API` → global fetch never called with an `/api/tiles/` URL.
  - `mode change clears cache`: fetch once (cached), fire the mocked mode-change listener, fetch again → loader runs twice.
- [ ] **Step 2:** `npx vitest run src/api/client.ipfs.test.ts` → FAIL.
- [ ] **Step 3:** Restructure `loadTile` into ordered attempts per mode: `server` = [live, static]; `auto` = [live, ipfs, static]; `ipfs` = [ipfs, static]. Keep the existing live retry, `NoDataError` and 5xx semantics (in `auto`, a live 5xx after retries proceeds to IPFS instead of throwing; in `server` it throws as today). Tag the returned tile with `source`/`cid` and call `reportTileSource`.
- [ ] **Step 4:** `npx vitest run` → all pass; `npx tsc --noEmit` → no errors.
- [ ] **Step 5:** Copy back; commit `feat(frontend): live → IPFS → static tile source chain`.

### Task 5: Data-source badge

**Files:**
- Create: `frontend/src/components/DataSourceBadge.tsx`
- Modify: `frontend/src/App.tsx` (render `<DataSourceBadge />` next to `<DataStatusBar />` when `mode === 'operational'`)

**Interfaces:**
- Consumes: `onTileSource`, `getDataSourceMode`, `setDataSourceMode` (Task 3).

- [ ] **Step 1:** Implement: a small fixed pill (bottom-left, `z-30`, same glass style as `DataStatusBar`) showing `IPFS ✓ verified · <first 6>…<last 4 of CID>` (only for `source:'ipfs'`), `Live API`, or `Static (unverified)`. Clicking opens a small panel with the tile CID (link to `https://trustless-gateway.link/ipfs/<cid>`), manifest `root`, `git_commit` and `generated_at` from `getLoadedManifest()`, and one sentence explaining that the browser hash-checked the bytes against the CID; and a 3-option segmented control `Auto / IPFS / Server` bound to `setDataSourceMode`. Hidden until the first tile is reported.
- [ ] **Step 2:** `npx tsc --noEmit && npm run build` in the VM copy → succeeds; record the new chunk size of the lazily loaded verified-fetch bundle.
- [ ] **Step 3:** `npx vite preview` with the published manifest and Kubo running; set mode `IPFS`; screenshot shows the globe field and the badge reading `IPFS ✓ verified`; the network panel shows the gateway request for the CID. Then rename the manifest away → app loads as on `main`, no badge errors.
- [ ] **Step 4:** Commit `feat(ui): data-source badge with IPFS verification status`.

### Task 6: Benchmark + docs

**Files:**
- Create: `scripts/ipfs/lib/stats.mjs`, `scripts/ipfs/test/stats.test.mjs`, `scripts/ipfs/benchmark.mjs`, `docs/IPFS_BENCHMARK.md` (generated)
- Modify: `README.md` (new section "Decentralised data (IPFS + Meshkit)")

**Interfaces:**
- Produces: `summarize(samples: number[]): { n: number; median: number; p95: number; min: number; max: number }` (nearest-rank p95; `n:0` and `NaN`s for empty input).
- `benchmark.mjs` flags: `--n 12` (distinct tiles), `--runs 30` (fetches per path, cycling the tiles; the first fetch of each tile is "cold", the rest "warm"), `--static <url>` (default `http://localhost:4173`, i.e. vite preview), `--gateway <url>` (default `KUBO_GATEWAY`), `--public-gateway <url>` (default `https://trustless-gateway.link`), `--out ../../docs/IPFS_BENCHMARK.md`.

- [ ] **Step 1: Failing tests:** `summarize([5,1,3])` → `{n:3, median:3, p95:5, min:1, max:5}`; `summarize([1,2,3,4])` median `2.5`; `summarize([])` → `n:0`.
- [ ] **Step 2:** `npm test` → FAIL; implement `stats.mjs`; `npm test` → PASS.
- [ ] **Step 3:** Implement `benchmark.mjs`: pick N tile paths evenly from the manifest; four paths — (a) static HTTP, (b) local Kubo gateway `/ipfs/<cid>` (plain HTTP, unverified), (c) verified-fetch → local Kubo gateway, (d) verified-fetch → public trustless gateway; time TTFB and total, read bytes, compare SHA-256 to the manifest, catch failures; also time a local SHA-256 of each tile to show the verification cost. Write markdown: ISO date, gateway hostnames, Kubo version, N, runs, a table per path split cold/warm (p50/p95 total ms, p50 TTFB, success %, integrity %), and a method note that states plainly which path was fastest (expected: static) and that IPFS's value here is verifiability and replication, not speed.
- [ ] **Step 4:** Run it with Kubo + `vite preview` up → `docs/IPFS_BENCHMARK.md` contains real numbers for all three paths (a public-gateway failure is recorded as such, not hidden).
- [ ] **Step 5:** README section: what is published (tiles + JSON, not the 9.2 GB NetCDF), how to run publish/bench, the fallback chain, the pinning caveat ("not decentralised or permanent while one node pins it"), and a note to confirm INCOIS redistribution terms before pinning to public networks. Commit `feat(ipfs): retrieval benchmark and docs`.

### Task 7: meshkit0 upstream contribution (prepared, not opened)

**Files:**
- Create: `scripts/ipfs/repro-cid-version.mjs`, `docs/upstream/meshkit0-issue-cid-version.md`, `docs/upstream/meshkit0-browser-exports.patch`

**Interfaces:**
- Consumes: `rawCidV1` (Task 1), meshkit `init`/`upload`.

- [ ] **Step 1:** `repro-cid-version.mjs --api <url>`: uploads 3 fixed byte strings (12 B, 600 KiB, 2 MiB) through meshkit's Kubo path, prints meshkit CID, `rawCidV1(bytes)` (meshkit's S3-path algorithm) and the node's `Import.CidVersion` / `Import.UnixFSRawLeaves`, and whether they match. Run it against a node with default config and against the profiled node; record both outputs. If a default-config node is not available here, record only the profiled run and mark the default run "to reproduce".
- [ ] **Step 2:** `meshkit0-issue-cid-version.md`: title, environment (meshkit 1.2.1, Kubo 0.43.1), the code references (`create-client.ts` calls `ipfs.add` with no `cidVersion`; `create-filone-client.ts` uses CIDv1 raw), exact repro command and recorded output, expected vs actual, and a proposed `cidVersion` / `rawLeaves` option defaulting to the S3 path's format.
- [ ] **Step 3:** In a scratch clone of `IPFS-Meshkit/meshkit0` (outside the repo), add `encrypt`, `decrypt`, `isEncryptedPayload` to `packages/meshkit/src/index.browser.ts` plus a unit test that imports them from the browser entry; run its test suite → pass; save `git format-patch` output as `docs/upstream/meshkit0-browser-exports.patch` with a conventional-commit message. Do not push or open anything — the team opens the issue and PR from their own GitHub accounts.
- [ ] **Step 4:** Commit `docs(upstream): meshkit0 CID-version issue and browser-exports patch`.

### Task 8: Final verification

- [ ] **Step 1:** Fresh VM copy: `scripts/ipfs` `npm test`; `frontend` `npx vitest run`, `npx tsc --noEmit`, `npm run build` → all green.
- [ ] **Step 2:** Walk the spec's success criteria (plus: every manifest CID is CIDv1; 0 cross-check mismatches) one by one and record evidence (command output / screenshot) in the PR description draft.
- [ ] **Step 3:** `git log main..feat/ipfs-meshkit --oneline` shows the task commits; hand off with the Windows commands the team runs (`npm install` in `frontend` and `scripts/ipfs`, `docker compose up -d kubo`, `npm run publish:ipfs`), the upstream issue/PR to open, and the INCOIS data-terms check.
