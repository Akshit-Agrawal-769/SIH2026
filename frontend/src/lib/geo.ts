/** "12.34°N, 56.78°E" — exact coordinates; the app does not guess region names. */
export function formatLatLon(lat: number, lon: number, digits = 2): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}°${ns}, ${Math.abs(lon).toFixed(digits)}°${ew}`;
}
