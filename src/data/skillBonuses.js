/**
 * Skill bonuses for Palladium Fantasy RPG
 * These bonuses stack with level-based bonuses
 * Import level-based progression
 */

import { getSkillBonusesAtLevel } from "./skillProgression";

export const skillBonuses = {
  // Physical Skills
  Boxing: {
    strike: 1,
    parry: 2,
    dodge: 2,
    damage: 0,
    description: "+1 attack per melee, +1 strike, +2 parry, +2 dodge",
  },
  Wrestling: {
    strike: 0,
    parry: 0,
    dodge: 1,
    damage: 0,
    description: "+1 attack per melee, +1 dodge, body throw/flip attacks",
  },
  // "Body Building": {  // Removed - not in 1994 rulebook, can add back later
  //   strike: 0,
  //   parry: 0,
  //   dodge: 0,
  //   damage: 2,
  //   description: "+2 damage, +10 SDC, +1d6 PS",
  // },
  Acrobatics: {
    strike: 0,
    parry: 1,
    dodge: 2,
    damage: 0,
    description: "+1 parry, +2 dodge, +1 roll with impact",
  },
  Gymnastics: {
    strike: 0,
    parry: 1,
    dodge: 1,
    damage: 0,
    description: "+1 parry, +1 dodge, +1 roll with impact",
  },

  // Hand to Hand Combat Styles (OCC Skills)
  "Hand to Hand: Basic": {
    strike: 0,
    parry: 2,
    dodge: 2,
    damage: 0,
    description: "2 attacks per melee, +2 parry, +2 dodge at level 1",
  },
  "Hand to Hand: Expert": {
    strike: 1,
    parry: 3,
    dodge: 3,
    damage: 1,
    description:
      "3 attacks per melee, +1 strike, +3 parry, +3 dodge, +1 damage at level 1",
  },
  "Hand to Hand: Martial Arts": {
    strike: 2,
    parry: 3,
    dodge: 3,
    damage: 2,
    description:
      "4 attacks per melee, +2 strike, +3 parry, +3 dodge, +2 damage at level 1",
  },
  "Hand to Hand: Assassin": {
    strike: 2,
    parry: 2,
    dodge: 2,
    damage: 3,
    description:
      "4 attacks per melee, +2 strike, +2 parry, +2 dodge, +3 damage at level 1",
  },
  "Hand to Hand: Mercenary": {
    strike: 1,
    parry: 2,
    dodge: 2,
    damage: 1,
    description:
      "3 attacks per melee, +1 strike, +2 parry, +2 dodge, +1 damage at level 1",
  },
  "Hand to Hand: Knight": {
    strike: 1,
    parry: 3,
    dodge: 2,
    damage: 1,
    description:
      "3 attacks per melee, +1 strike, +3 parry, +2 dodge, +1 damage at level 1",
  },

  // Weapon Proficiencies (give strike/parry bonuses)
  "W.P. Sword": {
    strike: 1,
    parry: 1,
    dodge: 0,
    damage: 0,
    description: "+1 strike, +1 parry with swords",
  },
  "W.P. Bow": {
    strike: 2,
    parry: 0,
    dodge: 0,
    damage: 0,
    description: "+2 strike with bows",
  },
  "W.P. Crossbow": {
    strike: 1,
    parry: 0,
    dodge: 0,
    damage: 0,
    description: "+1 strike with crossbows",
  },
  "W.P. Shield": {
    strike: 0,
    parry: 2,
    dodge: 0,
    damage: 0,
    description: "+2 parry with shield",
  },
  "W.P. Spear": {
    strike: 1,
    parry: 1,
    dodge: 0,
    damage: 0,
    description: "+1 strike, +1 parry with spears",
  },
  "W.P. Staff": {
    strike: 1,
    parry: 2,
    dodge: 0,
    damage: 0,
    description: "+1 strike, +2 parry with staff",
  },
  "W.P. Axe": {
    strike: 1,
    parry: 0,
    dodge: 0,
    damage: 0,
    description: "+1 strike with axes",
  },
  "W.P. Knife": {
    strike: 1,
    parry: 1,
    dodge: 0,
    damage: 0,
    description: "+1 strike, +1 parry with knives",
  },

  // Other Skills with Bonuses
  Prowl: {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    description: "Stealth movement, no combat bonuses",
  },
  Track: {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    description: "Tracking ability, no combat bonuses",
  },
  "Detect Ambush": {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    initiative: 1,
    description: "+1 initiative when ambush is detected",
  },

  // Psionic/Mental Skills
  Meditation: {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    ispRecovery: 2,
    description: "Doubles ISP recovery rate (2 ISP per hour instead of 1)",
  },
  "Lore: Psionics": {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    ispBonus: 10,
    description: "+10 ISP at level 1",
  },
};

/**
 * Calculate total skill bonuses from a character's skills at a specific level
 * Only includes GENERAL bonuses (Hand to Hand, Physical Skills)
 * W.P. bonuses are weapon-specific and tracked separately
 * @param {Array} occSkills - OCC skills list
 * @param {Array} electiveSkills - Elective skills list
 * @param {Array} secondarySkills - Secondary skills list
 * @param {number} level - Character level for progression calculation
 * @returns {Object} - Total bonuses { strike, parry, dodge, damage, initiative, ispBonus, ispRecovery, weaponProficiencies }
 */
export function calculateSkillBonuses(
  occSkills = [],
  electiveSkills = [],
  secondarySkills = [],
  level = 1
) {
  const totals = {
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    initiative: 0,
    ispBonus: 0,
    ispRecovery: 1, // Base recovery rate
    attacksPerMelee: 0,
    weaponProficiencies: [], // Track W.P. skills separately
  };

  const allSkills = [...occSkills, ...electiveSkills, ...secondarySkills];

  allSkills.forEach((skill) => {
    // Try to get level-based progression first
    const levelBasedBonuses = getSkillBonusesAtLevel(skill, level);

    // Check if it's a Weapon Proficiency (W.P.)
    if (skill.startsWith("W.P.")) {
      // Don't add to general bonuses, just track it
      totals.weaponProficiencies.push({
        name: skill,
        bonuses: levelBasedBonuses.bonuses,
        level: level,
      });
    } else if (
      levelBasedBonuses.bonuses.strike > 0 ||
      levelBasedBonuses.bonuses.parry > 0 ||
      levelBasedBonuses.bonuses.dodge > 0 ||
      levelBasedBonuses.bonuses.damage > 0 ||
      levelBasedBonuses.attacks > 0
    ) {
      // Use level-based progression for combat skills
      totals.strike += levelBasedBonuses.bonuses.strike;
      totals.parry += levelBasedBonuses.bonuses.parry;
      totals.dodge += levelBasedBonuses.bonuses.dodge;
      totals.damage += levelBasedBonuses.bonuses.damage;
      totals.attacksPerMelee += levelBasedBonuses.attacks;
    } else {
      // Fall back to static bonuses for non-combat skills
      const bonus = skillBonuses[skill];
      if (bonus) {
        totals.strike += bonus.strike || 0;
        totals.parry += bonus.parry || 0;
        totals.dodge += bonus.dodge || 0;
        totals.damage += bonus.damage || 0;
        totals.initiative += bonus.initiative || 0;
        totals.ispBonus += bonus.ispBonus || 0;

        // ISP recovery multiplier (Meditation doubles it)
        if (bonus.ispRecovery) {
          totals.ispRecovery = bonus.ispRecovery;
        }
      }
    }
  });

  return totals;
}

export default {
  skillBonuses,
  calculateSkillBonuses,
};
