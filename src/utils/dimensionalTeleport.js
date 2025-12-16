/**
 * Dimensional Teleport System
 * 
 * Allows creatures with dimensional teleport ability to instantly move
 * to any location within range. Requires a skill check to succeed.
 * 
 * Based on Palladium Fantasy RPG dimensional teleport mechanics:
 * - Base skill percentage (e.g., 57%)
 * - Level bonus (e.g., +13% at level 70)
 * - Range: Typically 100-500 feet
 * - Cost: 1-2 actions
 */

import CryptoSecureDice from "./cryptoDice.js";
import { getSkillPercentage, rollSkillCheck } from "./skillSystem.js";
import { calculateDistance } from "../data/movementRules.js";

/**
 * Get the dimensional teleport skill percentage for a fighter
 * @param {Object} fighter - Fighter with dimensional teleport ability
 * @returns {number} Skill percentage (0-100)
 */
export function getDimensionalTeleportSkill(fighter) {
  if (!fighter || !fighter.abilities) return 0;
  
  const abilities = fighter.abilities;
  const teleportData = abilities.skills?.dimensionalTeleport;
  
  if (!teleportData) return 0;
  
  let skillPercent = teleportData.basePercent || 0;
  
  // Apply level bonus if fighter has reached the bonus level
  if (teleportData.levelBonus && fighter.level) {
    const fighterLevel = fighter.level || 1;
    if (fighterLevel >= teleportData.levelBonus) {
      // Calculate bonus: typically +1% per level above base, or fixed bonus
      // For Baal-Rog: 57% base, 70% at level 70 = +13% bonus
      const bonus = teleportData.levelBonus === 70 ? 13 : Math.floor(fighterLevel / 5);
      skillPercent += bonus;
    }
  }
  
  return Math.min(100, Math.max(0, skillPercent));
}

/**
 * Attempt dimensional teleport
 * @param {Object} fighter - Fighter attempting teleport
 * @param {Object} destination - Destination position {x, y} or {q, r}
 * @param {Object} currentPos - Current position {x, y} or {q, r}
 * @param {Object} options - Additional options
 * @returns {Object} Result {success, message, newPosition?, reason?}
 */
export function attemptDimensionalTeleport(fighter, destination, currentPos, options = {}) {
  const { maxRange = 500, log = console.log } = options;
  
  if (!fighter || !destination || !currentPos) {
    return {
      success: false,
      reason: "Missing required parameters",
    };
  }
  
  // Check if fighter has dimensional teleport ability
  const skillPercent = getDimensionalTeleportSkill(fighter);
  if (skillPercent === 0) {
    return {
      success: false,
      reason: `${fighter.name || "Fighter"} does not have dimensional teleport ability`,
    };
  }
  
  // Calculate distance
  const distance = calculateDistance(currentPos, destination);
  
  // Check range
  if (distance > maxRange) {
    return {
      success: false,
      reason: `Destination is ${Math.round(distance)}ft away, exceeds maximum range of ${maxRange}ft`,
    };
  }
  
  // Roll skill check
  const roll = CryptoSecureDice.roll("1d100");
  const success = roll <= skillPercent;
  
  if (success) {
    log?.(`✨ ${fighter.name} successfully teleports ${Math.round(distance)}ft! (Roll: ${roll} vs ${skillPercent}%)`, "info");
    return {
      success: true,
      message: `✨ ${fighter.name} teleports to new location!`,
      newPosition: destination,
      distance: distance,
      roll: roll,
      skillPercent: skillPercent,
    };
  } else {
    log?.(`❌ ${fighter.name} fails to teleport! (Roll: ${roll} vs ${skillPercent}%)`, "warning");
    return {
      success: false,
      reason: `Skill check failed (Roll: ${roll} vs ${skillPercent}%)`,
      roll: roll,
      skillPercent: skillPercent,
    };
  }
}

/**
 * Check if a fighter has dimensional teleport ability
 * @param {Object} fighter - Fighter to check
 * @returns {boolean} True if fighter has dimensional teleport
 */
export function hasDimensionalTeleport(fighter) {
  return getDimensionalTeleportSkill(fighter) > 0;
}

