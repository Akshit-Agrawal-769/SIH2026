import cyclonesRaw from './cyclones.json';

export interface CycloneRecord {
  name: string;
  location: string;
  lat: number;
  lon: number;
  date: string;
  intensity: string;
  /** IBTrACS storm id and provenance (markers are re-derived from IBTrACS by scripts/build_ext_products.py). */
  landfall_time?: string;
  sid?: string;
  ibtracs_name?: string;
  max_wind_kt?: number | null;
  source?: string;
}

export const CYCLONES_DATA: CycloneRecord[] = cyclonesRaw as CycloneRecord[];
