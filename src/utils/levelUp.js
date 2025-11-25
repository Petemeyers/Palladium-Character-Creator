/**
 * Level Up System
 * Handles character level progression when XP threshold is met
 */

import { calculateTotalHP } from "./levelProgression.js";

/**
 * Level up a character
 * @param {Object} character - Character object
 * @returns {Object} - Updated character with new level and improved stats
 */
export function levelUp(character) {
  const currentLevel = character.level || 1;
  const newLevel = currentLevel + 1;

  // Create updated character
  const updatedCharacter = {
    ...character,
    level: newLevel,
  };

  // Calculate new HP based on OCC category
  const occCategory = character.occCategory || character.OCC?.category || "Men of Arms";
  const peBonus = character.attributes?.PE?.bonus || character.PE?.bonus || 0;
  
  updatedCharacter.hp = calculateTotalHP(occCategory, newLevel, peBonus);
  updatedCharacter.maxHP = updatedCharacter.hp;

  // Increase skill percentages (if applicable)
  if (character.skills) {
    // Skills typically increase by 5% per level in Palladium
    // This is a simplified version - actual rules vary by skill
    updatedCharacter.skills = { ...character.skills };
    // Individual skill progression would be handled by skillSystem.js
  }

  // Increase attacks per melee (if applicable)
  if (character.attacksPerMelee) {
    // Some classes gain additional attacks at certain levels
    // This is simplified - actual rules vary by class
    const baseAttacks = character.baseAttacksPerMelee || character.attacksPerMelee;
    updatedCharacter.attacksPerMelee = baseAttacks;
  }

  // Add level up notification
  if (!updatedCharacter.levelUpHistory) {
    updatedCharacter.levelUpHistory = [];
  }
  updatedCharacter.levelUpHistory.push({
    level: newLevel,
    timestamp: new Date().toISOString(),
  });

  return updatedCharacter;
}

export default { levelUp };

