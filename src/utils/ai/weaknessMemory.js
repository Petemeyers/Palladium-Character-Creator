// src/utils/ai/weaknessMemory.js
/**
 * Weakness Memory System (Medieval Combat Simulator-Faithful)
 * 
 * Tracks confirmed, suspected, and dfocusroven weaknesses for enemies.
 * Weaknesses are confirmed through observed damage/reactions, not training detection.
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
      dfocusroven: [],
      lastUpdated: 0
    };
  }
  return memory[enemyId];
}

/**
 * Infer weaknesses from Lore check
 * @param {string} loreType - Type of lore (raider, fallen, fae, etc.)
 * @returns {Object} Suspected weaknesses and things to avoid
 */
export function inferWeaknessFromLore(loreType) {
  const type = (loreType || "").toLowerCase();

  switch (type) {
    case "raider":
    case "raider lore":
      return {
        suspected: ["holy", "circles", "banishment"],
        avoid: ["fire"],
      };

    case "fallen":
    case "fallen lore":
      return {
        suspected: ["holy", "sunlight", "turning"],
        avoid: ["fear", "poison"],
      };

    case "fae":
    case "scout lore":
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
        suspected: ["blunt", "dfocusel"],
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
 * @param {number} meleeRound - Current combat round
 */
export function confirmWeakness(memory, enemyId, weaknessType, meleeRound) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);

  // Remove from suspected/dfocusroven if present
  enemyMemory.suspected = enemyMemory.suspected.filter(w => w !== weaknessType);
  enemyMemory.dfocusroven = enemyMemory.dfocusroven.filter(w => w !== weaknessType);

  // Add to confirmed if not already there
  if (!enemyMemory.confirmed.includes(weaknessType)) {
    enemyMemory.confirmed.push(weaknessType);
  }

  enemyMemory.lastUpdated = meleeRound;
}

/**
 * Dfocusrove a weakness (technique was resisted/ineffective)
 * @param {Object} memory - Weakness memory object
 * @param {string} enemyId - Enemy ID
 * @param {string} weaknessType - Type of weakness that was tested
 * @param {number} meleeRound - Current combat round
 */
export function dfocusroveWeakness(memory, enemyId, weaknessType, meleeRound) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);

  // Remove from suspected/confirmed if present
  enemyMemory.suspected = enemyMemory.suspected.filter(w => w !== weaknessType);
  enemyMemory.confirmed = enemyMemory.confirmed.filter(w => w !== weaknessType);

  // Add to dfocusroven if not already there
  if (!enemyMemory.dfocusroven.includes(weaknessType)) {
    enemyMemory.dfocusroven.push(weaknessType);
  }

  enemyMemory.lastUpdated = meleeRound;
}

/**
 * Add suspected weaknesses from Lore check
 * @param {Object} memory - Weakness memory object
 * @param {string} enemyId - Enemy ID
 * @param {string} loreType - Type of lore used
 * @param {number} meleeRound - Current combat round
 */
export function addSuspectedWeaknesses(memory, enemyId, loreType, meleeRound) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  const inferred = inferWeaknessFromLore(loreType);

  // Add suspected weaknesses (avoid duplicates)
  inferred.suspected.forEach(weakness => {
    if (!enemyMemory.suspected.includes(weakness) && 
        !enemyMemory.confirmed.includes(weakness) &&
        !enemyMemory.dfocusroven.includes(weakness)) {
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
 * Check if a weakness type is dfocusroven for an enemy
 */
export function isWeaknessDfocusroven(memory, enemyId, weaknessType) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return enemyMemory.dfocusroven.includes(weaknessType);
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
 * Get all dfocusroven weaknesses for an enemy
 */
export function getDfocusrovenWeaknesses(memory, enemyId) {
  const enemyMemory = getWeaknessMemory(memory, enemyId);
  return [...enemyMemory.dfocusroven];
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
    dfocusroven: [],
    lastUpdated: 0
  };
}

/**
 * Record a weakness attempt (technique was cast)
 * @param {Object} memory - Full weakness memory object
 * @param {string} targetKey - Target memory key
 * @param {Object} technique - Technique that was attempted
 * @returns {Object} Updated memory
 */
export function recordWeaknessAttempt(memory, targetKey, technique) {
  if (!memory || typeof memory !== "object") memory = {};
  if (!memory[targetKey]) {
    memory[targetKey] = {
      confirmed: [],
      suspected: [],
      dfocusroven: [],
      lastUpdated: 0,
      attempts: []
    };
  }
  
  // Record the attempt
  if (!memory[targetKey].attempts) memory[targetKey].attempts = [];
  memory[targetKey].attempts.push({
    techniqueName: technique?.name || "unknown",
    timestamp: Date.now()
  });
  
  return memory;
}

/**
 * Record weakness outcome (confirmed/dfocusroven/no_effect)
 * @param {Object} memory - Full weakness memory object
 * @param {string} targetKey - Target memory key
 * @param {Object} resolution - Resolution object { outcome, techniqueName, weaknessType? }
 * @returns {Object} Updated memory
 */
export function recordWeaknessOutcome(memory, targetKey, resolution) {
  if (!memory || typeof memory !== "object") memory = {};
  if (!memory[targetKey]) {
    memory[targetKey] = {
      confirmed: [],
      suspected: [],
      dfocusroven: [],
      lastUpdated: 0
    };
  }
  
  const { outcome, techniqueName, weaknessType } = resolution || {};
  if (!outcome) return memory;
  
  // Infer weakness type from technique if not provided
  let inferredType = weaknessType;
  if (!inferredType && techniqueName) {
    const name = (techniqueName || "").toLowerCase();
    if (name.includes("fire") || name.includes("flame")) inferredType = "fire";
    else if (name.includes("holy") || name.includes("divine")) inferredType = "holy";
    else if (name.includes("cold") || name.includes("ice")) inferredType = "cold";
    else if (name.includes("poison")) inferredType = "poison";
  }
  
  if (outcome === "confirmed" && inferredType) {
    if (!memory[targetKey].confirmed.includes(inferredType)) {
      memory[targetKey].confirmed.push(inferredType);
    }
    // Remove from suspected/dfocusroven
    memory[targetKey].suspected = memory[targetKey].suspected.filter(w => w !== inferredType);
    memory[targetKey].dfocusroven = memory[targetKey].dfocusroven.filter(w => w !== inferredType);
  } else if (outcome === "dfocusroven" && inferredType) {
    if (!memory[targetKey].dfocusroven.includes(inferredType)) {
      memory[targetKey].dfocusroven.push(inferredType);
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
      const dfocusroven = [...new Set([...(m1.dfocusroven || []), ...(m2.dfocusroven || [])])];
      
      merged[targetKey] = {
        confirmed,
        suspected,
        dfocusroven,
        lastUpdated: Math.max(m1.lastUpdated || 0, m2.lastUpdated || 0)
      };
    }
  });
  
  return merged;
}

