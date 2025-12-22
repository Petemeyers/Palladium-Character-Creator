// src/utils/ai/unifiedSpellSelection.js
/**
 * Unified AI Spell Selection (Palladium-Faithful)
 * 
 * Integrates threat analysis, weakness memory, and role-based priorities
 * to select spells intelligently without magic detection.
 */

import { getThreatProfile } from "./threatAnalysis.js";
import { 
  isWeaknessConfirmed, 
  isWeaknessDisproven, 
  isWeaknessSuspected,
  getConfirmedWeaknesses,
  getSuspectedWeaknesses,
  getDisprovenWeaknesses
} from "./weaknessMemory.js";
import { 
  getSpellPriority, 
  getSpellsByTag, 
  tagSpell,
  spellMatchesPriority
} from "./spellPriorities.js";
import { isOffensiveSpell, isHealingSpell, isSupportSpell } from "../spellUtils.js";
import { getSpellCost } from "../spellUtils.js";
import { SPELL_ELEMENT_MAP } from "../magicAbilitiesParser.js";

/**
 * Select a spell for AI based on threat profile, weakness memory, and role
 * @param {Object} ai - AI fighter
 * @param {Object} enemy - Target enemy
 * @param {Array<Object>} spellCatalog - Available spells
 * @param {Object} weaknessMemory - Weakness memory object
 * @param {number} meleeRound - Current melee round
 * @param {Object} options - Additional options
 * @returns {Object|null} Selected spell or null
 */
export function selectSpell(ai, enemy, spellCatalog, weaknessMemory, meleeRound, options = {}) {
  if (!ai || !enemy || !spellCatalog || spellCatalog.length === 0) {
    return null;
  }

  const {
    avoidRepeating = true,
    lastSpellName = null,
    maxPPE = Infinity
  } = options;

  // Get threat profile and weakness memory for enemy
  const profile = getThreatProfile(enemy);
  const enemyMemory = weaknessMemory[enemy.id] || {
    confirmed: [],
    suspected: [],
    disproven: [],
    lastUpdated: 0
  };

  // Get role-based spell priority
  const priorityList = getSpellPriority(ai);

  // Filter spells by affordability and basic requirements
  const affordableSpells = spellCatalog.filter(spell => {
    const cost = getSpellCost(spell);
    return cost <= maxPPE && cost <= (ai.currentPPE || ai.PPE || 0);
  });

  if (affordableSpells.length === 0) return null;

  // Iterate through priority tiers
  for (const tier of priorityList) {
    const tierSpells = getSpellsByTag(affordableSpells, tier);

    if (tierSpells.length === 0) continue;

    // Filter spells based on weakness memory and threat profile
    const viableSpells = tierSpells.filter(spell => {
      // Rule: Will not cast a spell already proven ineffective
      const spellTags = tagSpell(spell);
      const isDisproven = spellTags.some(tag => {
        if (tag === "fire_damage" && isWeaknessDisproven(weaknessMemory, enemy.id, "fire")) return true;
        if (tag === "holy_damage" && isWeaknessDisproven(weaknessMemory, enemy.id, "holy")) return true;
        if (tag === "cold_damage" && isWeaknessDisproven(weaknessMemory, enemy.id, "cold")) return true;
        return false;
      });
      if (isDisproven) return false;

      // Rule: Avoid repeating same spell twice in a row (unless desperate)
      if (avoidRepeating && lastSpellName && 
          (spell.name || "").toLowerCase() === lastSpellName.toLowerCase()) {
        return false;
      }

      // Check if spell is blocked by threat profile
      if (profile.mundaneResistant && spellTags.includes("damage") && 
          !spellTags.includes("holy_damage") && !spellTags.includes("magic")) {
        // Mundane damage won't work
        return false;
      }

      // Check fire immunity (for demons)
      if (spellTags.includes("fire_damage")) {
        const spellName = (spell.name || "").toLowerCase();
        const isFireSpell = spellName.includes("fire") || 
                           spellName.includes("flame") || 
                           spellName.includes("burn") ||
                           SPELL_ELEMENT_MAP[spell.name] === "fire";
        
        if (isFireSpell) {
          // Check if target is impervious to fire
          const abilities = enemy.abilities || {};
          if (typeof abilities === "object" && !Array.isArray(abilities)) {
            if (abilities.impervious_to && abilities.impervious_to.includes("fire")) {
              return false; // Don't cast fire spells on fire-immune targets
            }
          }
        }
      }

      return true;
    });

    if (viableSpells.length === 0) continue;

    // Prioritize spells that exploit confirmed weaknesses
    const confirmedWeaknesses = getConfirmedWeaknesses(weaknessMemory, enemy.id);
    const suspectedWeaknesses = getSuspectedWeaknesses(weaknessMemory, enemy.id);

    // Score spells based on weakness exploitation
    const scoredSpells = viableSpells.map(spell => {
      let score = 0;
      const spellTags = tagSpell(spell);

      // High score for confirmed weaknesses
      if (spellTags.includes("holy_damage") && confirmedWeaknesses.includes("holy")) {
        score += 10;
      }
      if (spellTags.includes("fire_damage") && confirmedWeaknesses.includes("fire")) {
        score += 10;
      }
      if (spellTags.includes("cold_damage") && confirmedWeaknesses.includes("cold")) {
        score += 10;
      }

      // Medium score for suspected weaknesses
      if (spellTags.includes("holy_damage") && suspectedWeaknesses.includes("holy")) {
        score += 5;
      }
      if (spellTags.includes("fire_damage") && suspectedWeaknesses.includes("fire")) {
        score += 5;
      }
      if (spellTags.includes("cold_damage") && suspectedWeaknesses.includes("cold")) {
        score += 5;
      }

      // Prefer lower cost spells (efficiency)
      const cost = getSpellCost(spell);
      score += (100 - cost) / 10; // Lower cost = higher score

      return { spell, score };
    });

    // Sort by score (highest first)
    scoredSpells.sort((a, b) => b.score - a.score);

    // Return highest scoring spell from this tier
    if (scoredSpells.length > 0) {
      return scoredSpells[0].spell;
    }
  }

  // Fallback: return random affordable spell if no priority match
  const fallbackSpells = affordableSpells.filter(spell => {
    if (avoidRepeating && lastSpellName && 
        (spell.name || "").toLowerCase() === lastSpellName.toLowerCase()) {
      return false;
    }
    return true;
  });

  if (fallbackSpells.length > 0) {
    return fallbackSpells[Math.floor(Math.random() * fallbackSpells.length)];
  }

  return null;
}

