// src/utils/ai/weaknessMemory.js
/**
 * Weakness Memory System (Palladium-Faithful)
 * 
 * Tracks confirmed, suspected, and disproven weaknesses for enemies.
 * Weaknesses are confirmed through observed damage/reactions, not magic detection.
 */

/**
 * Initialize weakness memory for an AI fighter
 */
export function createWeaknessMemory() {
  return {};
}

/**
 * Get weakness memory for a specific enemy
 */
export function getWeaknessMemory(memory, enemyId) {
  if (!memory[enemyId]) {
    memory[enemyId] = {
      confirmed: [],
      suspected: [],
      disproven: [],
      lastUpdated: 0
    };
  }
  return memory[enemyId];
}

/**
 * Infer weaknesses from Lore check
 * @param {string} loreType - Type of lore (demon, undead, fae, etc.)
 * @returns {Object} Suspected weaknesses and things to avoid
 */
export function inferWeaknessFromLore(loreType) {
  const type = (loreType || "").toLowerCase();

  switch (type) {
    case "demon":
    case "demon lore":
      return {
        suspected: ["holy", "circles", "banishment"],
        avoid: ["fire"],
      };

    case "undead":
    case "undead lore":
      return {
        suspected: ["holy", "sunlight", "turning"],
        avoid: ["fear", "poison"],
      };

    case "fae":
    case "faerie lore":
      return {
        suspected: ["cold iron", "iron"],
        avoid: ["charm", "illusion"],
      };

    case "werebeast":
    case "lycanthrope":
      return {
        suspected: ["silver"],
        avoid: [],
      };

    case "vampire":
      return {
        suspected: ["holy", "sunlight", "silver", "stake"],
        avoid: ["fear", "charm"],
      };

    case "construct":
    case "golem":
      return {
        suspected: ["blunt", "dispel"],
        avoid: ["poison", "fear"],
      };

    default:
      return {
        suspected: [],
        avoid: [],
      };
  }
}

/**
 * Confirm a weakness based on observed damage/reaction
 * @param {Object} memory - Weakness memory object
 * @param {string} enemyId - Enemy ID
 * @param {string} weaknessType - Type of weakness (holy, fire, silver, etc.)
 * @param {number} meleeRound - Current melee round
 */
export function confirmWeakness(memory, enemyId, weaknessType, meleeRound) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);

  // Remove from suspected/disproven if present
  enemyMemory.suspected = enemyMemory.suspected.filter(w => w !== weaknessType);
  enemyMemory.disproven = enemyMemory.disproven.filter(w => w !== weaknessType);

  // Add to confirmed if not already there
  if (!enemyMemory.confirmed.includes(weaknessType)) {
    enemyMemory.confirmed.push(weaknessType);
  }

  enemyMemory.lastUpdated = meleeRound;
}

/**
 * Disprove a weakness (spell was resisted/ineffective)
 * @param {Object} memory - Weakness memory object
 * @param {string} enemyId - Enemy ID
 * @param {string} weaknessType - Type of weakness that was tested
 * @param {number} meleeRound - Current melee round
 */
export function disproveWeakness(memory, enemyId, weaknessType, meleeRound) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);

  // Remove from suspected/confirmed if present
  enemyMemory.suspected = enemyMemory.suspected.filter(w => w !== weaknessType);
  enemyMemory.confirmed = enemyMemory.confirmed.filter(w => w !== weaknessType);

  // Add to disproven if not already there
  if (!enemyMemory.disproven.includes(weaknessType)) {
    enemyMemory.disproven.push(weaknessType);
  }

  enemyMemory.lastUpdated = meleeRound;
}

/**
 * Add suspected weaknesses from Lore check
 * @param {Object} memory - Weakness memory object
 * @param {string} enemyId - Enemy ID
 * @param {string} loreType - Type of lore used
 * @param {number} meleeRound - Current melee round
 */
export function addSuspectedWeaknesses(memory, enemyId, loreType, meleeRound) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  const inferred = inferWeaknessFromLore(loreType);

  // Add suspected weaknesses (avoid duplicates)
  inferred.suspected.forEach(weakness => {
    if (!enemyMemory.suspected.includes(weakness) && 
        !enemyMemory.confirmed.includes(weakness) &&
        !enemyMemory.disproven.includes(weakness)) {
      enemyMemory.suspected.push(weakness);
    }
  });

  enemyMemory.lastUpdated = meleeRound;
}

/**
 * Check if a weakness type is confirmed for an enemy
 */
export function isWeaknessConfirmed(memory, enemyId, weaknessType) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return enemyMemory.confirmed.includes(weaknessType);
}

/**
 * Check if a weakness type is disproven for an enemy
 */
export function isWeaknessDisproven(memory, enemyId, weaknessType) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return enemyMemory.disproven.includes(weaknessType);
}

/**
 * Check if a weakness type is suspected for an enemy
 */
export function isWeaknessSuspected(memory, enemyId, weaknessType) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return enemyMemory.suspected.includes(weaknessType);
}

/**
 * Get all confirmed weaknesses for an enemy
 */
