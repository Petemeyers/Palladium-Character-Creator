const finiteNonNegative = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const normalizeSizeLabel = (combatant = {}) => String(
  combatant?.sizeCategory ||
  combatant?.size ||
  combatant?.category ||
  combatant?.combatantCategory ||
  ""
).trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * Return the number of grid rings occupied beyond the combatant's center hex.
 *
 * Medium, Small, and Tiny combatants use their center hex only. Large creatures
 * occupy one additional ring, Huge creatures two, and the heaviest categories
 * three. Explicit footprint metadata always wins.
 */
export function getCombatantFootprintRadiusHexes(combatant = {}) {
  const explicitRadius = finiteNonNegative(
    combatant?.footprint?.radiusHex ??
    combatant?.gridFootprint?.radiusHex ??
    combatant?.occupiedRadiusHex
  );
  if (explicitRadius !== null) return Math.floor(explicitRadius);

  const label = normalizeSizeLabel(combatant);
  if (
    label.includes("large_heavy") ||
    label.includes("gargantuan") ||
    label.includes("colossal") ||
    label === "heavy"
  ) {
    return 3;
  }
  if (label.includes("huge")) return 2;
  if (label.includes("large")) return 1;

  const sizeRank = finiteNonNegative(
    combatant?.sizeRank ??
    combatant?.attributes?.sizeRank ??
    combatant?.stats?.sizeRank
  );
  if (sizeRank !== null) {
    if (sizeRank >= 5) return 3;
    if (sizeRank >= 4) return 2;
    if (sizeRank >= 3) return 1;
  }

  return 0;
}

/**
 * Convert center-to-center map distance into the distance a melee weapon must
 * cover after accounting for occupied footprint rings.
 *
 * The normal 5-foot adjacent-hex rule remains unchanged for Medium creatures.
 * A Large creature contributes one 5-foot footprint ring, so a Large attacker
 * 10 feet center-to-center from a Medium target has an effective melee distance
 * of 5 feet.
 */
export function resolveFootprintAdjustedMeleeDistance({
  attacker = {},
  defender = {},
  centerDistanceFeet = Infinity,
  cellSizeFeet = 5,
} = {}) {
  const centerDistance = Number(centerDistanceFeet);
  const safeCenterDistance = Number.isFinite(centerDistance)
    ? Math.max(0, centerDistance)
    : Infinity;
  const safeCellSize = Math.max(1, Number(cellSizeFeet) || 5);
  const attackerRadiusHex = getCombatantFootprintRadiusHexes(attacker);
  const defenderRadiusHex = getCombatantFootprintRadiusHexes(defender);
  const footprintAllowanceFeet =
    (attackerRadiusHex + defenderRadiusHex) * safeCellSize;
  const adjustedDistanceFeet = Number.isFinite(safeCenterDistance)
    ? Math.max(0, safeCenterDistance - footprintAllowanceFeet)
    : Infinity;

  return {
    centerDistanceFeet: safeCenterDistance,
    adjustedDistanceFeet,
    footprintAllowanceFeet,
    attackerRadiusHex,
    defenderRadiusHex,
    adjusted: footprintAllowanceFeet > 0,
  };
}

export function isWithinFootprintAdjustedMeleeReach({
  attacker = {},
  defender = {},
  centerDistanceFeet = Infinity,
  reachFeet = 5.5,
  cellSizeFeet = 5,
} = {}) {
  const result = resolveFootprintAdjustedMeleeDistance({
    attacker,
    defender,
    centerDistanceFeet,
    cellSizeFeet,
  });
  const safeReach = Math.max(0, Number(reachFeet) || 0);
  return {
    ...result,
    reachFeet: safeReach,
    canReach: result.adjustedDistanceFeet <= safeReach,
  };
}

export default resolveFootprintAdjustedMeleeDistance;
