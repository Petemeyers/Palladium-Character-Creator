/**
 * O.C.C. Skill Tables & Modifiers (Palladium RPG)
 *
 * Base skill percentages for each O.C.C., plus stat-based modifiers.
 * Skills represent non-combat abilities: stealth, knowledge, trades, etc.
 * 
 * NOTE: Skill percentage calculations now delegate to skillSystem.js
 * to use rulebook-accurate progression tables from skillProgression.js
 */

import { getSkillPercentage } from './skillSystem.js';

// ========== O.C.C. BASE SKILL TABLES ==========

export const occSkillTables = {
  // ========== MEN OF MAGIC ==========
  Wizard: {
    readWrite: 30,
    loreMagic: 35,
    loreHistory: 20,
    prowl: 10,
    pickLocks: 0,
    track: 0,
    identifyPlants: 15,
    meditation: 40,
  },

  Warlock: {
    readWrite: 25,
    loreMagic: 30,
    loreMonsters: 25,
    prowl: 15,
    track: 10,
    horsemanship: 20,
    meditation: 35,
  },

  Summoner: {
    readWrite: 28,
    loreMagic: 30,
    loreDemonic: 35,
    meditation: 40,
    prowl: 10,
    identifyPlants: 10,
  },

  Priest: {
    readWrite: 30,
    loreReligion: 40,
    loreMagic: 20,
    medical: 28,
    prowl: 12,
    literacy: 35,
  },

  Cleric: {
    readWrite: 30,
    loreReligion: 35,
    medical: 30,
    prowl: 15,
    horsemanship: 25,
    literacy: 30,
  },

  Witch: {
    readWrite: 25,
    loreMagic: 30,
    loreHerbs: 35,
    identifyPlants: 40,
    prowl: 20,
    meditation: 30,
    brewing: 35,
  },

  Diabolist: {
    readWrite: 28,
    loreMagic: 30,
    loreDemonic: 40,
    meditation: 35,
    prowl: 12,
    intimidation: 25,
  },

  // ========== MEN OF ARMS ==========
  Knight: {
    readWrite: 20,
    horsemanship: 40,
    loreMilitary: 30,
    weaponSmithing: 20,
    prowl: 15,
    track: 20,
    heraldry: 25,
  },

  Paladin: {
    readWrite: 25,
    horsemanship: 40,
    loreReligion: 30,
    medical: 25,
    prowl: 18,
    track: 25,
    heraldry: 20,
  },

  Soldier: {
    prowl: 18,
    track: 25,
    readWrite: 15,
    loreMilitary: 30,
    horsemanship: 30,
    weaponMaintenance: 25,
    camouflage: 20,
  },

  Mercenary: {
    track: 25,
    prowl: 20,
    pickLocks: 15,
    readWrite: 10,
    gamble: 30,
    streetwise: 25,
    weaponMaintenance: 20,
  },

  LongBowman: {
    prowl: 25,
    track: 30,
    identifyPlants: 20,
    camouflage: 30,
    readWrite: 10,
    horsemanship: 20,
    survival: 35,
  },

  Ranger: {
    track: 40,
    prowl: 30,
    identifyPlants: 35,
    survival: 40,
    camouflage: 35,
    readWrite: 20,
    horsemanship: 25,
  },

  // ========== MEN OF THE MIND ==========
  "Mind Mage": {
    readWrite: 25,
    lorePsionics: 40,
    meditation: 45,
    prowl: 15,
    track: 10,
    hypnosis: 35,
    detectDeception: 30,
  },

  // ========== OPTIONAL CLASSES ==========
  Thief: {
    pickLocks: 35,
    pickPockets: 30,
    prowl: 40,
    disguise: 25,
    readWrite: 20,
    palming: 30,
    streetwise: 35,
    climb: 35,
  },

  Assassin: {
    prowl: 45,
    pickLocks: 30,
    poisonCraft: 35,
    disguise: 30,
    track: 25,
    readWrite: 15,
    intimidation: 30,
    climb: 30,
  },

  Scholar: {
    readWrite: 40,
    loreHistory: 40,
    loreMagic: 30,
    loreMonsters: 25,
    literacy: 45,
    research: 40,
    identifyPlants: 20,
  },

  Peasant: {
    readWrite: 10,
    farming: 40,
    animalHusbandry: 30,
    identifyPlants: 25,
    cooking: 30,
    prowl: 10,
    track: 15,
  },
};

// ========== SKILL MODIFIERS ==========

/**
 * Calculate IQ bonus to skill percentage
 * @param {number} iq - Intelligence Quotient (3-30+)
 * @returns {number} - Percentage bonus to skills
 */
export function iqBonus(iq) {
  if (iq >= 24) return 10; // Genius
  if (iq >= 20) return 8; // Brilliant
  if (iq >= 16) return 5; // Very High
  if (iq >= 12) return 3; // Above Average
  if (iq >= 8) return 0; // Average
  return -2; // Below Average
}

/**
 * Calculate PP bonus to physical skills (Prowl, Pick Locks, Climb)
 * @param {number} pp - Physical Prowess (3-30+)
 * @returns {number} - Percentage bonus to physical skills
 */
