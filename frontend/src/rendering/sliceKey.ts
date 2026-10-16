import type { DataSourceMode } from '../api/ipfsSource';

export interface SliceKeyParams {
  variable: string;
  date: string | null;
  depth: number;
  palette?: string;
  customRange?: unknown;
  scaleType?: string;
}

/** Identity of a slice request; includes the data-source mode so a mode switch re-fetches. */
export function sliceRequestKey(params: SliceKeyParams, mode: DataSourceMode): string {
  return JSON.stringify([params.variable, params.date, params.depth, params.palette, params.customRange,
    params.scaleType, mode]);
}
