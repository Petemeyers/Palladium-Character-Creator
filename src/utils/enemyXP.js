/**
 * Enemy XP System (Medieval Combat Simulator)
 *
 * Calculates and awards XP from arenaRoster combatants
 */

import { addExperience } from "./xpSystem";
import { getAllArenaRosterEntries } from "./arenaRosterUtils.js";

// ========== XP CALCULATION FROM BESTIARY ==========

/**
 * Calculate XP value for a opponent from arenaRoster
 * @param {Object} opponent - Opponent object from arenaRoster.js
 * @returns {number} - XP value
 */
export function calculateOpponentXP(opponent) {
  // If opponent has explicit XP value, use it
  if (opponent.XPValue) return opponent.XPValue;
  if (opponent.xp) return opponent.xp;
  if (opponent.experiencePoints) return opponent.experiencePoints;

  // Auto-calculate from opponent attributes
  const level = extractLevel(opponent);
  const guardRating = opponent.guardRating || 10;
  const hp = extractHP(opponent);
  const armorDurability = opponent.armorDurability || 0;

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

  // Toughness modifier (guardRating + HP + armorDurability contribute to XP)
  const toughnessBonus = Math.floor((guardRating - 10) * 10 + hp / 5 + armorDurability / 10);
  xp += toughnessBonus;

  // Category modifiers
  if (opponent.category === "greater_raider") xp *= 3;
  if (opponent.category === "lesser_raider") xp *= 1.5;
  if (opponent.category === "fallen") xp *= 1.2;
  if (opponent.category === "animal") xp *= 4;
  if (opponent.category === "combatant_of_training") xp *= 1.5;

  // Boss/Elite flags (from arenaRoster or name)
  if (
    opponent.isBoss ||
    opponent.name.includes("Lord") ||
    opponent.name.includes("King")
  ) {
    xp *= 5;
  }
  if (
    opponent.isElite ||
    opponent.name.includes("Elite") ||
    opponent.name.includes("Champion")
  ) {
    xp *= 2;
  }

  return Math.round(xp);
}

/**
 * Extract level from opponent (handles various formats)
 * @param {Object} opponent - Opponent object
 * @returns {number} - Effective level
 */
export function extractLevel(opponent) {
  if (opponent.level) return opponent.level;

  // Estimate from hit dice
  if (opponent.HP && typeof opponent.HP === "string") {
    const match = opponent.HP.match(/(\d+)d/);
    if (match) return parseInt(match[1], 10);
  }

  // Estimate from guardRating (rough approximation)
  if (opponent.guardRating >= 18) return 10;
  if (opponent.guardRating >= 16) return 8;
  if (opponent.guardRating >= 14) return 6;
  if (opponent.guardRating >= 12) return 4;
  if (opponent.guardRating >= 10) return 2;
  return 1;
}

/**
 * Extract average HP from opponent (handles dice notation)
 * @param {Object} opponent - Opponent object
 * @returns {number} - Average HP
 */
function extractHP(opponent) {
  if (typeof opponent.HP === "number") return opponent.HP;

  if (typeof opponent.HP === "string") {
    const match = opponent.HP.match(/(\d+)d(\d+)/);
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
 * @param {Object} opponent - Opponent from arenaRoster
 * @param {Array} party - Party members (optional)
 * @returns {Object|Array} - Updated character(s)
 */
export function grantXPFromEnemy(character, opponent, party = []) {
  const totalXP = calculateOpponentXP(opponent);

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
 * @param {Object} opponent - Opponent from arenaRoster
 * @param {number} partySize - Number of party members
 * @returns {Object} - XP details
 */
export function getXPSummary(opponent, partySize = 1) {
  const totalXP = calculateOpponentXP(opponent);
  const xpPerMember = Math.floor(totalXP / partySize);

  return {
    total: totalXP,
    perMember: xpPerMember,
    partySize,
    opponentName: opponent.name,
    opponentLevel: extractLevel(opponent),
  };
}

/**
 * Load opponent from arenaRoster by name
 * @param {string} opponentName - Name of opponent
 * @param {Object} arenaRoster - ArenaRoster data
 * @returns {Object|null} - Opponent object or null
 */
export function getOpponentByName(opponentName, arenaRoster) {
  if (!arenaRoster || !arenaRoster.arenaRoster) {
    return null;
  }

  const opponents = getAllArenaRosterEntries(arenaRoster);
  return opponents.find(
    (m) => m.name.toLowerCase() === opponentName.toLowerCase()
  );
}

/**
 * Load opponent from arenaRoster by ID
 * @param {string} opponentId - Opponent ID
 * @param {Object} arenaRoster - ArenaRoster data
 * @returns {Object|null} - Opponent object or null
 */
export function getOpponentById(opponentId, arenaRoster) {
  if (!arenaRoster || !arenaRoster.arenaRoster) {
    return null;
  }

  const opponents = getAllArenaRosterEntries(arenaRoster);
  return opponents.find((m) => m.id === opponentId);
}

/**
 * Get all opponents sorted by XP value
 * @param {Object} arenaRoster - ArenaRoster data
 * @returns {Array} - Opponents sorted by XP (low to high)
 */
export function getOpponentsByXP(arenaRoster) {
  if (!arenaRoster || !arenaRoster.arenaRoster) {
    return [];
  }

  const opponents = getAllArenaRosterEntries(arenaRoster);
  return [...opponents].sort((a, b) => {
    return calculateOpponentXP(a) - calculateOpponentXP(b);
  });
}

/**
 * Format XP reward message for display
 * @param {Object} opponent - Opponent from arenaRoster
 * @param {number} partySize - Number of party members
 * @returns {string} - Formatted message
 */
export function formatXPReward(opponent, partySize = 1) {
  const summary = getXPSummary(opponent, partySize);

  if (partySize === 1) {
    return `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â  Victory! Defeated ${summary.opponentName} for ${summary.total} XP!`;
  } else {
    return `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â  Victory! Defeated ${summary.opponentName}! Party earned ${summary.total} XP (${summary.perMember} XP each)`;
  }
}
