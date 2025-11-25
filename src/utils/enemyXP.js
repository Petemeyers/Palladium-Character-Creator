/**
 * Enemy XP System (Palladium RPG)
 *
 * Calculates and awards XP from bestiary creatures
 */

import { addExperience } from "./xpSystem";
import { getAllBestiaryEntries } from "./bestiaryUtils.js";

// ========== XP CALCULATION FROM BESTIARY ==========

/**
 * Calculate XP value for a monster from bestiary
 * @param {Object} monster - Monster object from bestiary.json
 * @returns {number} - XP value
 */
export function calculateMonsterXP(monster) {
  // If monster has explicit XP value, use it
  if (monster.XPValue) return monster.XPValue;
  if (monster.xp) return monster.xp;
  if (monster.experiencePoints) return monster.experiencePoints;

  // Auto-calculate from monster attributes
  const level = extractLevel(monster);
  const ar = monster.AR || 10;
  const hp = extractHP(monster);
  const sdc = monster.SDC || 0;

  // Base XP from level (matches xpSystem.js enemy table)
  const baseLevelXP = {
    1: 50,
    2: 100,
    3: 200,
    4: 400,
    5: 800,
    6: 1600,
    7: 3200,
    8: 6400,
    9: 12800,
    10: 25600,
  };

  let xp = baseLevelXP[level] || level * 100;

  // Toughness modifier (AR + HP + SDC contribute to XP)
  const toughnessBonus = Math.floor((ar - 10) * 10 + hp / 5 + sdc / 10);
  xp += toughnessBonus;

  // Category modifiers
  if (monster.category === "greater_demon") xp *= 3;
  if (monster.category === "lesser_demon") xp *= 1.5;
  if (monster.category === "undead") xp *= 1.2;
  if (monster.category === "dragon") xp *= 4;
  if (monster.category === "creature_of_magic") xp *= 1.5;

  // Boss/Elite flags (from bestiary or name)
  if (
    monster.isBoss ||
    monster.name.includes("Lord") ||
    monster.name.includes("King")
  ) {
    xp *= 5;
  }
  if (
    monster.isElite ||
    monster.name.includes("Elite") ||
    monster.name.includes("Champion")
  ) {
    xp *= 2;
  }

  return Math.round(xp);
}

/**
 * Extract level from monster (handles various formats)
 * @param {Object} monster - Monster object
 * @returns {number} - Effective level
 */
export function extractLevel(monster) {
  if (monster.level) return monster.level;

  // Estimate from hit dice
  if (monster.HP && typeof monster.HP === "string") {
    const match = monster.HP.match(/(\d+)d/);
    if (match) return parseInt(match[1], 10);
  }

  // Estimate from AR (rough approximation)
  if (monster.AR >= 18) return 10;
  if (monster.AR >= 16) return 8;
  if (monster.AR >= 14) return 6;
  if (monster.AR >= 12) return 4;
  if (monster.AR >= 10) return 2;
  return 1;
}

/**
 * Extract average HP from monster (handles dice notation)
 * @param {Object} monster - Monster object
 * @returns {number} - Average HP
 */
function extractHP(monster) {
  if (typeof monster.HP === "number") return monster.HP;

  if (typeof monster.HP === "string") {
    const match = monster.HP.match(/(\d+)d(\d+)/);
    if (match) {
      const numDice = parseInt(match[1], 10);
      const dieSize = parseInt(match[2], 10);
      return Math.floor(numDice * (dieSize / 2 + 0.5)); // Average roll
    }
  }

  return 20; // Default
}

/**
 * Grant XP to character(s) from defeated enemy
 * @param {Object} character - Character object (or party leader)
 * @param {Object} monster - Monster from bestiary
 * @param {Array} party - Party members (optional)
 * @returns {Object|Array} - Updated character(s)
 */
export function grantXPFromEnemy(character, monster, party = []) {
  const totalXP = calculateMonsterXP(monster);

  // Solo combat
  if (!party || party.length === 0) {
    return addExperience(character, totalXP);
  }

  // Party combat - split XP
  const xpPerMember = Math.floor(totalXP / party.length);
  const updatedParty = party.map((member) =>
    addExperience(member, xpPerMember)
  );

  return updatedParty;
}

/**
 * Get XP summary for display
 * @param {Object} monster - Monster from bestiary
 * @param {number} partySize - Number of party members
 * @returns {Object} - XP details
 */
export function getXPSummary(monster, partySize = 1) {
  const totalXP = calculateMonsterXP(monster);
  const xpPerMember = Math.floor(totalXP / partySize);

  return {
    total: totalXP,
    perMember: xpPerMember,
    partySize,
    monsterName: monster.name,
    monsterLevel: extractLevel(monster),
  };
}

/**
 * Load monster from bestiary by name
 * @param {string} monsterName - Name of monster
 * @param {Object} bestiary - Bestiary data
 * @returns {Object|null} - Monster object or null
 */
export function getMonsterByName(monsterName, bestiary) {
  if (!bestiary || !bestiary.bestiary) {
    return null;
  }

  const monsters = getAllBestiaryEntries(bestiary);
  return monsters.find(
    (m) => m.name.toLowerCase() === monsterName.toLowerCase()
  );
}

/**
 * Load monster from bestiary by ID
 * @param {string} monsterId - Monster ID
 * @param {Object} bestiary - Bestiary data
 * @returns {Object|null} - Monster object or null
 */
export function getMonsterById(monsterId, bestiary) {
  if (!bestiary || !bestiary.bestiary) {
    return null;
  }

  const monsters = getAllBestiaryEntries(bestiary);
  return monsters.find((m) => m.id === monsterId);
}

/**
 * Get all monsters sorted by XP value
 * @param {Object} bestiary - Bestiary data
 * @returns {Array} - Monsters sorted by XP (low to high)
 */
export function getMonstersByXP(bestiary) {
  if (!bestiary || !bestiary.bestiary) {
    return [];
  }

  const monsters = getAllBestiaryEntries(bestiary);
  return [...monsters].sort((a, b) => {
    return calculateMonsterXP(a) - calculateMonsterXP(b);
  });
}

/**
 * Format XP reward message for display
 * @param {Object} monster - Monster from bestiary
 * @param {number} partySize - Number of party members
 * @returns {string} - Formatted message
 */
export function formatXPReward(monster, partySize = 1) {
  const summary = getXPSummary(monster, partySize);

  if (partySize === 1) {
    return `🏆 Victory! Defeated ${summary.monsterName} for ${summary.total} XP!`;
  } else {
    return `🏆 Victory! Defeated ${summary.monsterName}! Party earned ${summary.total} XP (${summary.perMember} XP each)`;
  }
}
