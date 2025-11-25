/**
 * Palladium RPG Weapon System Utilities
 *
 * Handles weapon reach, range, and combat mechanics
 */

import { weapons, getWeaponByName } from "../data/weapons.js";

/**
 * Weapon Reach Categories
 */
export const REACH_CATEGORIES = {
  VERY_SHORT: {
    min: 0,
    max: 1,
    name: "Very Short",
    description: "Daggers, fists",
  },
  SHORT: {
    min: 2,
    max: 2,
    name: "Short",
    description: "Clubs, maces, short swords",
  },
  MEDIUM: {
    min: 3,
    max: 4,
    name: "Medium",
    description: "Long swords, battle axes",
  },
  LONG: {
    min: 5,
    max: 7,
    name: "Long",
    description: "Staves, halberds, whips",
  },
  VERY_LONG: {
    min: 8,
    max: 10,
    name: "Very Long",
    description: "Pikes, long spears",
  },
};

/**
 * Range Categories for Ranged Weapons
 */
export const RANGE_CATEGORIES = {
  POINT_BLANK: { name: "Point-Blank", modifier: 2, description: "0-10 feet" },
  SHORT: { name: "Short", modifier: 0, description: "Up to 1/3 max range" },
  MEDIUM: { name: "Medium", modifier: -1, description: "1/3 to 2/3 max range" },
  LONG: { name: "Long", modifier: -3, description: "2/3 to max range" },
  OUT_OF_RANGE: {
    name: "Out of Range",
    modifier: -10,
    description: "Beyond max range",
  },
};

/**
 * Calculate reach advantage between two weapons
 * @param {Object} attackerWeapon - Attacker's weapon
 * @param {Object} defenderWeapon - Defender's weapon
 * @returns {Object} Reach advantage info
 */
export function calculateReachAdvantage(attackerWeapon, defenderWeapon) {
  const attackerReach = attackerWeapon?.reach || 0;
  const defenderReach = defenderWeapon?.reach || 0;

  if (attackerReach > defenderReach) {
    const advantage = attackerReach - defenderReach;
    const bonus = Math.min(advantage, 3); // Max +3 bonus

    return {
      hasAdvantage: true,
      bonus: bonus,
      description: `+${bonus} to Strike (reach advantage)`,
      attackerReach,
      defenderReach,
      advantage: advantage,
    };
  }

  return {
    hasAdvantage: false,
    bonus: 0,
    description: "No reach advantage",
    attackerReach,
    defenderReach,
    advantage: 0,
  };
}

/**
 * Calculate range penalty for ranged weapons
 * @param {number} distance - Distance to target in feet
 * @param {Object} weapon - Weapon object
 * @returns {Object} Range penalty info
 */
export function calculateRangePenalty(distance, weapon) {
  if (!weapon.range) {
    return {
      penalty: 0,
      category: "melee",
      description: "Melee weapon",
      canAttack: true,
    };
  }

  const maxRange = weapon.range;
  const pointBlank = 10; // feet
  const shortRange = Math.floor(maxRange * 0.33);
  const mediumRange = Math.floor(maxRange * 0.66);

  if (distance <= pointBlank) {
    return {
      penalty: 2,
      category: "point-blank",
      description: "+2 to Strike (point-blank)",
      canAttack: true,
      rangeInfo: `${distance}ft (point-blank)`,
    };
  } else if (distance <= shortRange) {
    return {
      penalty: 0,
      category: "short",
      description: "No penalty",
      canAttack: true,
      rangeInfo: `${distance}ft (short range)`,
    };
  } else if (distance <= mediumRange) {
    return {
      penalty: -1,
      category: "medium",
      description: "-1 to Strike",
      canAttack: true,
      rangeInfo: `${distance}ft (medium range)`,
    };
  } else if (distance <= maxRange) {
    return {
      penalty: -3,
      category: "long",
      description: "-3 to Strike",
      canAttack: true,
      rangeInfo: `${distance}ft (long range)`,
    };
  } else {
    return {
      penalty: -10,
      category: "out-of-range",
      description: "Cannot attack (out of range)",
      canAttack: false,
      rangeInfo: `${distance}ft (beyond ${maxRange}ft max)`,
    };
  }
}

/**
 * Get weapon reach category
 * @param {Object} weapon - Weapon object
 * @returns {Object} Reach category info
 */
export function getWeaponReachCategory(weapon) {
  const reach = weapon.reach || 0;

  for (const [key, category] of Object.entries(REACH_CATEGORIES)) {
    if (reach >= category.min && reach <= category.max) {
      return {
        category: key,
        name: category.name,
        description: category.description,
        reach: reach,
      };
    }
  }

  return {
    category: "UNKNOWN",
    name: "Unknown",
    description: "Unknown reach",
    reach: reach,
  };
}

/**
 * Check if character can use weapon based on strength
 * @param {Object} character - Character object
 * @param {Object} weapon - Weapon object
 * @returns {Object} Usage check result
 */
export function canUseWeapon(character, weapon) {
  const characterPS = character.PS || character.ps || 10;
  const requiredPS = weapon.strengthRequired || 0;

  if (characterPS >= requiredPS) {
    return {
      canUse: true,
      penalty: 0,
      description: "Can use weapon normally",
    };
  } else {
    const penalty = requiredPS - characterPS;
    return {
      canUse: false,
      penalty: penalty,
      description: `-${penalty} to Strike (insufficient P.S.)`,
    };
  }
}

/**
 * Get weapons by reach range
 * @param {number} minReach - Minimum reach
 * @param {number} maxReach - Maximum reach (optional)
 * @returns {Array} Filtered weapons
 */
