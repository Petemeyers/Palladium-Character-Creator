/**
 * Size and Strength Modifiers System
 * Calculates combat modifiers based on creature size and physical strength
 * Handles size categories, grapple modifiers, reach advantages, and size-based combat bonuses
 */

/**
 * Size categories for creatures
 */
export const SIZE_CATEGORIES = {
  TINY: "TINY",
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
  HUGE: "HUGE",
  GIANT: "GIANT",
};

/**
 * Size category definitions with descriptions and modifiers
 */
export const SIZE_DEFINITIONS = {
  [SIZE_CATEGORIES.TINY]: {
    description: "Tiny (under 2ft)",
    heightRange: [0, 2],
    grappleModifier: -4,
    strikeModifier: -2,
    parryModifier: -2,
    dodgeModifier: +2,
    damageModifier: -2,
  },
  [SIZE_CATEGORIES.SMALL]: {
    description: "Small (2-4ft)",
    heightRange: [2, 4],
    grappleModifier: -2,
    strikeModifier: -1,
    parryModifier: -1,
    dodgeModifier: +1,
    damageModifier: -1,
  },
  [SIZE_CATEGORIES.MEDIUM]: {
    description: "Medium (4-7ft)",
    heightRange: [4, 7],
    grappleModifier: 0,
    strikeModifier: 0,
    parryModifier: 0,
    dodgeModifier: 0,
    damageModifier: 0,
  },
  [SIZE_CATEGORIES.LARGE]: {
    description: "Large (7-12ft)",
    heightRange: [7, 12],
    grappleModifier: +2,
    strikeModifier: +1,
    parryModifier: +1,
    dodgeModifier: -1,
    damageModifier: +1,
  },
  [SIZE_CATEGORIES.HUGE]: {
    description: "Huge (12-20ft)",
    heightRange: [12, 20],
    grappleModifier: +4,
    strikeModifier: +2,
    parryModifier: +2,
    dodgeModifier: -2,
    damageModifier: +2,
  },
  [SIZE_CATEGORIES.GIANT]: {
    description: "Giant (20ft+)",
    heightRange: [20, Infinity],
    grappleModifier: +6,
    strikeModifier: +3,
    parryModifier: +3,
    dodgeModifier: -3,
    damageModifier: +3,
  },
};

/**
 * Get size category for a creature
 * @param {Object} creature - Creature object
 * @returns {string} Size category constant
 */
export function getSizeCategory(creature) {
  if (!creature) return SIZE_CATEGORIES.MEDIUM;

  // Check if creature has explicit size category
  if (creature.sizeCategory) {
    const sizeUpper = creature.sizeCategory.toUpperCase();
    if (Object.values(SIZE_CATEGORIES).includes(sizeUpper)) {
      return sizeUpper;
    }
  }

  // Check if creature has explicit size property
  if (creature.size) {
    const sizeUpper = creature.size.toUpperCase();
    if (Object.values(SIZE_CATEGORIES).includes(sizeUpper)) {
      return sizeUpper;
    }
  }

  // Infer from height/weight if available
  const height = creature.height || creature.attributes?.height || 0;
  const weight = creature.weight || creature.attributes?.weight || 0;

  if (height >= 20 || weight >= 5000) return SIZE_CATEGORIES.GIANT;
  if (height >= 12 || weight >= 2000) return SIZE_CATEGORIES.HUGE;
  if (height >= 7 || weight >= 500) return SIZE_CATEGORIES.LARGE;
  if (height < 2 || weight < 50) return SIZE_CATEGORIES.TINY;
  if (height < 4 || weight < 100) return SIZE_CATEGORIES.SMALL;

  return SIZE_CATEGORIES.MEDIUM;
}

/**
 * Get Physical Strength (PS) value for a creature
 * @param {Object} creature - Creature object
 * @returns {number} PS value
 */
function getPhysicalStrength(creature) {
  if (!creature) return 10;

  // Check various PS property names
  return (
    creature.PS ||
    creature.ps ||
    creature.attributes?.PS ||
    creature.attributes?.ps ||
    creature.stats?.PS ||
    creature.stats?.ps ||
    creature.strength ||
    creature.attributes?.strength ||
    10
  );
}

/**
 * Get combined grapple modifiers based on size and strength difference
 * @param {Object} attacker - Attacking creature
 * @param {Object} defender - Defending creature
 * @returns {Object} Modifiers object with strikeBonus, description, autoGrapple, etc.
 */
