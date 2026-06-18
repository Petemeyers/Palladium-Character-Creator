/**
 * Level Up System
 * Handles character level progression when XP threshold is met
 */

import { calculateTotalHP } from "./levelProgression.js";
import { normalizestaminaState, createDeterministicRng } from "./techniqueUtils.js";

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

  // Calculate new HP based on PROFESSION category
  const professionCategory = character.professionCategory || character.PROFESSION?.category || "Men of Arms";
  const peBonus = character.attributes?.PE?.bonus || character.PE?.bonus || 0;
  
  updatedCharacter.hp = calculateTotalHP(professionCategory, newLevel, peBonus);
  updatedCharacter.maxHP = updatedCharacter.hp;

  // Increase skill percentages (if applicable)
  if (character.skills) {
    // Skills typically increase by 5% per level in Medieval Combat Simulator
    // This is a simplified version - actual rules vary by skill
    updatedCharacter.skills = { ...character.skills };
    // Individual skill progression would be handled by skillSystem.js
  }

  // Increase attacks per melee (if applicable)
  if (character.actionsPerRound) {
    // Some classes gain additional attacks at certain levels
    // This is simplified - actual rules vary by class
    const baseAttacks = character.baseAttacksPerMelee || character.actionsPerRound;
    updatedCharacter.actionsPerRound = baseAttacks;
  }

  // Add level up notification
  if (!updatedCharacter.levelUpHistory) {
    updatedCharacter.levelUpHistory = [];
  }
  updatedCharacter.levelUpHistory.push({
    level: newLevel,
    timestamp: new Date().toISOString(),
  });

  // Keep stamina progression deterministic and persistent on level up.
  const staminaSeed = [
    updatedCharacter.id || updatedCharacter._id || updatedCharacter.name || "character",
    "stamina-levelup",
    newLevel,
  ].join("|");
  const normalizedstamina = normalizestaminaState(updatedCharacter, {
    rollMissingLevelGains: true,
    rng: createDeterministicRng(staminaSeed),
    preserveExplicitstaminaAsAuthority: true,
  });
  updatedCharacter.stamina = normalizedstamina.stamina;
  updatedCharacter.maxstamina = normalizedstamina.maxstamina;
  updatedCharacter.currentstamina =
    character.currentstamina != null
      ? Math.min(normalizedstamina.maxstamina, character.currentstamina)
      : normalizedstamina.currentstamina;
  updatedCharacter.staminaType = normalizedstamina.staminaType;
  updatedCharacter.staminaAuthority = normalizedstamina.staminaAuthority;
  updatedCharacter.staminaProgressionModel = normalizedstamina.staminaProgressionModel;
  updatedCharacter.staminaBase = normalizedstamina.staminaBase;
  updatedCharacter.staminaLevelGainsTotal = normalizedstamina.staminaLevelGainsTotal;
  updatedCharacter.staminaLevelGainRolls = normalizedstamina.staminaLevelGainRolls;

  return updatedCharacter;
}

export default { levelUp };

