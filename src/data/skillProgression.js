/**
 * Skill progression by level for Palladium Fantasy RPG
 * All bonuses scale with character level
 */

export const handToHandProgression = {
  "Hand to Hand: Basic": {
    attacks: { 1: 2, 3: 3, 6: 4, 9: 5, 12: 6, 15: 7 },
    bonuses: {
      1: { strike: 0, parry: 2, dodge: 2, damage: 0 },
      3: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      6: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      12: { strike: 1, parry: 0, dodge: 1, damage: 1 },
      15: { strike: 0, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "Hand to Hand: Expert": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { strike: 1, parry: 3, dodge: 3, damage: 1 },
      2: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 1, damage: 1 },
      8: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      10: { strike: 0, parry: 1, dodge: 0, damage: 1 },
      12: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      14: { strike: 0, parry: 1, dodge: 1, damage: 0 },
    },
  },
  "Hand to Hand: Martial Arts": {
    attacks: { 1: 4, 2: 5, 4: 6, 7: 7, 10: 8, 13: 9, 15: 10 },
    bonuses: {
      1: { strike: 2, parry: 3, dodge: 3, damage: 2 },
      2: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      3: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      5: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      7: { strike: 1, parry: 1, dodge: 1, damage: 0 },
      9: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      11: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      13: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      15: { strike: 1, parry: 1, dodge: 1, damage: 0 },
    },
  },
  "Hand to Hand: Assassin": {
    attacks: { 1: 4, 3: 5, 6: 6, 9: 7, 12: 8, 15: 9 },
    bonuses: {
      1: { strike: 2, parry: 2, dodge: 2, damage: 3 },
      3: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      5: { strike: 0, parry: 1, dodge: 0, damage: 1 },
      7: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      9: { strike: 0, parry: 1, dodge: 1, damage: 1 },
      11: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      13: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      15: { strike: 1, parry: 0, dodge: 1, damage: 1 },
    },
  },
  "Hand to Hand: Mercenary": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { strike: 1, parry: 2, dodge: 2, damage: 1 },
      3: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 1 },
      9: { strike: 1, parry: 1, dodge: 1, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 1, damage: 1 },
      15: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "Hand to Hand: Knight": {
    attacks: { 1: 3, 3: 4, 6: 5, 9: 6, 12: 7, 15: 8 },
    bonuses: {
      1: { strike: 1, parry: 3, dodge: 2, damage: 1 },
      3: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      7: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      9: { strike: 1, parry: 0, dodge: 1, damage: 1 },
      11: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      13: { strike: 1, parry: 1, dodge: 1, damage: 0 },
      15: { strike: 0, parry: 0, dodge: 1, damage: 1 },
    },
  },
};

export const physicalSkillProgression = {
  Boxing: {
    attacks: { 1: 1, 5: 0, 10: 1 }, // +1 attack at L1, +1 more at L10
    bonuses: {
      1: { strike: 1, parry: 2, dodge: 2, damage: 0 },
      3: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      6: { strike: 1, parry: 0, dodge: 1, damage: 0 },
      9: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      12: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  Wrestling: {
    attacks: { 1: 1, 7: 0, 13: 1 }, // +1 attack at L1, +1 more at L13
    bonuses: {
      1: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 1, damage: 0 },
    },
  },
  // "Body Building": {  // Removed - not in 1994 rulebook, can add back later
  //   attacks: {},
  //   bonuses: {
  //     1: { strike: 0, parry: 0, dodge: 0, damage: 2 },
  //     5: { strike: 0, parry: 0, dodge: 0, damage: 1 },
  //     10: { strike: 0, parry: 0, dodge: 0, damage: 1 },
  //     15: { strike: 0, parry: 0, dodge: 0, damage: 1 },
  //   },
  // },
  Acrobatics: {
    attacks: {},
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 2, damage: 0 },
      3: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      12: { strike: 0, parry: 1, dodge: 1, damage: 0 },
    },
  },
  Gymnastics: {
    attacks: {},
    bonuses: {
      1: { strike: 0, parry: 1, dodge: 1, damage: 0 },
      4: { strike: 0, parry: 0, dodge: 1, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 0, dodge: 1, damage: 0 },
    },
  },
};