/**
 * Check if a spell should be avoided based on threat profile and memory
 * @param {Object} spell - Spell to check
 * @param {Object} enemy - Target enemy
 * @param {Object} weaknessMemory - Weakness memory
 * @returns {boolean} True if spell should be avoided
 */
export function shouldAvoidSpell(spell, enemy, weaknessMemory) {
  if (!spell || !enemy) return false;

  const profile = getThreatProfile(enemy);
  const spellTags = tagSpell(spell);

  // Check if spell is disproven
  if (spellTags.includes("fire_damage") && 
      isWeaknessDisproven(weaknessMemory, enemy.id, "fire")) {
    return true;
  }

  // Check fire immunity
  if (spellTags.includes("fire_damage")) {
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
 * Select spell for role (wrapper for enemyTurnAI with different signature)
 * @param {Object} params - Parameters object
 * @param {string} params.role - Caster role (angel, demon, wizard)
 * @param {Object} params.caster - Caster fighter
 * @param {Object} params.target - Target fighter
 * @param {number} params.distanceFeet - Distance in feet
 * @param {Array<Object>} params.catalog - Spell catalog
 * @param {Object} params.threatProfile - Threat profile
 * @param {Object} params.weaknessMemory - Weakness memory for this target
 * @param {Set<string>} params.avoidSpellNames - Set of spell names to avoid
 * @returns {Object|null} Selected spell or null
 */
export function selectSpellForRole(params) {
  const {
    role,
    caster,
    target,
    distanceFeet,
    catalog,
    threatProfile,
    weaknessMemory,
    avoidSpellNames
  } = params || {};

  if (!caster || !target || !catalog || catalog.length === 0) {
    return null;
  }

  // Convert weaknessMemory format if needed
  const memoryForSelect = weaknessMemory || {
    confirmed: [],
    suspected: [],
    disproven: []
  };

  // Filter out avoided spells
  const filteredCatalog = catalog.filter(spell => {
    if (!spell || !spell.name) return false;
    const name = (spell.name || "").toLowerCase();
    return !avoidSpellNames || !avoidSpellNames.has(name);
  });

  if (filteredCatalog.length === 0) return null;

  // Use selectSpell with appropriate options
  return selectSpell(
    caster,
    target,
    filteredCatalog,
    { [target.id || "target"]: memoryForSelect },
    0, // meleeRound (not critical for selection)
    {
      avoidRepeating: true,
      lastSpellName: null,
      maxPPE: caster.currentPPE || caster.PPE || Infinity
    }
  );
}

