/**
 * Psionic Decision Helpers
 * 
 * Helper functions for AI to choose which psionic powers to use
 * Prevents spam by selecting ONE power per decision
 */

/**
 * Choose the best offensive psionic power for a given situation
 * @param {Object} params - Parameters object
 * @param {Object} params.caster - The caster fighter
 * @param {Array} params.psionicPowers - Available psionic powers
 * @param {Object} params.target - Target enemy
 * @param {number} params.distanceFeet - Distance to target in feet
 * @param {number} params.isp - Current ISP available
 * @param {string} params.alignment - Fighter alignment (e.g., "principled", "diabolic")
 * @returns {Object|null} Best psionic power to use, or null if none available
 */
export function chooseBestOffensivePsionic({
  caster,
  psionicPowers,
  target,
  distanceFeet,
  isp,
  alignment,
}) {
  if (!psionicPowers || psionicPowers.length === 0) return null;

  const name = (p) => (p.name || "").toLowerCase();

  // Very rough tags: refine as you like
  const isParalysis = (p) => name(p).includes("paralysis");
  const isSleep = (p) => name(p).includes("sleep");
  const isTelekinesisAttack = (p) =>
    name(p).includes("telekinesis") && !name(p).includes("levitation");

  // Filter powers we can pay for
  const affordable = psionicPowers.filter((p) => {
    const cost = p.cost || p.ispCost || p.isp || p.ISP || 0;
    return cost <= isp;
  });
  if (!affordable.length) return null;

  // Good / selfish prefer control; evil may prefer direct harm (if you add those later)
  const goodAlignments = ["principled", "scrupulous"];
  const isGood = goodAlignments.includes((alignment || "").toLowerCase());

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
    const cost = p.cost || p.ispCost || p.isp || p.ISP || 0;
    if (!best) return p;
    const bestCost = best.cost || best.ispCost || best.isp || best.ISP || 0;
    return cost > bestCost ? p : best;
  }, null);
}

/**
 * Choose the best healing psionic power
 * @param {Object} params - Parameters object
 * @param {Object} params.caster - The caster fighter
 * @param {Array} params.psionicPowers - Available psionic powers
 * @param {Object} params.target - Target ally to heal
 * @param {number} params.distanceFeet - Distance to target in feet
 * @param {number} params.isp - Current ISP available
 * @returns {Object|null} Best healing psionic power, or null if none available
 */
export function chooseBestHealingPsionic({
  caster,
  psionicPowers,
  target,
  distanceFeet,
  isp,
}) {
  if (!psionicPowers || psionicPowers.length === 0) return null;

  const name = (p) => (p.name || "").toLowerCase();
  const isHealing = (p) => 
    name(p).includes("heal") || 
    name(p).includes("cure") ||
    name(p).includes("restore") ||
    name(p).includes("regenerate");

  // Filter powers we can pay for and are healing powers
  const affordable = psionicPowers.filter((p) => {
    const cost = p.cost || p.ispCost || p.isp || p.ISP || 0;
    return cost <= isp && isHealing(p);
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
    const cost = p.cost || p.ispCost || p.isp || p.ISP || 0;
    if (!best) return p;
    const bestCost = best.cost || best.ispCost || best.isp || best.ISP || 0;
    return cost > bestCost ? p : best;
  }, null);
}