export const weaponProficiencyProgression = {
  "W.P. Sword": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Bow": {
    bonuses: {
      1: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Crossbow": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Shield": {
    bonuses: {
      1: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Small Shield": {
    bonuses: {
      1: { strike: 0, parry: 2, dodge: 0, damage: 0 },
      4: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Spear": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Staff": {
    bonuses: {
      1: { strike: 1, parry: 2, dodge: 0, damage: 0 },
      3: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      6: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      9: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Axe": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 0, dodge: 0, damage: 1 },
    },
  },
  "W.P. Knife": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Lance": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      12: { strike: 1, parry: 0, dodge: 0, damage: 1 },
    },
  },
  "W.P. Long Bow": {
    bonuses: {
      1: { strike: 2, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Short Sword": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 0, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Garrote": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 1 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 1 },
    },
  },
  "W.P. Net": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Cutlass": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      3: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      6: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      9: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
  "W.P. Harpoon": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 1 },
    },
  },
  "W.P. Pistol Crossbow": {
    bonuses: {
      1: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      5: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      10: { strike: 1, parry: 0, dodge: 0, damage: 0 },
    },
  },
  "W.P. Club": {
    bonuses: {
      1: { strike: 1, parry: 1, dodge: 0, damage: 0 },
      4: { strike: 1, parry: 0, dodge: 0, damage: 0 },
      8: { strike: 0, parry: 1, dodge: 0, damage: 0 },
      12: { strike: 1, parry: 1, dodge: 0, damage: 0 },
    },
  },
};

/**
 * Calculate cumulative skill bonuses up to a given level
 * @param {Object} progression - Skill progression object (bonuses by level)
 * @param {number} level - Current character level
 * @returns {Object} - Cumulative bonuses { strike, parry, dodge, damage }
 */
function getCumulativeSkillBonuses(progression, level) {
  if (!progression || !progression.bonuses) {
    return { strike: 0, parry: 0, dodge: 0, damage: 0 };
  }

  const cumulative = {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
  };

  // Add bonuses from all level thresholds up to current level
  Object.keys(progression.bonuses).forEach((threshold) => {
    if (level >= parseInt(threshold)) {
      const bonuses = progression.bonuses[threshold];
      cumulative.strike += bonuses.strike || 0;
      cumulative.parry += bonuses.parry || 0;
      cumulative.dodge += bonuses.dodge || 0;
      cumulative.damage += bonuses.damage || 0;
    }
  });

  return cumulative;
}

/**
 * Calculate cumulative attack bonuses from a skill
 * @param {Object} progression - Skill progression object (attacks by level)
 * @param {number} level - Current character level
 * @returns {number} - Total attack bonus
 */
function getCumulativeAttackBonus(progression, level) {
  if (!progression || !progression.attacks) {
    return 0;
  }

  let totalAttacks = 0;
  Object.keys(progression.attacks).forEach((threshold) => {
    if (level >= parseInt(threshold)) {
      totalAttacks += progression.attacks[threshold] || 0;
    }
  });

  return totalAttacks;
}

/**
 * Get skill bonuses for a character at a specific level
 * @param {string} skillName - Name of the skill
 * @param {number} level - Character level
 * @returns {Object} - { bonuses: {strike, parry, dodge, damage}, attacks: number }
 */
export function getSkillBonusesAtLevel(skillName, level) {
  let progression = null;

  // Check which category this skill belongs to
  if (handToHandProgression[skillName]) {
    progression = handToHandProgression[skillName];
  } else if (physicalSkillProgression[skillName]) {
    progression = physicalSkillProgression[skillName];
  } else if (weaponProficiencyProgression[skillName]) {
    progression = weaponProficiencyProgression[skillName];
  } else if (skillName === "W.P. Dagger") {
    // W.P. Dagger uses the same progression as W.P. Knife
    progression = weaponProficiencyProgression["W.P. Knife"];
  }

  if (!progression) {
    return {
      bonuses: { strike: 0, parry: 0, dodge: 0, damage: 0 },
      attacks: 0,
    };
  }

  return {
    bonuses: getCumulativeSkillBonuses(progression, level),
    attacks: getCumulativeAttackBonus(progression, level),
  };
}

export default {
  handToHandProgression,
  physicalSkillProgression,
  weaponProficiencyProgression,
  getSkillBonusesAtLevel,
};
