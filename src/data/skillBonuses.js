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
        specials: levelBasedBonuses.specials || {},
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


// Resolve which W.P. applies to a weapon object (best-effort inference from name/category).
// NOTE: Prefer adding an explicit `wp` field to weapons in your weapons dataset for perfect accuracy.
export function inferWeaponProficiencyName(weapon) {
  if (!weapon) return null;

  // If weapons have an explicit wp tag, use it (this is the most accurate)
  if (weapon.wp && typeof weapon.wp === "string") return weapon.wp;

  const name = String(weapon.name || "").toLowerCase();
  const category = String(weapon.category || "").toLowerCase();

  // Missile weapon categories
  if (category === "bow") {
    if (name.includes("long")) return "W.P. Long bow";
    return "W.P. Short bow";
  }
  if (category === "crossbow") return "W.P. Cross bow";
  if (name === "sling" || category === "sling") return "W.P. Sling";

  // Melee categories by name
  if (name.includes("shield")) {
    return name.includes("large") ? "W.P. Large shield" : "W.P. Small shield";
  }
  if (name.includes("short sword") || name.includes("sabre") || name.includes("scimitar") || name.includes("cutlass"))
    return "W.P. Short swords";
  if (
    name.includes("bastard") ||
    name.includes("broadsword") ||
    name.includes("long sword") ||
    name.includes("claymore") ||
    name.includes("flamberge") ||
    name.includes("espandon")
  ) {
    return "W.P. Large sword";
  }
  if (name.includes("dagger") || name.includes("knife")) return "W.P. Knives";
  if (name.includes("throwing axe")) return "W.P. Throwing axe";
  if (name.includes("battle axe") || name.includes("axe") || name.includes("bipennis") || name.includes("pick"))
    return "W.P. Battle Axe";
  if (name.includes("lance")) return "W.P. Lance";
  if (name.includes("spear") || name.includes("fork") || name.includes("trident") || name.includes("javelin"))
    return "W.P. Spears/Forks";
  if (name.includes("staff") || name.includes("stave")) return "W.P. Staves";
  if (
    name.includes("pole") ||
    name.includes("halberd") ||
    name.includes("pike") ||
    name.includes("glaive") ||
    name.includes("guisarme") ||
    name.includes("voulge") ||
    name.includes("berdiche")
  )
    return "W.P. Pole arms";
  if (name.includes("ball") && name.includes("chain")) return "W.P. Ball and Chain";
  if (
    name.includes("mace") ||
    name.includes("club") ||
    name.includes("hammer") ||
    name.includes("flail") ||
    name.includes("morning star")
  )
    return "W.P. Blunt";

  return null;
}

// Returns W.P. bonuses for the currently-used weapon.
// If the character is untrained, bonuses are 0; for bows/crossbows/slings, rateOfFire falls back to 1.
export function getWeaponProficiencyBonusesForWeapon(combatBonuses, weapon) {
  const rawWpName = inferWeaponProficiencyName(weapon);
  if (!rawWpName) {
    const name = String(weapon?.name || "").toLowerCase();
    const category = String(weapon?.category || "").toLowerCase();
    const isMissile = category === "bow" || category === "crossbow" || name === "sling";
    return { strike: 0, parry: 0, throwStrike: 0, rateOfFire: isMissile ? 1 : null, proficient: false };
  }

  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n = normalize(rawWpName);

  // Expand a few common equivalents so "W.P. Cross bow" == "W.P. Crossbow", etc.
  const candidates = new Set([n]);

  if (n === "wp short sword" || n === "wp short swords") {
    candidates.add("wp short sword");
    candidates.add("wp short swords");
  }
  if (n === "wp large sword" || n === "wp large swords") {
    candidates.add("wp large sword");
    candidates.add("wp large swords");
    candidates.add("wp sword"); // some datasets use generic
  }
  if (n === "wp throwing axe") {
    candidates.add("wp axe");
  }
  if (n === "wp battle axe") {
    candidates.add("wp axe");
  }
  if (n === "wp long bow" || n === "wp short bow") {
    candidates.add("wp bow");
  }
  if (n === "wp cross bow") {
    candidates.add("wp crossbow");
  }
  if (n === "wp crossbow") {
    candidates.add("wp cross bow");
  }
  if (n === "wp pole arms") {
    candidates.add("wp polearms");
  }
  if (n === "wp polearms") {
    candidates.add("wp pole arms");
  }
  if (n === "wp knives") {
    candidates.add("wp knife");
  }
  if (n === "wp knife") {
    candidates.add("wp knives");
  }
  if (n === "wp spears/forks") {
    candidates.add("wp spear/forks");
    candidates.add("wp spear forks");
    candidates.add("wp spears forks");
  }

  const list = combatBonuses?.weaponProficiencies || [];

  const wpEntry =
    list.find((wp) => candidates.has(normalize(wp.name))) ||
    null;

  if (!wpEntry) {
    const weaponName = String(weapon?.name || "").toLowerCase();
    const category = String(weapon?.category || "").toLowerCase();
    const isMissile = category === "bow" || category === "crossbow" || weaponName === "sling";
    const rofFallback = isMissile ? 1 : null;
    return { strike: 0, parry: 0, throwStrike: 0, rateOfFire: rofFallback, proficient: false };
  }

  const rof = wpEntry.specials?.rateOfFire ?? null;
  return {
    strike: wpEntry.bonuses?.strike || 0,
    parry: wpEntry.bonuses?.parry || 0,
    throwStrike: wpEntry.bonuses?.throwStrike || 0,
    rateOfFire: rof,
    proficient: true,
  };
}

