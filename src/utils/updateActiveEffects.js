/**
 * Update Active Effects System
 * Manages temporary effects, buffs, and debuffs
 * Handles effect duration, expiration, and removal
 * 
 * TODO: Implement active effects update system
 */

/**
 * Calculate fall damage based on height
 * @param {number} heightFeet - Height fallen in feet
 * @returns {number} Damage dice (e.g., 1d6 per 10ft)
 */
export function calculateFallDamage(heightFeet) {
  if (heightFeet <= 0) return 0;
  // Rough rule: 1d6 per 10ft, minimum 1d6
  const dicePer10ft = Math.max(1, Math.floor(heightFeet / 10));
  return dicePer10ft; // Returns number of d6 to roll
}

/**
 * Apply fall damage to a character
 * @param {Object} character - Character who fell
 * @param {number} heightFeet - Height fallen in feet
 * @param {Function} logCallback - Optional logging function
 * @returns {Object} Updated character with damage applied
 */
export function applyFallDamage(character, heightFeet, logCallback = null) {
  if (!character || heightFeet <= 0) return character;

  const damageDice = calculateFallDamage(heightFeet);
  // Simple fall damage: 1d6 per 10ft (can be enhanced with actual dice rolling)
  const estimatedDamage = Math.floor(damageDice * 3.5); // Average of 1d6 = 3.5

  const currentHP = character.currentHP ?? character.hp ?? character.HP ?? 0;
  const newHP = Math.max(0, currentHP - estimatedDamage);

  const updated = {
    ...character,
    currentHP: newHP,
    hp: newHP,
  };
  if (character.HP !== undefined) {
    updated.HP = newHP;
  }

  if (logCallback) {
    logCallback(
      `💥 ${character.name} takes ${estimatedDamage} damage from falling ${heightFeet}ft!`,
      "combat"
    );
  }

  return updated;
}

/**
 * Update active effects for a character
 * @param {Object} character - Character with active effects
 * @param {number} currentRound - Current melee round
 * @param {Function} logCallback - Optional logging function
 * @param {Function} applyFallDamageFn - Optional fall damage function
 * @returns {Object} Updated character with effects updated
 */
export function updateActiveEffects(character, currentRound = 1, logCallback = null, applyFallDamageFn = null) {
  if (!character) {
    return character;
  }

  const updatedCharacter = {
    ...character,
    activeEffects: character.activeEffects || [],
  };

  // Update each effect and filter expired ones
  updatedCharacter.activeEffects = updatedCharacter.activeEffects
    .map((effect) => {
      // Decrement remaining rounds if applicable
      if (effect.remainingRounds !== undefined) {
        return {
          ...effect,
          remainingRounds: Math.max(0, effect.remainingRounds - 1),
        };
      }
      // Check expiration by round number
      if (effect.expiresOn !== undefined && effect.expiresOn <= currentRound) {
        return { ...effect, expired: true };
      }
      return effect;
    })
    .filter((effect) => {
      // Remove expired effects
      if (effect.expired) {
        // Handle FLIGHT effect expiration specially
        if (effect.type === "FLIGHT") {
          const wasFlying = updatedCharacter.isFlying;
          const alt = updatedCharacter.altitudeFeet ?? 0;

          updatedCharacter.isFlying = false;
          updatedCharacter.altitudeFeet = 0;
          updatedCharacter.aiFlightState = null;

          if (wasFlying && alt > 0) {
            if (logCallback) {
              logCallback(
                `💥 ${updatedCharacter.name}'s ${effect.name || "flight"} ends and they plummet ${alt}ft to the ground!`,
                "warning"
              );
            }

            // Apply fall damage if function provided
            if (applyFallDamageFn) {
              const fallDamageFn = applyFallDamageFn || applyFallDamage;
              const afterFall = fallDamageFn(updatedCharacter, alt, logCallback);
              Object.assign(updatedCharacter, afterFall);
            }
          }
        }
        return false; // Remove expired effect
      }

      // Keep active effects
      if (effect.remainingRounds !== undefined) {
        return effect.remainingRounds > 0;
      }
      return true;
    });

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

