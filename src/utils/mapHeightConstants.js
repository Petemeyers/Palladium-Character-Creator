export const MAP_MIN_HEIGHT = -10;
export const MAP_BASE_HEIGHT = 0;
export const MAP_MAX_HEIGHT = 20;

export function clampMapHeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAP_BASE_HEIGHT;
  return Math.max(MAP_MIN_HEIGHT, Math.min(MAP_MAX_HEIGHT, numeric));
}
