export const SIMULATION_SPEEDS = Object.freeze({ NORMAL: "normal", FAST: "fast", TURBO: "turbo", INSTANT: "instant" });
export const SIMULATION_SPEED_MULTIPLIERS = Object.freeze({ normal: 1, fast: 0.35, turbo: 0.05, instant: 0 });

export function normalizeSimulationSpeed(speed) {
  return Object.values(SIMULATION_SPEEDS).includes(speed) ? speed : SIMULATION_SPEEDS.NORMAL;
}

export function getSimulationDelay(baseMs, speed = SIMULATION_SPEEDS.NORMAL, { minMs = 0 } = {}) {
  const base = Math.max(0, Number(baseMs) || 0);
  const scaled = Math.round(base * SIMULATION_SPEED_MULTIPLIERS[normalizeSimulationSpeed(speed)]);
  return Math.max(Math.max(0, Number(minMs) || 0), scaled);
}
