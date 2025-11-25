/**
 * XP (Experience Points) System (Palladium RPG)
 *
 * Handles experience gain, level-up triggers, and XP progression
 */

import { levelUp } from "./levelUp";

// ========== XP PROGRESSION TABLE ==========

/**
 * Get total XP required to reach a specific level
 * @param {number} level - Target level (1-10+)
 * @returns {number} - Total XP needed
 */
export function getTotalXPForLevel(level) {
  const xpTable = {
    1: 0,
    2: 2000,
    3: 4000,
    4: 8000,
    5: 16000,
    6: 32000,
    7: 64000,
    8: 128000,
    9: 256000,
    10: 512000,
    11: 1024000,
    12: 2048000,
    13: 4096000,
    14: 8192000,
    15: 16384000,
  };

  return xpTable[level] || 0;
}

/**
 * Get XP needed to reach next level from current level
 * @param {number} currentLevel - Current level
 * @returns {number} - XP needed for next level
 */
export function xpToNextLevel(currentLevel) {
  if (currentLevel >= 15) return 999999999; // Max level

  return (
    getTotalXPForLevel(currentLevel + 1) - getTotalXPForLevel(currentLevel)
  );
}

/**
 * Calculate XP progress percentage
 * @param {number} currentXP - Current XP
 * @param {number} nextLevelXP - XP needed for next level
 * @returns {number} - Percentage (0-100)
 */
export function calculateXPProgress(currentXP, nextLevelXP) {
  if (nextLevelXP === 0) return 100;
  return Math.min((currentXP / nextLevelXP) * 100, 100);
}

/**
 * Add experience to character (auto-level if threshold met)
 * @param {Object} character - Character object
 * @param {number} gainedXP - XP to add
 * @returns {Object} - Updated character (possibly leveled up)
 */
export function addExperience(character, gainedXP) {
  let currentXP = (character.XP || 0) + gainedXP;
  let currentLevel = character.level || 1;
  let nextLevelXP = xpToNextLevel(currentLevel);
  let levelsGained = 0;
  let updatedChar = { ...character };

  // Check if multiple level-ups occurred
  while (currentXP >= nextLevelXP && currentLevel < 15) {
    // Subtract XP for this level
    currentXP -= nextLevelXP;

    // Level up!
    updatedChar = levelUp(updatedChar);
    currentLevel = updatedChar.level;
    levelsGained++;

    // Get new threshold
    nextLevelXP = xpToNextLevel(currentLevel);
  }

  // Update XP and threshold
  updatedChar.XP = currentXP;
  updatedChar.nextLevelXP = nextLevelXP;

  // Add XP gain history (optional tracking)
  if (!updatedChar.xpHistory) {
    updatedChar.xpHistory = [];
  }
  updatedChar.xpHistory.push({
    gained: gainedXP,
    timestamp: new Date().toISOString(),
    levelsGained,
  });

  return updatedChar;
}

/**
 * Calculate XP award for defeating an enemy
 * @param {Object} enemy - Enemy object
 * @returns {number} - XP award
 */
export function calculateEnemyXP(enemy) {
  const enemyLevel = enemy.level || 1;
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

  let xp = baseLevelXP[enemyLevel] || 100;

  // Bonus XP for special enemy types
  if (enemy.isBoss) xp *= 5;
  if (enemy.isElite) xp *= 2;
  if (enemy.isMiniboss) xp *= 3;

  return xp;
}

/**
 * Calculate XP for completing a quest
 * @param {string} difficulty - "Easy", "Medium", "Hard", "Epic"
 * @returns {number} - XP award
 */
export function calculateQuestXP(difficulty) {
  const questXP = {
    Easy: 500,
    Medium: 1000,
    Hard: 2000,
    Epic: 5000,
    Legendary: 10000,
  };

  return questXP[difficulty] || 500;
}

/**
 * Check if character can level up
 * @param {Object} character - Character object
 * @returns {boolean} - True if XP >= nextLevelXP
 */
export function canLevelUp(character) {
  const currentXP = character.XP || 0;
  const nextLevelXP =
    character.nextLevelXP || xpToNextLevel(character.level || 1);

  return currentXP >= nextLevelXP && character.level < 15;
}

/**
 * Get XP remaining until next level
 * @param {Object} character - Character object
 * @returns {number} - XP still needed
 */
export function xpUntilNextLevel(character) {
  const currentXP = character.XP || 0;
  const nextLevelXP =
    character.nextLevelXP || xpToNextLevel(character.level || 1);

  return Math.max(0, nextLevelXP - currentXP);
}

/**
 * Format XP for display
 * @param {number} xp - XP amount
 * @returns {string} - Formatted string
 */
export function formatXP(xp) {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  } else if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * Calculate party XP split
 * @param {number} totalXP - Total XP to split
 * @param {number} partySize - Number of party members
 * @returns {number} - XP per member
 */
export function splitPartyXP(totalXP, partySize) {
  if (partySize <= 0) return 0;
  return Math.floor(totalXP / partySize);
}

/**
 * Get XP multiplier based on level difference
 * @param {number} characterLevel - Player level
 * @param {number} enemyLevel - Enemy level
 * @returns {number} - XP multiplier (0.5 to 2.0)
 */
export function getXPMultiplier(characterLevel, enemyLevel) {
  const diff = enemyLevel - characterLevel;

  if (diff >= 5) return 2.0; // Much harder enemy
  if (diff >= 3) return 1.5; // Harder enemy
  if (diff >= 1) return 1.2; // Slightly harder
  if (diff >= -1) return 1.0; // Same level
  if (diff >= -3) return 0.8; // Weaker enemy
  if (diff >= -5) return 0.5; // Much weaker
  return 0.25; // Too weak (minimal XP)
}

/**
 * Calculate XP with all modifiers
 * @param {number} baseXP - Base XP amount
 * @param {Object} modifiers - { partySize, levelDiff, isBoss, difficulty }
 * @returns {number} - Final XP
 */
export function calculateFinalXP(baseXP, modifiers = {}) {
  let finalXP = baseXP;

  // Party split
  if (modifiers.partySize) {
    finalXP = splitPartyXP(finalXP, modifiers.partySize);
  }

  // Level difference multiplier
  if (modifiers.levelDiff !== undefined) {
    finalXP *= modifiers.levelDiff;
  }

  // Boss bonus
  if (modifiers.isBoss) {
    finalXP *= 5;
  } else if (modifiers.isElite) {
    finalXP *= 2;
  }

  // Difficulty bonus
  if (modifiers.difficultyMultiplier) {
    finalXP *= modifiers.difficultyMultiplier;
  }

  return Math.floor(finalXP);
}

/**
 * Initialize XP fields on a character
 * @param {Object} character - Character object
 * @returns {Object} - Character with XP fields
 */
export function initializeXP(character) {
  const level = character.level || 1;

  return {
    ...character,
    XP: character.XP || 0,
    nextLevelXP: character.nextLevelXP || xpToNextLevel(level),
    totalXPEarned: character.totalXPEarned || 0,
    xpHistory: character.xpHistory || [],
  };
}

/**
 * Get total XP earned across all levels
 * @param {Object} character - Character object
 * @returns {number} - Total XP earned lifetime
 */
export function getTotalXPEarned(character) {
  const currentLevelTotalXP = getTotalXPForLevel(character.level || 1);
  const currentXP = character.XP || 0;

  return currentLevelTotalXP + currentXP;
}
