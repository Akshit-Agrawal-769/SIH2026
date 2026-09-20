import cyclonesRaw from './cyclones.json';

export interface CycloneRecord {
  name: string;
  location: string;
  lat: number;
  lon: number;
  date: string;
  intensity: string;
}

export const CYCLONES_DATA: CycloneRecord[] = cyclonesRaw as CycloneRecord[];
