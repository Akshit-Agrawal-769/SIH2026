import { getJsonWithFallback } from '../api/config';

/** One named tropical-cyclone landfall from IBTrACS v04r01 (served by /api/hazards/cyclones). */
export interface CycloneRecord {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  date: string;
  intensity: string;
  season?: number;
  landfall_wind_kt?: number | null;
  max_wind_kt?: number | null;
}

interface CycloneResponse {
  available: boolean;
  reason?: string;
  source?: string;
  cyclones: CycloneRecord[];
}

/** Every named IBTrACS landfall in the source file (live API, else the static export). */
export async function fetchCyclones(): Promise<CycloneRecord[]> {
  const { data } = await getJsonWithFallback<CycloneResponse>('/hazards/cyclones', '/cyclones.json');
  if (!data.available) throw new Error(data.reason || 'IBTrACS cyclone tracks unavailable');
  return data.cyclones;
}