export function getConfirmedWeaknesses(memory, enemyId) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return [...enemyMemory.confirmed];
}

/**
 * Get all suspected weaknesses for an enemy
 */
export function getSuspectedWeaknesses(memory, enemyId) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return [...enemyMemory.suspected];
}

/**
 * Get all disproven weaknesses for an enemy
 */
export function getDisprovenWeaknesses(memory, enemyId) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return [...enemyMemory.disproven];
}

/**
 * Get weakness memory for a specific target (used by enemyTurnAI)
 * @param {Object} memory - Full weakness memory object (keyed by target)
 * @param {string} targetKey - Target memory key
 * @returns {Object} Weakness memory for that target
 */
export function getWeaknessMemoryForEnemy(memory, targetKey) {
  if (!memory || typeof memory !== "object") return {};
  return memory[targetKey] || {
    confirmed: [],
    suspected: [],
    disproven: [],
    lastUpdated: 0
  };
}

/**
 * Record a weakness attempt (spell was cast)
 * @param {Object} memory - Full weakness memory object
 * @param {string} targetKey - Target memory key
 * @param {Object} spell - Spell that was attempted
 * @returns {Object} Updated memory
 */
export function recordWeaknessAttempt(memory, targetKey, spell) {
  if (!memory || typeof memory !== "object") memory = {};
  if (!memory[targetKey]) {
    memory[targetKey] = {
      confirmed: [],
      suspected: [],
      disproven: [],
      lastUpdated: 0,
      attempts: []
    };
  }
  
  // Record the attempt
  if (!memory[targetKey].attempts) memory[targetKey].attempts = [];
  memory[targetKey].attempts.push({
    spellName: spell?.name || "unknown",
    timestamp: Date.now()
  });
  
  return memory;
}

/**
 * Record weakness outcome (confirmed/disproven/no_effect)
 * @param {Object} memory - Full weakness memory object
 * @param {string} targetKey - Target memory key
 * @param {Object} resolution - Resolution object { outcome, spellName, weaknessType? }
 * @returns {Object} Updated memory
 */
export function recordWeaknessOutcome(memory, targetKey, resolution) {
  if (!memory || typeof memory !== "object") memory = {};
  if (!memory[targetKey]) {
    memory[targetKey] = {
      confirmed: [],
      suspected: [],
      disproven: [],
      lastUpdated: 0
    };
  }
  
  const { outcome, spellName, weaknessType } = resolution || {};
  if (!outcome) return memory;
  
  // Infer weakness type from spell if not provided
  let inferredType = weaknessType;
  if (!inferredType && spellName) {
    const name = (spellName || "").toLowerCase();
    if (name.includes("fire") || name.includes("flame")) inferredType = "fire";
    else if (name.includes("holy") || name.includes("divine")) inferredType = "holy";
    else if (name.includes("cold") || name.includes("ice")) inferredType = "cold";
    else if (name.includes("poison")) inferredType = "poison";
  }
  
  if (outcome === "confirmed" && inferredType) {
    if (!memory[targetKey].confirmed.includes(inferredType)) {
      memory[targetKey].confirmed.push(inferredType);
    }
    // Remove from suspected/disproven
    memory[targetKey].suspected = memory[targetKey].suspected.filter(w => w !== inferredType);
    memory[targetKey].disproven = memory[targetKey].disproven.filter(w => w !== inferredType);
  } else if (outcome === "disproven" && inferredType) {
    if (!memory[targetKey].disproven.includes(inferredType)) {
      memory[targetKey].disproven.push(inferredType);
    }
    // Remove from suspected/confirmed
    memory[targetKey].suspected = memory[targetKey].suspected.filter(w => w !== inferredType);
    memory[targetKey].confirmed = memory[targetKey].confirmed.filter(w => w !== inferredType);
  }
  
  memory[targetKey].lastUpdated = Date.now();
  return memory;
}

/**
 * Merge two weakness memory objects
 * @param {Object} memory1 - First memory object
 * @param {Object} memory2 - Second memory object
 * @returns {Object} Merged memory
 */
export function mergeWeaknessMemory(memory1, memory2) {
  if (!memory1 || typeof memory1 !== "object") memory1 = {};
  if (!memory2 || typeof memory2 !== "object") memory2 = {};
  
  const merged = { ...memory1 };
  
  Object.keys(memory2).forEach(targetKey => {
    if (!merged[targetKey]) {
      merged[targetKey] = { ...memory2[targetKey] };
    } else {
      // Merge arrays (union, no duplicates)
      const m1 = merged[targetKey];
      const m2 = memory2[targetKey];
      
      const confirmed = [...new Set([...(m1.confirmed || []), ...(m2.confirmed || [])])];
      const suspected = [...new Set([...(m1.suspected || []), ...(m2.suspected || [])])];
      const disproven = [...new Set([...(m1.disproven || []), ...(m2.disproven || [])])];
      
      merged[targetKey] = {
        confirmed,
        suspected,
        disproven,
        lastUpdated: Math.max(m1.lastUpdated || 0, m2.lastUpdated || 0)
      };
    }
  });
  
  return merged;
}

