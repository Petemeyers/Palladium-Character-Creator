/**
 * Update Active Effects System
 * Manages temporary effects, buffs, and debuffs
 * Handles effect duration, expiration, and removal
 * 
 * TODO: Implement active effects update system
 */

/**
 * Update active effects for a character
 * @param {Object} character - Character with active effects
 * @param {number} timePassed - Time passed in rounds or seconds
 * @returns {Object} Updated character with effects updated
 */
export function updateActiveEffects(character, timePassed = 1) {
  // TODO: Update all active effects, reduce durations, remove expired
  if (!character) {
    return character;
  }

  const updatedCharacter = {
    ...character,
    activeEffects: character.activeEffects || [],
  };

  // TODO: Update each effect
  // updatedCharacter.activeEffects = updatedCharacter.activeEffects
  //   .map(effect => updateEffect(effect, timePassed))
  //   .filter(effect => effect.duration > 0);

  return updatedCharacter;
}

/**
 * Add active effect to character
 * @param {Object} character - Character object
 * @param {Object} effect - Effect to add
 * @returns {Object} Updated character with effect added
 */
export function addActiveEffect(character, effect) {
  // TODO: Add effect to character's active effects
  if (!character || !effect) {
    return character;
  }

  return {
    ...character,
    activeEffects: [...(character.activeEffects || []), effect],
  };
}

/**
 * Remove active effect from character
 * @param {Object} character - Character object
 * @param {string} effectId - ID of effect to remove
 * @returns {Object} Updated character with effect removed
 */
export function removeActiveEffect(character, effectId) {
  // TODO: Remove effect and clean up any stat modifications
  if (!character || !effectId) {
    return character;
  }

  const effect = (character.activeEffects || []).find((e) => e.id === effectId);
  
  // TODO: Remove stat modifications from effect
  // if (effect && effect.statMods) {
  //   Object.keys(effect.statMods).forEach(stat => {
  //     character[stat] -= effect.statMods[stat];
  //   });
  // }

  return {
    ...character,
    activeEffects: (character.activeEffects || []).filter(
      (e) => e.id !== effectId
    ),
  };
}

/**
 * Check if character has active effect
 * @param {Object} character - Character object
 * @param {string} effectName - Name of effect to check
 * @returns {boolean} True if character has the effect
 */
export function hasActiveEffect(character, effectName) {
  // TODO: Check if character has specific active effect
  if (!character || !effectName) {
    return false;
  }

  return (character.activeEffects || []).some(
    (effect) => effect.name === effectName
  );
}

/**
 * Apply initial effect to a character (used when character is created or added to combat)
 * @param {Object} character - Character object
 * @param {Object} effect - Effect to apply initially
 * @returns {void} Modifies character in place
 */
export function applyInitialEffect(character, effect) {
  if (!character || !effect) {
    return;
  }

  // Initialize activeEffects array if needed
  if (!character.activeEffects) {
    character.activeEffects = [];
  }

  // Check if effect already exists
  const existingIndex = character.activeEffects.findIndex(
    (e) => e.id === effect.id || e.name === effect.name
  );

  if (existingIndex >= 0) {
    // Update existing effect
    character.activeEffects[existingIndex] = {
      ...character.activeEffects[existingIndex],
      ...effect,
    };
  } else {
    // Add new effect
    character.activeEffects.push({
      ...effect,
      appliedAt: effect.appliedAt || Date.now(),
    });
  }

  // Apply stat modifications if present
  if (effect.statMods) {
    if (!character.bonuses) {
      character.bonuses = {};
    }
    Object.entries(effect.statMods).forEach(([stat, mod]) => {
      if (typeof mod === 'number') {
        character.bonuses[stat] = (character.bonuses[stat] || 0) + mod;
      }
    });
  }

  // Apply temporary bonuses/penalties
  if (effect.bonuses) {
    if (!character.bonuses) {
      character.bonuses = {};
    }
    Object.entries(effect.bonuses).forEach(([key, value]) => {
      if (typeof value === 'number') {
        character.bonuses[key] = (character.bonuses[key] || 0) + value;
      }
    });
  }

  if (effect.penalties) {
    if (!character.bonuses) {
      character.bonuses = {};
    }
    if (!character.bonuses.tempPenalties) {
      character.bonuses.tempPenalties = {};
    }
    Object.entries(effect.penalties).forEach(([key, value]) => {
      if (typeof value === 'number') {
        character.bonuses.tempPenalties[key] =
          (character.bonuses.tempPenalties[key] || 0) + value;
      }
    });
  }
}

export default {
  updateActiveEffects,
  addActiveEffect,
  removeActiveEffect,
  hasActiveEffect,
  applyInitialEffect,
};

