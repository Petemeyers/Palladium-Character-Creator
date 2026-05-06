// src/engine/systems/timingEngine.cjs
// Universal flight-time engine: converts effective distance to scheduling ticks

const { effectiveDistanceFromState } = require("./rangeEngine.cjs");

/**
 * Convert effective distance to "ticks" for scheduling.
 *
 * Think of ticks as your clock player's unit (e.g. 1 tick = 100ms, etc).
 *
 * Options:
 *  - speedHexPerTick: how many effective-hex units the projectile travels per tick
 *  - minTicks: floor delay (so even adjacent shots animate)
 *  - maxTicks: ceiling delay (avoid ridiculous waits)
 *  - accel: < 1 makes long shots faster than linear (arcade), > 1 makes long shots slower (sim)
 */
function flightTicksFromDistance(dist, { speedHexPerTick = 6, minTicks = 1, maxTicks = 30, accel = 1 } = {}) {
  if (!Number.isFinite(dist) || dist <= 0) return minTicks;

  // dist' = dist^accel
  const shaped = accel === 1 ? dist : Math.pow(dist, accel);

  const raw = Math.ceil(shaped / Math.max(0.001, speedHexPerTick));
  return Math.max(minTicks, Math.min(maxTicks, raw));
}

/**
 * Compute flight ticks from state using effective distance (horiz + vert).
 * Uses ruleset.rangeWeights() if available.
 *
 * weapon/projectile can define:
 *  - speedHexPerTick
 *  - minTicks/maxTicks
 *  - accel
 */
function computeFlightTicks({
  state,
  ruleset,
  fromId,
  toId,
  weaponOrProjectile,
  kind, // "ranged"|"intercept"|"magic"|...
  fromHex,
  toHex,
}) {
  const weights = ruleset?.rangeWeights
    ? ruleset.rangeWeights({ kind, weapon: weaponOrProjectile })
    : { horizWeight: 1, vertWeight: 1 };

  const dist = effectiveDistanceFromState({
    state,
    fromId,
    toId,
    fromHex,
    toHex,
    horizWeight: weights.horizWeight,
    vertWeight: weights.vertWeight,
  });

  const speed = weaponOrProjectile?.speedHexPerTick ?? defaultSpeedForKind(kind);
  const minTicks = weaponOrProjectile?.minTicks ?? 1;
  const maxTicks = weaponOrProjectile?.maxTicks ?? 30;
  const accel = weaponOrProjectile?.accel ?? 1;

  return {
    dist: dist ?? 0,
    ticks: flightTicksFromDistance(dist ?? 0, { speedHexPerTick: speed, minTicks, maxTicks, accel }),
    breakdown: {
      speedHexPerTick: speed,
      minTicks,
      maxTicks,
      accel,
      weights,
    },
  };
}

function defaultSpeedForKind(kind) {
  const k = String(kind || "").toLowerCase();
  // Tune these to match your visual feel.
  if (k === "intercept") return 10; // fast
  if (k === "ranged") return 6; // arrow/bolt
  if (k === "melee") return 99; // immediate
  if (k === "magic") return 8; // bolts
  if (k === "psionic") return 99; // often instant
  return 6;
}

/**
 * Compute flight time in milliseconds from state using effective distance.
 * Wrapper around computeFlightTicks that converts ticks to milliseconds.
 * 
 * @param {Object} params - Same as computeFlightTicks
 * @returns {Object} { ms: number, dist: number, params: Object }
 */
function computeFlightMs(params) {
  const result = computeFlightTicks(params);
  // Convert ticks to milliseconds (assuming ~100ms per tick, or use weapon-specific msPerTick)
  const msPerTick = params.weaponOrProjectile?.msPerTick ?? 100;
  return {
    ms: result.ticks * msPerTick,
    dist: result.dist,
    params: result.breakdown,
  };
}

module.exports = {
  flightTicksFromDistance,
  computeFlightTicks,
  computeFlightMs,
};

