/**
 * Level Progression System
 * Handles character leveling, experience points, and stat progression
 * Calculates HP, skill bonuses, and other level-based improvements
 *
 * TODO: Implement level progression system
 */

/**
 * Calculate total HP based on level and profession category
 * @param {string} occCategory - profession category (Men of Arms, Men of Training, etc.)
 * @param {number} level - Character level
 * @param {number} peBonus - Physical Endurance bonus
 * @returns {number} Total hit points
 */
export function calculateTotalHP(
  occCategory = "Men of Arms",
  level = 1,
  peBonus = 0
) {
  // TODO: Implement HP calculation based on Medieval Combat Simulator rules
  // Different profession categories have different HP per level

  const baseHP = 20; // Default base HP
  const hpPerLevel = getHPPerLevel(occCategory);

  return baseHP + (level - 1) * hpPerLevel + peBonus;
}

/**
 * Get HP per level based on profession category
 * @param {string} occCategory - profession category
 * @returns {number} HP gained per level
 */
function getHPPerLevel(professionCategory = "Men of Arms", hpPerLevelOverride) {
  // TODO: Return appropriate HP per level based on category
  const hpTable = {
    "Men of Arms": 10,
    "Men of Training": 4,
    Clergy: 6,
    Optional: 8,
  };

  const fallback = hpTable[professionCategory] || 8;
  return hpPerLevelOverride === undefined || hpPerLevelOverride === null
    ? fallback
    : getAverageDiceRoll(hpPerLevelOverride, fallback);
}

function resolveProfessionProgression(professionOrCategory) {
  if (professionOrCategory && typeof professionOrCategory === "object" && !Array.isArray(professionOrCategory)) {
    const category = String(
      professionOrCategory.category || professionOrCategory.professionCategory || "Men of Arms"
    ).trim() || "Men of Arms";
    return {
      category,
      hpPerLevel: professionOrCategory.hpPerLevel ?? professionOrCategory.progression?.hpPerLevel,
    };
  }

  const category = typeof professionOrCategory === "string"
    ? professionOrCategory.trim()
    : "";
  return { category: category || "Men of Arms", hpPerLevel: undefined };
}

/**
 * Calculate experience points needed for next level
 * @param {number} currentLevel - Current character level
 * @returns {number} Experience points required
 */
export function getXPForNextLevel(currentLevel = 1) {
  // TODO: Implement XP calculation
  // Medieval Combat Simulator uses different XP tables per profession
  return currentLevel * 1000; // Placeholder
}

/**
 * Calculate level from total experience
 * @param {number} totalXP - Total experience points
 * @param {string} occCategory - profession category
 * @returns {number} Character level
 */
export function calculateLevelFromXP(totalXP = 0, occCategory = "Men of Arms") {
  // TODO: Calculate level based on XP and profession category
  let level = 1;
  let xpNeeded = 0;

  while (xpNeeded < totalXP) {
    level++;
    xpNeeded += getXPForNextLevel(level - 1);
  }

  return Math.max(1, level - 1);
}

/**
 * Get skill bonuses for level
 * @param {number} level - Character level
 * @param {string} skillName - Name of skill
 * @returns {number} Skill bonus
 */
export function getSkillBonus(level = 1, skillName = "") {
  // TODO: Calculate skill bonuses based on level
  // Many skills gain +5% per level in Medieval Combat Simulator
  return (level - 1) * 5; // Placeholder: +5% per level
}

/**
 * Get stats for a specific level
 * @param {number} level - Character level
 * @param {string} occCategory - profession category
 * @returns {Object} Stats for the level (HP, bonuses, etc.)
 */
export function getStatsForLevel(level = 1, professionOrCategory = "Men of Arms") {
  const normalizedLevel = Math.max(1, Number.parseInt(level, 10) || 1);
  const progression = resolveProfessionProgression(professionOrCategory);
  const hpPerLevel = getHPPerLevel(progression.category, progression.hpPerLevel);
  const baseHP = 20;
  const totalHP = baseHP + (normalizedLevel - 1) * hpPerLevel;
  
  return {
    level: normalizedLevel,
    occCategory: progression.category,
    hpPerLevel,
    totalHP,
    skillBonus: (normalizedLevel - 1) * 5, // +5% per level for most skills
    xpForNextLevel: getXPForNextLevel(normalizedLevel),
  };
}

export default {
  calculateTotalHP,
  getXPForNextLevel,
  calculateLevelFromXP,
  getSkillBonus,
  getStatsForLevel,
};
import { getAverageDiceRoll } from "./diceExpression.js";
