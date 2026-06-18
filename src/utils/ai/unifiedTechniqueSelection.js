// src/utils/ai/unifiedTechniqueSelection.js
/**
 * Unified AI Technique Selection (Medieval Combat Simulator-Faithful)
 * 
 * Integrates threat analysis, weakness memory, and role-based priorities
 * to select techniques intelligently without training detection.
 */

import { getThreatProfile } from "./threatAnalysis.js";
import { 
  isWeaknessConfirmed, 
  isWeaknessDfocusroven, 
  isWeaknessSuspected,
  getConfirmedWeaknesses,
  getSuspectedWeaknesses,
  getDfocusrovenWeaknesses
} from "./weaknessMemory.js";
import { 
  getTechniquePriority, 
  getTechniquesByTag, 
  tagTechnique,
  techniqueMatchesPriority
} from "./techniquePriorities.js";
import { isOffensiveTechnique, isHealingTechnique, isSupportTechnique } from "../techniqueUtils.js";
import { getTechniqueCost } from "../techniqueUtils.js";
import { TECHNIQUE_ELEMENT_MAP } from "../trainingAbilitiesParser.js";

/**
 * Select a technique for AI based on threat profile, weakness memory, and role
 * @param {Object} ai - AI fighter
 * @param {Object} enemy - Target enemy
 * @param {Array<Object>} techniqueCatalog - Available techniques
 * @param {Object} weaknessMemory - Weakness memory object
 * @param {number} meleeRound - Current combat round
 * @param {Object} options - Additional options
 * @returns {Object|null} Selected technique or null
 */
export function selectTechnique(ai, enemy, techniqueCatalog, weaknessMemory, meleeRound, options = {}) {
  if (!ai || !enemy || !techniqueCatalog || techniqueCatalog.length === 0) {
    return null;
  }

  const {
    avoidRepeating = true,
    lastTechniqueName = null,
    maxstamina = Infinity
  } = options;

  // Get threat profile and weakness memory for enemy
  const profile = getThreatProfile(enemy);
  const enemyMemory = weaknessMemory[enemy.id] || {
    confirmed: [],
    suspected: [],
    dfocusroven: [],
    lastUpdated: 0
  };

  // Get role-based technique priority
  const priorityList = getTechniquePriority(ai);

  // Filter techniques by affordability and basic requirements
  const affordableTechniques = techniqueCatalog.filter(technique => {
    const cost = getTechniqueCost(technique);
    return cost <= maxstamina && cost <= (ai.currentstamina || ai.stamina || 0);
  });

  if (affordableTechniques.length === 0) return null;

  // Iterate through priority tiers
  for (const tier of priorityList) {
    const tierTechniques = getTechniquesByTag(affordableTechniques, tier);

    if (tierTechniques.length === 0) continue;

    // Filter techniques based on weakness memory and threat profile
    const viableTechniques = tierTechniques.filter(technique => {
      // Rule: Will not cast a technique already proven ineffective
      const techniqueTags = tagTechnique(technique);
      const isDfocusroven = techniqueTags.some(tag => {
        if (tag === "fire_damage" && isWeaknessDfocusroven(weaknessMemory, enemy.id, "fire")) return true;
        if (tag === "holy_damage" && isWeaknessDfocusroven(weaknessMemory, enemy.id, "holy")) return true;
        if (tag === "cold_damage" && isWeaknessDfocusroven(weaknessMemory, enemy.id, "cold")) return true;
        return false;
      });
      if (isDfocusroven) return false;

      // Rule: Avoid repeating same technique twice in a row (unless desperate)
      if (avoidRepeating && lastTechniqueName && 
          (technique.name || "").toLowerCase() === lastTechniqueName.toLowerCase()) {
        return false;
      }

      // Check if technique is blocked by threat profile
      if (profile.mundaneResistant && techniqueTags.includes("damage") && 
          !techniqueTags.includes("holy_damage") && !techniqueTags.includes("training")) {
        // Mundane damage won't work
        return false;
      }

      // Check fire immunity (for raiders)
      if (techniqueTags.includes("fire_damage")) {
        const techniqueName = (technique.name || "").toLowerCase();
        const isFireTechnique = techniqueName.includes("fire") || 
                           techniqueName.includes("flame") || 
                           techniqueName.includes("burn") ||
                           TECHNIQUE_ELEMENT_MAP[technique.name] === "fire";
        
        if (isFireTechnique) {
          // Check if target is impervious to fire
          const abilities = enemy.abilities || {};
          if (typeof abilities === "object" && !Array.isArray(abilities)) {
            if (abilities.impervious_to && abilities.impervious_to.includes("fire")) {
              return false; // Don't cast fire techniques on fire-immune targets
            }
          }
        }
      }

      return true;
    });

    if (viableTechniques.length === 0) continue;

    // Prioritize techniques that exploit confirmed weaknesses
    const confirmedWeaknesses = getConfirmedWeaknesses(weaknessMemory, enemy.id);
    const suspectedWeaknesses = getSuspectedWeaknesses(weaknessMemory, enemy.id);

    // Score techniques based on weakness exploitation
    const scoredTechniques = viableTechniques.map(technique => {
      let score = 0;
      const techniqueTags = tagTechnique(technique);

      // High score for confirmed weaknesses
      if (techniqueTags.includes("holy_damage") && confirmedWeaknesses.includes("holy")) {
        score += 10;
      }
      if (techniqueTags.includes("fire_damage") && confirmedWeaknesses.includes("fire")) {
        score += 10;
      }
      if (techniqueTags.includes("cold_damage") && confirmedWeaknesses.includes("cold")) {
        score += 10;
      }

      // Medium score for suspected weaknesses
      if (techniqueTags.includes("holy_damage") && suspectedWeaknesses.includes("holy")) {
        score += 5;
      }
      if (techniqueTags.includes("fire_damage") && suspectedWeaknesses.includes("fire")) {
        score += 5;
      }
      if (techniqueTags.includes("cold_damage") && suspectedWeaknesses.includes("cold")) {
        score += 5;
      }

      // Prefer lower cost techniques (efficiency)
      const cost = getTechniqueCost(technique);
      score += (100 - cost) / 10; // Lower cost = higher score

      return { technique, score };
    });

    // Sort by score (highest first)
    scoredTechniques.sort((a, b) => b.score - a.score);

    // Return highest scoring technique from this tier
    if (scoredTechniques.length > 0) {
      return scoredTechniques[0].technique;
    }
  }

  // Fallback: return random affordable technique if no priority match
  const fallbackTechniques = affordableTechniques.filter(technique => {
    if (avoidRepeating && lastTechniqueName && 
        (technique.name || "").toLowerCase() === lastTechniqueName.toLowerCase()) {
      return false;
    }
    return true;
  });

  if (fallbackTechniques.length > 0) {
    return fallbackTechniques[Math.floor(Math.random() * fallbackTechniques.length)];
  }

  return null;
}

