/**
 * Volumetric Studio — data layer.
 *
 * Nothing here hardcodes a filename, variable, or grid size. Everything is
 * discovered at runtime from the backend's own endpoints:
 *   GET /api/v1/model/datasets                 -> which NetCDF files exist
 *   GET /api/v1/model/metadata?filename=...    -> variables + grid dimensions
 *   GET /api/v1/model/volume3d?filename&variable -> raw little-endian Float32
 *
 * The metadata/datasets parsers are deliberately tolerant of a few common
 * response shapes, and throw a descriptive error (listing the keys they DID
 * receive) when the shape is unrecognised, so a schema drift fails loudly
 * instead of silently rendering garbage.
 */

export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") ?? "";

export interface GridDims {
  nx: number; // longitude count (fastest-varying in the buffer)
  ny: number; // latitude count
  nz: number; // depth-level count (slowest-varying)
}

export interface VolumeMeta {
  filename: string;
  variables: string[];
  dims: GridDims;
  lon?: [number, number];
  lat?: [number, number];
  depthLevels?: number[]; // metres, positive down, in buffer order
  units?: Record<string, string>;
  raw: unknown; // untouched payload, for debugging
}

export interface VolumePayload {
  data: Float32Array; // normalised to [0,1]; NaN/fill -> -1 (empty)
  dims: GridDims;
  valueMin: number; // physical range of finite values
  valueMax: number;
  validFraction: number; // share of voxels that are ocean (finite)
}

export class VolumeApiError extends Error {
  constructor(message: string, public status?: number, public detail?: unknown) {
    super(message);
    this.name = "VolumeApiError";
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function authHeaders(token: string | null | undefined, accept: string): HeadersInit {
  const h: Record<string, string> = { Accept: accept };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      // FastAPI puts messages in `detail`; Express gateways usually `message`/`error`.
      return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j.message ?? j.error ?? j);
    } catch {
      return text.slice(0, 400);
    }
  } catch {
    return "(no response body)";
  }
}

async function request(url: string, token: string | null | undefined, accept: string, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders(token, accept), signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    console.error("[VolumetricStudio] network failure", url, err);
    throw new VolumeApiError(`Could not reach the data service at ${url}. Is the backend running?`);
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    const hint =
      res.status === 401 ? "Session token missing or expired. Sign in again." :
      res.status === 403 ? "This account is not allowed to read model volumes." :
      res.status === 404 ? "The file or variable does not exist on the server." :
      res.status >= 500 ? "The data service failed while reading the NetCDF file." :
      "The request was rejected.";
    console.error(`[VolumetricStudio] HTTP ${res.status} for ${url}\n  server said: ${body}`);
    throw new VolumeApiError(`${hint} (HTTP ${res.status}: ${body})`, res.status, body);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

export async function fetchDatasets(token: string | null | undefined, signal?: AbortSignal): Promise<string[]> {
  const res = await request(`${API_BASE}/api/v1/model/datasets`, token, "application/json", signal);
  const j: any = await res.json();
  const list: any[] = Array.isArray(j) ? j : j.datasets ?? j.files ?? j.items ?? null;
  if (!Array.isArray(list)) {
    throw new VolumeApiError(`Unrecognised /model/datasets response. Keys: ${Object.keys(j ?? {}).join(", ")}`);
  }
  const names = list
    .map((d) => (typeof d === "string" ? d : d.filename ?? d.name ?? d.file ?? null))
    .filter((n): n is string => typeof n === "string");
  if (names.length === 0) throw new VolumeApiError("The server reports no model NetCDF files in datasets/model/.");
  return names;
}

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

const LON_KEYS = ["lon", "longitude", "nx", "x", "xi_rho", "nlon"];
const LAT_KEYS = ["lat", "latitude", "ny", "y", "eta_rho", "nlat"];
const DEP_KEYS = ["depth", "nz", "z", "lev", "level", "s_rho", "ndepth", "depth_levels"];

function pickNum(obj: any, keys: string[]): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "number") return v.length;
  }
  return undefined;
}

function pickRange(obj: any, base: string[]): [number, number] | undefined {
  if (!obj) return undefined;
  for (const k of base) {
    const v = obj[k];
    if (Array.isArray(v) && v.length >= 2 && typeof v[0] === "number") return [v[0], v[v.length - 1]];
    if (v && typeof v.min === "number" && typeof v.max === "number") return [v.min, v.max];
  }
  for (const k of base) {
    const mn = obj[`${k}_min`] ?? obj[`min_${k}`];
    const mx = obj[`${k}_max`] ?? obj[`max_${k}`];
    if (typeof mn === "number" && typeof mx === "number") return [mn, mx];
  }
  return undefined;
}