export function getWeaponsByReach(minReach, maxReach = null) {
  return weapons.filter((weapon) => {
    if (!weapon.reach) return false;
    if (maxReach) {
      return weapon.reach >= minReach && weapon.reach <= maxReach;
    }
    return weapon.reach >= minReach;
  });
}

/**
 * Get weapons by range
 * @param {number} minRange - Minimum range
 * @param {number} maxRange - Maximum range (optional)
 * @returns {Array} Filtered weapons
 */
export function getWeaponsByRange(minRange, maxRange = null) {
  return weapons.filter((weapon) => {
    if (!weapon.range) return false;
    if (maxRange) {
      return weapon.range >= minRange && weapon.range <= maxRange;
    }
    return weapon.range >= minRange;
  });
}

/**
 * Get all ranged weapons
 * @returns {Array} Ranged weapons
 */
export function getRangedWeapons() {
  return weapons.filter((weapon) => weapon.range && weapon.range > 0);
}

/**
 * Get all melee weapons
 * @returns {Array} Melee weapons
 */
export function getMeleeWeapons() {
  return weapons.filter((weapon) => !weapon.range || weapon.range === null);
}

/**
 * Calculate combat modifiers for weapon vs weapon
 * @param {Object} attackerWeapon - Attacker's weapon
 * @param {Object} defenderWeapon - Defender's weapon
 * @param {number} distance - Distance between combatants
 * @returns {Object} Combat modifiers
 */
export function calculateCombatModifiers(
  attackerWeapon,
  defenderWeapon,
  distance = 0
) {
  const modifiers = {
    strikeBonus: 0,
    parryBonus: 0,
    dodgeBonus: 0,
    damageBonus: 0,
    notes: [],
  };

  // Reach advantage
  const reachAdvantage = calculateReachAdvantage(
    attackerWeapon,
    defenderWeapon
  );
  if (reachAdvantage.hasAdvantage) {
    modifiers.strikeBonus += reachAdvantage.bonus;
    modifiers.notes.push(reachAdvantage.description);
  }

  // Range penalties (for ranged weapons)
  if (attackerWeapon.range && distance > 0) {
    const rangePenalty = calculateRangePenalty(distance, attackerWeapon);
    if (!rangePenalty.canAttack) {
      modifiers.notes.push("Cannot attack - out of range");
      return modifiers;
    }
    modifiers.strikeBonus += rangePenalty.penalty;
    modifiers.notes.push(rangePenalty.description);
  }

  // Strength requirements
  // This would need character data to calculate properly

  return modifiers;
}

/**
 * Get weapon comparison info
 * @param {string} weapon1Name - First weapon name
 * @param {string} weapon2Name - Second weapon name
 * @returns {Object} Comparison data
 */
export function compareWeapons(weapon1Name, weapon2Name) {
  const weapon1 = getWeaponByName(weapon1Name);
  const weapon2 = getWeaponByName(weapon2Name);

  if (!weapon1 || !weapon2) {
    return { error: "One or both weapons not found" };
  }

  const reachAdvantage = calculateReachAdvantage(weapon1, weapon2);
  const reverseReachAdvantage = calculateReachAdvantage(weapon2, weapon1);

  return {
    weapon1: {
      name: weapon1.name,
      damage: weapon1.damage,
      reach: weapon1.reach,
      range: weapon1.range,
      weight: weapon1.weight,
      price: weapon1.price,
      strengthRequired: weapon1.strengthRequired,
    },
    weapon2: {
      name: weapon2.name,
      damage: weapon2.damage,
      reach: weapon2.reach,
      range: weapon2.range,
      weight: weapon2.weight,
      price: weapon2.price,
      strengthRequired: weapon2.strengthRequired,
    },
    reachAdvantage: reachAdvantage,
    reverseReachAdvantage: reverseReachAdvantage,
    summary: {
      betterReach: reachAdvantage.hasAdvantage
        ? weapon1.name
        : reverseReachAdvantage.hasAdvantage
        ? weapon2.name
        : "Equal",
      betterDamage:
        weapon1.damage > weapon2.damage
          ? weapon1.name
          : weapon2.damage > weapon1.damage
          ? weapon2.name
          : "Equal",
      lighter:
        weapon1.weight < weapon2.weight
          ? weapon1.name
          : weapon2.weight < weapon1.weight
          ? weapon2.name
          : "Equal",
    },
  };
}

/**
 * Get weapon stats display
 * @param {Object} weapon - Weapon object
 * @returns {Object} Formatted stats
 */
export function getWeaponStats(weapon) {
  const stats = {
    name: weapon.name,
    damage: weapon.damage,
    category: weapon.category,
    weight: `${weapon.weight} lbs`,
    price: `${weapon.price} GP`,
    strengthRequired: weapon.strengthRequired || "None",
  };

  if (weapon.reach) {
    stats.reach = `${weapon.reach} feet`;
    const reachCategory = getWeaponReachCategory(weapon);
    stats.reachCategory = reachCategory.name;
  }

  if (weapon.range) {
    stats.range = `${weapon.range} feet`;
    stats.rateOfFire = `${weapon.rateOfFire} attacks/melee`;
    stats.ammunition = weapon.ammunition || "None";
  }

  if (weapon.notes) {
    stats.notes = weapon.notes;
  }

  return stats;
}

export default {
  REACH_CATEGORIES,
  RANGE_CATEGORIES,
  calculateReachAdvantage,
  calculateRangePenalty,
  getWeaponReachCategory,
  canUseWeapon,
  getWeaponsByReach,
  getWeaponsByRange,
  getRangedWeapons,
  getMeleeWeapons,
  calculateCombatModifiers,
  compareWeapons,
  getWeaponStats,
};