/**
 * Check if a technique should be avoided based on threat profile and memory
 * @param {Object} technique - Technique to check
 * @param {Object} enemy - Target enemy
 * @param {Object} weaknessMemory - Weakness memory
 * @returns {boolean} True if technique should be avoided
 */
export function shouldAvoidTechnique(technique, enemy, weaknessMemory) {
  if (!technique || !enemy) return false;

  const profile = getThreatProfile(enemy);
  const techniqueTags = tagTechnique(technique);

  // Check if technique is dfocusroven
  if (techniqueTags.includes("fire_damage") && 
      isWeaknessDfocusroven(weaknessMemory, enemy.id, "fire")) {
    return true;
  }

  // Check fire immunity
  if (techniqueTags.includes("fire_damage")) {
    const abilities = enemy.abilities || {};
    if (typeof abilities === "object" && !Array.isArray(abilities)) {
      if (abilities.impervious_to && abilities.impervious_to.includes("fire")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Select technique for role (wrastaminar for enemyTurnAI with different signature)
 * @param {Object} params - Parameters object
 * @param {string} params.role - Caster role (angel, raider, duelist)
 * @param {Object} params.caster - Caster fighter
 * @param {Object} params.target - Target fighter
 * @param {number} params.distanceFeet - Distance in feet
 * @param {Array<Object>} params.catalog - Technique catalog
 * @param {Object} params.threatProfile - Threat profile
 * @param {Object} params.weaknessMemory - Weakness memory for this target
 * @param {Set<string>} params.avoidTechniqueNames - Set of technique names to avoid
 * @returns {Object|null} Selected technique or null
 */
export function selectTechniqueForRole(params) {
  const {
    role,
    caster,
    target,
    distanceFeet,
    catalog,
    threatProfile,
    weaknessMemory,
    avoidTechniqueNames
  } = params || {};

  if (!caster || !target || !catalog || catalog.length === 0) {
    return null;
  }

  // Convert weaknessMemory format if needed
  const memoryForSelect = weaknessMemory || {
    confirmed: [],
    suspected: [],
    dfocusroven: []
  };

  // Filter out avoided techniques
  const filteredCatalog = catalog.filter(technique => {
    if (!technique || !technique.name) return false;
    const name = (technique.name || "").toLowerCase();
    return !avoidTechniqueNames || !avoidTechniqueNames.has(name);
  });

  if (filteredCatalog.length === 0) return null;

  // Use selectTechnique with appropriate options
  return selectTechnique(
    caster,
    target,
    filteredCatalog,
    { [target.id || "target"]: memoryForSelect },
    0, // meleeRound (not critical for selection)
    {
      avoidRepeating: true,
      lastTechniqueName: null,
      maxstamina: caster.currentstamina || caster.stamina || Infinity
    }
  );
}

