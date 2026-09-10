export const DATE_RANGE_START = '2024-06-01';
export const DATE_RANGE_END = '2024-06-14';

export const TIMESTEPS: string[] = Array.from(
  { length: 14 },
  (_, i) => `2024-06-${String(i + 1).padStart(2, '0')}`
);