export function getCombinedGrappleModifiers(attacker, defender) {
  const attackerSize = getSizeCategory(attacker);
  const defenderSize = getSizeCategory(defender);
  const attackerPS = getPhysicalStrength(attacker);
  const defenderPS = getPhysicalStrength(defender);

  const attackerSizeDef =
    SIZE_DEFINITIONS[attackerSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];
  const defenderSizeDef =
    SIZE_DEFINITIONS[defenderSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];

  // Base size modifier difference
  const sizeModifierDiff =
    attackerSizeDef.grappleModifier - defenderSizeDef.grappleModifier;

  // PS difference modifier (1 point per 5 PS difference)
  const psDiff = attackerPS - defenderPS;
  const psModifier = Math.floor(psDiff / 5);

  // Combined modifier
  const totalModifier = sizeModifierDiff + psModifier;

  // Auto-grapple if PS difference is 10+ (Palladium rules)
  const autoGrapple = psDiff >= 10;

  // Determine description
  let description = "";
  if (autoGrapple) {
    description = `Automatic grapple (PS difference: ${psDiff})`;
  } else if (totalModifier > 0) {
    description = `Size/Strength advantage: +${totalModifier}`;
  } else if (totalModifier < 0) {
    description = `Size/Strength disadvantage: ${totalModifier}`;
  } else {
    description = "Evenly matched";
  }

  return {
    modifier: totalModifier,
    strikeBonus:
      attackerSizeDef.strikeModifier - defenderSizeDef.strikeModifier,
    parryBonus: attackerSizeDef.parryModifier - defenderSizeDef.parryModifier,
    dodgeBonus: defenderSizeDef.dodgeModifier - attackerSizeDef.dodgeModifier,
    damageBonus:
      attackerSizeDef.damageModifier - defenderSizeDef.damageModifier,
    // Defender penalties (negative values for smaller defenders)
    defenderParryPenalty:
      defenderSizeDef.parryModifier - attackerSizeDef.parryModifier,
    defenderDodgePenalty:
      defenderSizeDef.dodgeModifier - attackerSizeDef.dodgeModifier,
    autoGrapple,
    psDiff,
    sizeModifierDiff,
    psModifier,
    description,
  };
}

/**
 * Get reach advantage modifiers (for non-grapple combat)
 * @param {Object} attacker - Attacking creature
 * @param {Object} defender - Defending creature
 * @returns {Object} Reach advantage modifiers
 */
export function getReachAdvantage(attacker, defender) {
  const attackerSize = getSizeCategory(attacker);
  const defenderSize = getSizeCategory(defender);

  const attackerSizeDef =
    SIZE_DEFINITIONS[attackerSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];
  const defenderSizeDef =
    SIZE_DEFINITIONS[defenderSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];

  // Larger creatures have reach advantage
  const sizeDiff =
    attackerSizeDef.strikeModifier - defenderSizeDef.strikeModifier;

  return {
    strikeBonus: sizeDiff > 0 ? sizeDiff : 0,
    parryBonus: sizeDiff > 0 ? sizeDiff : 0,
    reachAdvantage: sizeDiff > 0,
    description:
      sizeDiff > 0 ? `Reach advantage: +${sizeDiff}` : "No reach advantage",
  };
}

/**
 * Apply size modifiers to a creature's combat stats
 * @param {Object} creature - Creature object
 * @param {Object} modifiers - Optional modifiers object to apply
 * @returns {Object} Creature with size modifiers applied
 */
export function applySizeModifiers(creature, modifiers = null) {
  if (!creature) return creature;

  const sizeCategory = getSizeCategory(creature);
  const sizeDef =
    SIZE_DEFINITIONS[sizeCategory] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];

  // If modifiers provided, use those; otherwise use size category defaults
  const mods = modifiers || {
    strike: sizeDef.strikeModifier,
    parry: sizeDef.parryModifier,
    dodge: sizeDef.dodgeModifier,
    damage: sizeDef.damageModifier,
  };

  return {
    ...creature,
    sizeCategory,
    sizeModifiers: mods,
  };
}

/**
 * Check if attacker can lift and throw defender
 * @param {Object} attacker - Attacking creature
 * @param {Object} defender - Defending creature
 * @returns {boolean} True if attacker can lift defender
 */
export function canLiftAndThrow(attacker, defender) {
  const attackerPS = getPhysicalStrength(attacker);
  const defenderWeight = defender.weight || defender.attributes?.weight || 150;

  // Can lift if PS is at least 2x the weight (Palladium rules)
  return attackerPS >= defenderWeight * 2;
}

/**
 * Get leverage penalty for ground combat
 * @param {Object} attacker - Attacking creature
 * @param {Object} defender - Defending creature
 * @returns {number} Leverage penalty modifier
 */
export function getLeveragePenalty(attacker, defender) {
  const attackerSize = getSizeCategory(attacker);
  const defenderSize = getSizeCategory(defender);

  // Smaller creatures on ground have leverage advantage
  if (
    attackerSize === SIZE_CATEGORIES.TINY &&
    defenderSize !== SIZE_CATEGORIES.TINY
  ) {
    return -2; // Tiny creature gets -2 penalty
  }
  if (
    attackerSize === SIZE_CATEGORIES.SMALL &&
    defenderSize >= SIZE_CATEGORIES.LARGE
  ) {
    return -1; // Small creature gets -1 penalty
  }

  return 0;
}

export default {
  SIZE_CATEGORIES,
  SIZE_DEFINITIONS,
  getSizeCategory,
  getCombinedGrappleModifiers,
  getReachAdvantage,
  applySizeModifiers,
  canLiftAndThrow,
  getLeveragePenalty,
};