export function normalizeMetadata(filename: string, j: any): VolumeMeta {
  const containers = [j?.dims, j?.dimensions, j?.grid, j?.shape_dict, j?.sizes, j?.coords, j];

  let nx: number | undefined, ny: number | undefined, nz: number | undefined;
  for (const c of containers) {
    nx ??= pickNum(c, LON_KEYS);
    ny ??= pickNum(c, LAT_KEYS);
    nz ??= pickNum(c, DEP_KEYS);
  }
  // `shape: [nz, ny, nx]` (xarray/numpy C-order) as a last resort
  const shape = j?.shape ?? j?.volume_shape;
  if ((!nx || !ny || !nz) && Array.isArray(shape) && shape.length === 3) {
    [nz, ny, nx] = shape;
  }
  if (!nx || !ny || !nz) {
    throw new VolumeApiError(
      `Could not find grid dimensions in /model/metadata for ${filename}. ` +
        `Top-level keys received: ${Object.keys(j ?? {}).join(", ")}. ` +
        `Add a "dims": {"lon":NX,"lat":NY,"depth":NZ} block to the response or extend normalizeMetadata().`
    );
  }

  let variables: string[] = [];
  const v = j?.variables ?? j?.data_vars ?? j?.vars;
  if (Array.isArray(v)) variables = v.map((x: any) => (typeof x === "string" ? x : x.name)).filter(Boolean);
  else if (v && typeof v === "object") variables = Object.keys(v);

  const units: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries<any>(v)) if (val?.units) units[k] = val.units;
  } else if (Array.isArray(v)) {
    for (const x of v) if (x?.name && x?.units) units[x.name] = x.units;
  }

  const bounds = j?.bounds ?? j?.spatial_bounds ?? j?.extent ?? j;
  const depthArr = j?.depth_levels ?? j?.depths ?? j?.coords?.depth ?? j?.depth;
  const depthLevels = Array.isArray(depthArr) && typeof depthArr[0] === "number" ? depthArr.map(Math.abs) : undefined;

  return {
    filename,
    variables,
    dims: { nx, ny, nz },
    lon: pickRange(bounds, ["lon", "longitude", "lon_range"]),
    lat: pickRange(bounds, ["lat", "latitude", "lat_range"]),
    depthLevels: depthLevels && depthLevels.length === nz ? depthLevels : undefined,
    units,
    raw: j,
  };
}

export async function fetchMetadata(filename: string, token: string | null | undefined, signal?: AbortSignal) {
  const url = `${API_BASE}/api/v1/model/metadata?filename=${encodeURIComponent(filename)}`;
  const res = await request(url, token, "application/json", signal);
  const j = await res.json();
  const meta = normalizeMetadata(filename, j);
  console.info(`[VolumetricStudio] ${filename}: grid ${meta.dims.nx}×${meta.dims.ny}×${meta.dims.nz}`, meta);
  return meta;
}

/* ------------------------------------------------------------------ */
/* Volume                                                              */
/* ------------------------------------------------------------------ */

export async function fetchVolume(
  meta: VolumeMeta,
  variable: string,
  token: string | null | undefined,
  signal?: AbortSignal
): Promise<VolumePayload> {
  const url =
    `${API_BASE}/api/v1/model/volume3d?filename=${encodeURIComponent(meta.filename)}` +
    `&variable=${encodeURIComponent(variable)}`;

  const res = await request(url, token, "application/octet-stream", signal);

  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("json") || ctype.includes("html")) {
    const body = await res.text();
    console.error("[VolumetricStudio] expected binary Float32, got", ctype, body.slice(0, 300));
    throw new VolumeApiError(`volume3d returned ${ctype} instead of a binary buffer. A proxy or auth redirect may be intercepting it.`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength % 4 !== 0) {
    console.error(`[VolumetricStudio] byteLength ${buf.byteLength} is not a multiple of 4`);
    throw new VolumeApiError(`Corrupt volume: ${buf.byteLength} bytes is not a whole number of Float32 values.`);
  }

  const raw = new Float32Array(buf);
  const { nx, ny, nz } = meta.dims;
  const expected = nx * ny * nz;

  if (raw.length !== expected) {
    const ratio = raw.length / expected;
    console.error(
      `[VolumetricStudio] DIMENSION MISMATCH for ${meta.filename}/${variable}\n` +
        `  metadata grid : ${nx} × ${ny} × ${nz} = ${expected} voxels\n` +
        `  received      : ${raw.length} Float32 values (${buf.byteLength} bytes)\n` +
        `  ratio         : ${ratio.toFixed(4)}` +
        (ratio < 1 ? "  -> backend is probably subsampling; expose the stride or the output shape." : "") +
        (Number.isInteger(ratio) && ratio > 1 ? `  -> ${ratio} time steps concatenated? Request a single time index.` : "")
    );
    throw new VolumeApiError(
      `Volume size mismatch: expected ${expected.toLocaleString()} values (${nx}×${ny}×${nz}), received ${raw.length.toLocaleString()}.`
    );
  }

  // Normalise to [0,1], with non-finite / fill values mapped to -1 (treated as land/empty by the shader).
  // Fill values from NetCDF (_FillValue, often ±1e20 or 9.96e36) that slip through as finite are clipped too.
  let lo = Infinity, hi = -Infinity, valid = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (Number.isFinite(v) && Math.abs(v) < 1e19) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      valid++;
    }
  }
  if (valid === 0) {
    console.error("[VolumetricStudio] every voxel is NaN/fill", meta.filename, variable);
    throw new VolumeApiError(`All ${raw.length} voxels of "${variable}" are empty (NaN or fill value).`);
  }

  const span = hi - lo || 1;
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    out[i] = Number.isFinite(v) && Math.abs(v) < 1e19 ? (v - lo) / span : -1;
  }

  return { data: out, dims: meta.dims, valueMin: lo, valueMax: hi, validFraction: valid / raw.length };
}
