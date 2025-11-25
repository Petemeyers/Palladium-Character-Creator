/**
 * Level Progression System
 * Handles character leveling, experience points, and stat progression
 * Calculates HP, skill bonuses, and other level-based improvements
 *
 * TODO: Implement level progression system
 */

/**
 * Calculate total HP based on level and O.C.C. category
 * @param {string} occCategory - O.C.C. category (Men of Arms, Men of Magic, etc.)
 * @param {number} level - Character level
 * @param {number} peBonus - Physical Endurance bonus
 * @returns {number} Total hit points
 */
export function calculateTotalHP(
  occCategory = "Men of Arms",
  level = 1,
  peBonus = 0
) {
  // TODO: Implement HP calculation based on Palladium rules
  // Different O.C.C. categories have different HP per level

  const baseHP = 20; // Default base HP
  const hpPerLevel = getHPPerLevel(occCategory);

  return baseHP + (level - 1) * hpPerLevel + peBonus;
}

/**
 * Get HP per level based on O.C.C. category
 * @param {string} occCategory - O.C.C. category
 * @returns {number} HP gained per level
 */
function getHPPerLevel(occCategory) {
  // TODO: Return appropriate HP per level based on category
  const hpTable = {
    "Men of Arms": 10,
    "Men of Magic": 4,
    Clergy: 6,
    Optional: 8,
  };

  return hpTable[occCategory] || 8;
}

/**
 * Calculate experience points needed for next level
 * @param {number} currentLevel - Current character level
 * @returns {number} Experience points required
 */
export function getXPForNextLevel(currentLevel = 1) {
  // TODO: Implement XP calculation
  // Palladium Fantasy uses different XP tables per O.C.C.
  return currentLevel * 1000; // Placeholder
}

/**
 * Calculate level from total experience
 * @param {number} totalXP - Total experience points
 * @param {string} occCategory - O.C.C. category
 * @returns {number} Character level
 */
export function calculateLevelFromXP(totalXP = 0, occCategory = "Men of Arms") {
  // TODO: Calculate level based on XP and O.C.C. category
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
  // Many skills gain +5% per level in Palladium
  return (level - 1) * 5; // Placeholder: +5% per level
}

/**
 * Get stats for a specific level
 * @param {number} level - Character level
 * @param {string} occCategory - O.C.C. category
 * @returns {Object} Stats for the level (HP, bonuses, etc.)
 */
export function getStatsForLevel(level = 1, occCategory = "Men of Arms") {
  const hpPerLevel = getHPPerLevel(occCategory);
  const baseHP = 20;
  const totalHP = baseHP + (level - 1) * hpPerLevel;
  
  return {
    level,
    occCategory,
    hpPerLevel,
    totalHP,
    skillBonus: (level - 1) * 5, // +5% per level for most skills
    xpForNextLevel: getXPForNextLevel(level),
  };
}

export default {
  calculateTotalHP,
  getXPForNextLevel,
  calculateLevelFromXP,
  getSkillBonus,
};
