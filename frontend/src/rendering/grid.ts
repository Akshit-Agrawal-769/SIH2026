/**
 * Served grid geometry (cell-centre registration, row 0 = south). Defaults match the
 * catalog written by scripts/build_authentic_dataset.py; configureGrid() applies the
 * catalog values at runtime so the two can never silently diverge.
 */
export interface GridSpec {
  width: number;
  height: number;
  lon0: number;
  lat0: number;
  dlon: number;
  dlat: number;
  bbox: [number, number, number, number];
}

export const GRID: GridSpec = {
  width: 520,
  height: 280,
  lon0: 35.0625,
  lat0: -9.9375,
  dlon: 0.125,
  dlat: 0.125,
  bbox: [35.0, -10.0, 100.0, 25.0]
};

export function configureGrid(spec: GridSpec): void {
  Object.assign(GRID, spec);
}

/** Fractional (row, col) of a lon/lat, or null outside the grid bbox. */
export function gridIndex(lon: number, lat: number): { row: number; col: number } | null {
  const [w, s, e, n] = GRID.bbox;
  if (lon < w || lon > e || lat < s || lat > n) return null;
  const row = Math.min(Math.max((lat - GRID.lat0) / GRID.dlat, 0), GRID.height - 1);
  const col = Math.min(Math.max((lon - GRID.lon0) / GRID.dlon, 0), GRID.width - 1);
  return { row, col };
}
