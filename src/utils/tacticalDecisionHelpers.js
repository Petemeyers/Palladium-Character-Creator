import { normalizeAlignmentBehavior } from "./behavior/normalizeAlignmentBehavior.js";

/**
 * Tactical Decision Helpers
 * 
 * Helper functions for AI to choose which tactical powers to use
 * Prevents spam by selecting ONE power per decision
 */

/**
 * Choose the best offensive tactical power for a given situation
 * @param {Object} params - Parameters object
 * @param {Object} params.caster - The caster fighter
 * @param {Array} params.tacticalOptions - Available tactical powers
 * @param {Object} params.target - Target enemy
 * @param {number} params.distanceFeet - Distance to target in feet
 * @param {number} params.focus - Current focus available
 * @param {string} params.alignment - Canonical nine-grid fighter alignment
 * @returns {Object|null} Best tactical power to use, or null if none available
 */
export function chooseBestOffensiveTactical({
  caster,
  tacticalOptions,
  target,
  distanceFeet,
  focus,
  alignment,
}) {
  if (!tacticalOptions || tacticalOptions.length === 0) return null;

  const name = (p) => (p.name || "").toLowerCase();

  // Very rough tags: refine as you like
  const isParalysis = (p) => name(p).includes("paralysis");
  const isSleep = (p) => name(p).includes("sleep");
  const isTelekinesisAttack = (p) =>
    name(p).includes("telekinesis") && !name(p).includes("levitation");

  // Filter powers we can pay for
  const affordable = tacticalOptions.filter((p) => {
    const cost = p.cost || p.focusCost || p.focus || p.focus || 0;
    return cost <= focus;
  });
  if (!affordable.length) return null;

  // Good / selfish prefer control; evil may prefer direct harm (if you add those later)
  const isGood = normalizeAlignmentBehavior(alignment)?.goodEvilAxis === "good";

  let candidates = [];

  if (isGood) {
    // Prefer disabling over raw damage
    candidates = affordable.filter((p) => isParalysis(p) || isSleep(p));
    if (!candidates.length) {
      candidates = affordable.filter(isTelekinesisAttack);
    }
  } else {
    // Non-good: TK, then paralysis/sleep
    candidates = affordable.filter(isTelekinesisAttack);
    if (!candidates.length) {
      candidates = affordable.filter((p) => isParalysis(p) || isSleep(p));
    }
  }

  if (!candidates.length) {
    // fallback: any offensive tag you've defined in your data
    candidates = affordable.filter((p) => p.tags && p.tags.includes("offensive"));
  }

  if (!candidates.length) return null;

  // Simple choice: highest cost (usually strongest) that's in range
  const inRange = candidates.filter((p) => {
    const r = p.rangeFeet || p.range || 0;
    // If range is 0 or Infinity, assume it's valid
    if (r === 0 || r === Infinity) return true;
    return distanceFeet <= r;
  });

  const pool = inRange.length ? inRange : candidates;

  return pool.reduce((best, p) => {
    const cost = p.cost || p.focusCost || p.focus || p.focus || 0;
    if (!best) return p;
    const bestCost = best.cost || best.focusCost || best.focus || best.focus || 0;
    return cost > bestCost ? p : best;
  }, null);
}

/**
 * Choose the best healing tactical power
 * @param {Object} params - Parameters object
 * @param {Object} params.caster - The caster fighter
 * @param {Array} params.tacticalOptions - Available tactical powers
 * @param {Object} params.target - Target ally to heal
 * @param {number} params.distanceFeet - Distance to target in feet
 * @param {number} params.focus - Current focus available
 * @returns {Object|null} Best healing tactical power, or null if none available
 */
export function chooseBestHealingTactical({
  caster,
  tacticalOptions,
  target,
  distanceFeet,
  focus,
}) {
  if (!tacticalOptions || tacticalOptions.length === 0) return null;

  const name = (p) => (p.name || "").toLowerCase();
  const isHealing = (p) => 
    name(p).includes("heal") || 
    name(p).includes("cure") ||
    name(p).includes("restore") ||
    name(p).includes("regenerate");

  // Filter powers we can pay for and are healing powers
  const affordable = tacticalOptions.filter((p) => {
    const cost = p.cost || p.focusCost || p.focus || p.focus || 0;
    return cost <= focus && isHealing(p);
  });
  if (!affordable.length) return null;

  // Filter by range
  const inRange = affordable.filter((p) => {
    const r = p.rangeFeet || p.range || 0;
    if (r === 0 || r === Infinity) return true;
    return distanceFeet <= r;
  });

  const pool = inRange.length ? inRange : affordable;

  // Return highest cost (usually strongest)
  return pool.reduce((best, p) => {
    const cost = p.cost || p.focusCost || p.focus || p.focus || 0;
    if (!best) return p;
    const bestCost = best.cost || best.focusCost || best.focus || best.focus || 0;
    return cost > bestCost ? p : best;
  }, null);
}