export function ppBonus(pp) {
  if (pp >= 24) return 10;
  if (pp >= 20) return 7;
  if (pp >= 16) return 5;
  if (pp >= 12) return 3;
  return 0;
}

/**
 * Calculate ME bonus to mental skills (Meditation, Hypnosis)
 * @param {number} me - Mental Endurance (3-30+)
 * @returns {number} - Percentage bonus to mental skills
 */
export function meBonus(me) {
  if (me >= 20) return 8;
  if (me >= 16) return 5;
  if (me >= 12) return 3;
  return 0;
}

// ========== PHYSICAL SKILLS (PP-BASED) ==========
const physicalSkills = [
  "prowl",
  "pickLocks",
  "climb",
  "pickPockets",
  "palming",
  "disguise",
  "camouflage",
];

// ========== MENTAL SKILLS (ME-BASED) ==========
const mentalSkills = ["meditation", "hypnosis", "detectDeception"];

/**
 * Build complete skill set for a character
 * NOTE: This function now delegates to skillSystem.js to avoid conflicting rule systems.
 * All skill percentages come from skillProgression.js tables via skillSystem.js.
 * 
 * @param {string} occ - O.C.C. name
 * @param {number} iq - Intelligence
 * @param {number} pp - Physical Prowess
 * @param {number} me - Mental Endurance
 * @param {number} level - Character level
 * @returns {Object} - Skill set with base, modifiers, and total
 * @deprecated Consider using getSkillPercentage() from skillSystem.js directly
 */
export function buildSkillSet(occ, iq, pp, me, level = 1) {
  const baseSkills = occSkillTables[occ] || {};
  const iqMod = iqBonus(iq);
  const ppMod = ppBonus(pp);
  const meMod = meBonus(me);

  const result = {};
  
  // Create a character object for skillSystem.js
  const character = {
    level,
    IQ: iq,
    iq,
    PP: pp,
    pp,
    ME: me,
    me,
  };

  Object.entries(baseSkills).forEach(([skill, base]) => {
    // Determine which modifier applies (for display purposes)
    let statBonus = iqMod; // Default: IQ bonus

    if (physicalSkills.includes(skill)) {
      statBonus = ppMod; // Physical skills use PP
    } else if (mentalSkills.includes(skill)) {
      statBonus = meMod; // Mental skills use ME
    }

    // Get skill percentage from skillSystem.js (uses skillProgression.js tables)
    // This replaces the old +5%/level logic - now uses rulebook-accurate progression tables
    const total = getSkillPercentage(character, skill, 'occ');

    result[skill] = {
      base,
      statBonus,
      levelBonus: total - base - statBonus, // Calculate what the level bonus contributed
      total,
      type: physicalSkills.includes(skill)
        ? "Physical"
        : mentalSkills.includes(skill)
        ? "Mental"
        : "Knowledge",
    };
  });

  return result;
}

/**
 * Roll a skill check (d100)
 * @param {number} skillPercent - Target percentage (1-98)
 * @returns {Object} - Result with roll, success, and margin
 */
export function rollSkillCheck(skillPercent) {
  const roll = Math.floor(Math.random() * 100) + 1;
  const success = roll <= skillPercent;
  const margin = success ? skillPercent - roll : roll - skillPercent;

  return {
    roll,
    target: skillPercent,
    success,
    margin,
    critical: roll === 1, // Natural 1 is always critical success
    fumble: roll === 100, // Natural 100 is always fumble
  };
}

/**
 * Format skill for display
 * @param {string} skillName - Skill name
 * @param {Object} skillData - Skill data object
 * @returns {string} - Formatted string
 */
export function formatSkill(skillName, skillData) {
  const { base, statBonus, levelBonus, total, type } = skillData;

  let breakdown = `${base}% (base)`;
  if (statBonus > 0) breakdown += ` +${statBonus}% (stat)`;
  if (levelBonus > 0) breakdown += ` +${levelBonus}% (level)`;

  return `${skillName} (${type}): ${total}% [${breakdown}]`;
}

/**
 * Get all skills of a specific type
 * @param {Object} skills - Full skill set
 * @param {string} type - "Physical", "Mental", or "Knowledge"
 * @returns {Object} - Filtered skill set
 */
export function getSkillsByType(skills, type) {
  const filtered = {};

  Object.entries(skills).forEach(([skill, data]) => {
    if (data.type === type) {
      filtered[skill] = data;
    }
  });

  return filtered;
}

/**
 * Check if character has a specific skill
 * @param {Object} skills - Character's skill set
 * @param {string} skillName - Skill to check
 * @returns {boolean} - True if skill exists and is > 0%
 */
export function hasSkill(skills, skillName) {
  return skills[skillName] && skills[skillName].total > 0;
}

/**
 * Get best skill in a category
 * @param {Object} skills - Character's skill set
 * @param {Array<string>} skillNames - Skills to compare
 * @returns {Object} - { name, data }
 */
export function getBestSkill(skills, skillNames) {
  let best = null;
  let bestValue = 0;

  skillNames.forEach((name) => {
    if (skills[name] && skills[name].total > bestValue) {
      best = { name, data: skills[name] };
      bestValue = skills[name].total;
    }
  });

  return best;
}
