/**
 * OCC Skill Mapper - Maps O.C.C. and skills to combat modifiers
 *
 * Extracts combat-relevant skills from character OCC and skill data:
 * - Prowl: Stealth checks (Phase 0 pre-combat)
 * - Track: Target detection by signs/smell
 * - Hand to Hand: Defines attacks per melee, critical range
 * - Horsemanship: Mounted bonuses
 * - Parry/Dodge/Strike: Combat bonuses (already built-in via bonuses object)
 * - Psionics/Magic: Mental/magical action hooks
 *
 * Returns normalized skill modifiers for use in combat engine.
 */

import { OCCS } from "../data/occData.js";
import { occSkillTables } from "./occSkills.js";

/**
 * Extract Hand to Hand type from OCC skills
 * @param {Object} occData - OCC data object
 * @returns {string|null} Hand to Hand type (e.g., "Basic", "Mercenary", "Knight")
 */
function extractHandToHandType(occData) {
  if (!occData || !occData.occSkills) return null;

  const handToHandSkill = occData.occSkills.find((skill) =>
    skill.toLowerCase().includes("hand to hand")
  );

  if (handToHandSkill) {
    const match = handToHandSkill.match(/hand\s+to\s+hand[:\s]+(.+)/i);
    return match ? match[1].trim() : "Basic";
  }

  return null;
}

/**
 * Get attacks per melee based on Hand to Hand type
 * @param {string} handToHandType - Hand to Hand type
 * @returns {number} Attacks per melee
 */
function getAttacksPerMeleeFromHandToHand(handToHandType) {
  if (!handToHandType) return 2; // Default

  const type = handToHandType.toLowerCase();

  // Palladium 1994 Hand to Hand attacks per melee
  if (type.includes("basic")) return 2;
  if (type.includes("expert")) return 3;
  if (type.includes("martial arts")) return 4;
  if (type.includes("assassin")) return 4;
  if (type.includes("mercenary")) return 3;
  if (type.includes("knight")) return 3;
  if (type.includes("rogue")) return 3;
  if (type.includes("paladin")) return 3;

  return 2; // Default fallback
}

/**
 * Get skill percentage from character data
 * @param {Object} character - Character object
 * @param {string} skillName - Skill name to look up
 * @returns {number} Skill percentage (0-100)
 */
function getSkillPercentage(character, skillName) {
  // Check direct skills object
  if (character.skills && character.skills[skillName]) {
    return character.skills[skillName];
  }

  // Check lowercase keys
  const lowerSkillName = skillName.toLowerCase();
  if (character.skills) {
    for (const key in character.skills) {
      if (key.toLowerCase() === lowerSkillName) {
        return character.skills[key];
      }
    }
  }

  // Check OCC skill tables (base percentage)
  const occName = character.occ || character.OCC;
  if (occName && occSkillTables[occName]) {
    const occSkills = occSkillTables[occName];
    const skillKey = lowerSkillName.replace(/\s+/g, "");

    // Try direct match
    if (occSkills[skillKey] !== undefined) {
      return occSkills[skillKey];
    }

    // Try partial match
    for (const key in occSkills) {
      if (
        key.toLowerCase().includes(skillKey) ||
        skillKey.includes(key.toLowerCase())
      ) {
        return occSkills[key];
      }
    }
  }

  return 0; // No skill found
}

/**
 * Map OCC and skills to combat modifiers
 * @param {Object} character - Character object with occ, skills, etc.
 * @returns {Object} Combat-relevant skill modifiers
 */
export function mapOCCSkillsToCombat(character) {
  const result = {
    prowl: 0,
    track: 0,
    handToHand: null,
    attacksPerMelee: 2, // Default
    horsemanship: 0,
    psionics: false,
    magicUser: false,
    detectAmbush: 0,
    scaleWalls: 0,
    other: {}, // Store other combat-relevant skills
  };

  // Get OCC name
  const occName = character.occ || character.OCC || character.occName;
  if (!occName) return result;

  // Get OCC data
  const occData = OCCS[occName] || OCCS[character.occ] || null;

  // Extract Hand to Hand type
  if (occData) {
    const handToHandType = extractHandToHandType(occData);
    if (handToHandType) {
      result.handToHand = handToHandType;
      result.attacksPerMelee = getAttacksPerMeleeFromHandToHand(handToHandType);
    }
  }

  // Get skill percentages
  result.prowl = getSkillPercentage(character, "Prowl");
  result.track = getSkillPercentage(character, "Track");
  result.horsemanship = getSkillPercentage(character, "Horsemanship");
  result.detectAmbush = getSkillPercentage(character, "Detect Ambush");
  result.scaleWalls = getSkillPercentage(character, "Scale Walls");

  // Check for Psionics
  if (
    character.psionics ||
    character.ISP > 0 ||
    character.psionicPowers?.length > 0
  ) {
    result.psionics = true;
  }

  // Check for Magic User
  const magicOCCs = [
    "Wizard",
    "Warlock",
    "Summoner",
    "Diabolist",
    "Illusionist",
    "Witch",
    "Priest",
    "Cleric",
    "Druid",
    "Shaman",
  ];
  if (magicOCCs.some((occ) => occName.includes(occ) || occ.includes(occName))) {
    result.magicUser = true;
  }
  if (character.magic || character.PPE > 0 || character.spells?.length > 0) {
    result.magicUser = true;
  }

  // Store other combat-relevant skills
  if (result.detectAmbush > 0) result.other.detectAmbush = result.detectAmbush;
  if (result.scaleWalls > 0) result.other.scaleWalls = result.scaleWalls;

  return result;
}

/**
 * Get Prowl skill percentage for stealth checks
 * @param {Object} character - Character object
 * @returns {number} Prowl skill percentage
 */
export function getProwlSkill(character) {
  return getSkillPercentage(character, "Prowl");
}

/**
 * Get Track skill percentage for target detection
 * @param {Object} character - Character object
 * @returns {number} Track skill percentage
 */
export function getTrackSkill(character) {
  return getSkillPercentage(character, "Track");
}

/**
 * Check if character has mounted combat bonuses (Horsemanship)
 * @param {Object} character - Character object
 * @returns {boolean} True if character has horsemanship skill
 */
export function hasHorsemanship(character) {
  return getSkillPercentage(character, "Horsemanship") > 0;
}

/**
 * Get attacks per melee from Hand to Hand skill
 * @param {Object} character - Character object
 * @returns {number} Attacks per melee
 */
export function getAttacksPerMelee(character) {
  const occName = character.occ || character.OCC || character.occName;
  const occData = OCCS[occName] || OCCS[character.occ] || null;

  if (occData) {
    const handToHandType = extractHandToHandType(occData);
    if (handToHandType) {
      return getAttacksPerMeleeFromHandToHand(handToHandType);
    }
  }

  // Fallback to character's existing attacksPerMelee or default
  return character.attacksPerMelee || character.actions || 2;
}

// ==========================================
// Status Effect System
// ==========================================

/**
 * Status effect types and their properties
 */
export const STATUS_EFFECTS = {
  SHAKEN: {
    name: "Shaken",
    duration: 1,
    penalties: { strike: -1, parry: -1, dodge: -1 },
  },
  STUNNED: {
    name: "Stunned",
    duration: 1,
    penalties: { strike: -3, parry: -3, dodge: -3 },
  },
  FEAR: {
    name: "Fear",
    duration: 3,
    penalties: { strike: -2, parry: -2, dodge: -2 },
  },
  PARALYZED: {
    name: "Paralyzed",
    duration: 2,
    penalties: { strike: -10, parry: -10, dodge: -10 },
  },
  POISONED: {
    name: "Poisoned",
    duration: 5,
    penalties: { strike: -1, parry: -1, dodge: -1 },
  },
  BLEEDING: {
    name: "Bleeding",
    duration: 3,
    penalties: {},
  },
  COURAGE_BUFF: {
    name: "Courage",
    duration: 1,
    bonuses: { horrorResist: 3 },
  },
};

/**
 * Apply a status effect to a character
 * @param {Object} target - Target character
 * @param {string} effectType - Type of status effect (e.g., "STUNNED", "FEAR")
 * @param {Object} options - Options including caster, logCallback, bypassSave, etc.
 * @returns {Object} Result with success boolean and effect object
 */
export function applyStatusEffect(target, effectType, options = {}) {
  if (!target || !effectType) {
    return { success: false, message: "Invalid target or effect type" };
  }

  const effectDef = STATUS_EFFECTS[effectType];
  if (!effectDef) {
    return { success: false, message: `Unknown effect type: ${effectType}` };
  }

  // Initialize statusEffects array if needed
  if (!target.statusEffects) {
    target.statusEffects = [];
  }

  // Check if effect already exists
  const existingIndex = target.statusEffects.findIndex(
    (e) => e.type === effectType
  );

  const effect = {
    type: effectType,
    name: effectDef.name,
    duration: options.duration || effectDef.duration || 1,
    remainingRounds: options.duration || effectDef.duration || 1,
    caster: options.caster || null,
    appliedAt: options.appliedAt || Date.now(),
  };

  if (existingIndex >= 0) {
    // Refresh existing effect
    target.statusEffects[existingIndex] = effect;
  } else {
    // Add new effect
    target.statusEffects.push(effect);
  }

  // Apply penalties/bonuses
  if (effectDef.penalties) {
    if (!target.bonuses) target.bonuses = {};
    if (!target.bonuses.tempPenalties) target.bonuses.tempPenalties = {};
    Object.entries(effectDef.penalties).forEach(([key, value]) => {
      target.bonuses.tempPenalties[key] =
        (target.bonuses.tempPenalties[key] || 0) + value;
    });
  }

  if (effectDef.bonuses) {
    if (!target.bonuses) target.bonuses = {};
    Object.entries(effectDef.bonuses).forEach(([key, value]) => {
      target.bonuses[key] = (target.bonuses[key] || 0) + value;
    });
  }

  const logCallback = options.logCallback || (() => {});
  logCallback(
    `${target.name || "Character"} is now ${effectDef.name}`,
    "status"
  );

  return { success: true, effect };
}

/**
 * Update status effects for a character (decrement duration, remove expired)
 * @param {Object} character - Character to update
 * @param {number} currentRound - Current melee round
 * @returns {Object} Updated character
 */
export function updateStatusEffects(character, currentRound = 1) {
  // currentRound parameter kept for API compatibility but not currently used
  void currentRound;
  if (!character || !character.statusEffects) {
    return character;
  }

  character.statusEffects = character.statusEffects
    .map((effect) => {
      // Defensive normalization: statusEffects may contain legacy strings (e.g., "FLED")
      // or other non-object values. Normalize to an object so we never try to mutate a string.
      if (!effect) return null;

      if (typeof effect === "string") {
        const normalized = {
          type: effect,
          name: effect,
          duration: 1,
          remainingRounds: 1,
        };
        normalized.remainingRounds =
          (normalized.remainingRounds || normalized.duration || 1) - 1;
        return normalized;
      }

      if (typeof effect !== "object") return null;

      const next = { ...effect };
      next.remainingRounds = (next.remainingRounds || next.duration || 1) - 1;
      return next;
    })
    .filter(Boolean)
    .filter((effect) => {
      if (effect.remainingRounds <= 0) {
        // Remove penalties/bonuses when effect expires
        const effectDef = STATUS_EFFECTS[effect.type];
        if (effectDef && effectDef.penalties) {
          if (character.bonuses && character.bonuses.tempPenalties) {
            Object.entries(effectDef.penalties).forEach(([key, value]) => {
              character.bonuses.tempPenalties[key] =
                (character.bonuses.tempPenalties[key] || 0) - value;
            });
          }
        }
        return false; // Remove expired effect
      }
      return true; // Keep active effect
    });

  return character;
}

/**
 * Get status penalties for a character
 * @param {Object} character - Character to check
 * @returns {Object} Penalties object
 */
export function getStatusPenalties(character) {
  if (!character || !character.statusEffects) {
    return {};
  }

  const penalties = {};
  character.statusEffects.forEach((effect) => {
    const effectDef = STATUS_EFFECTS[effect.type];
    if (effectDef && effectDef.penalties) {
      Object.entries(effectDef.penalties).forEach(([key, value]) => {
        penalties[key] = (penalties[key] || 0) + value;
      });
    }
  });

  return penalties;
}

/**
 * Get status combat penalties for a character (with logging support)
 * @param {Object} character - Character to check
 * @param {Function} logCallback - Optional logging callback
 * @returns {Object} Combat penalties object (strike, parry, dodge, etc.)
 */
export function getStatusCombatPenalties(character, logCallback = () => {}) {
  if (!character) {
    return {};
  }

  // Get base status penalties
  const penalties = getStatusPenalties(character);

  // Also check tempPenalties from bonuses object (applied by status effects)
  if (character.bonuses && character.bonuses.tempPenalties) {
    Object.entries(character.bonuses.tempPenalties).forEach(([key, value]) => {
      if (typeof value === "number") {
        penalties[key] = (penalties[key] || 0) + value;
      }
    });
  }

  // Log if there are significant penalties
  if (Object.keys(penalties).length > 0 && logCallback) {
    const penaltyEntries = Object.entries(penalties)
      .filter((entry) => entry[1] < 0)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    if (penaltyEntries) {
      logCallback(
        `${
          character.name || "Character"
        } has status penalties: ${penaltyEntries}`,
        "status"
      );
    }
  }

  return penalties;
}

/**
 * Check if a character can act (not paralyzed, stunned, etc.)
 * @param {Object} character - Character to check
 * @returns {boolean} True if character can act
 */
export function canCharacterAct(character) {
  if (!character || !character.statusEffects) {
    return true;
  }

  // Check for effects that prevent action
  const blockingEffects = ["PARALYZED", "UNCONSCIOUS", "DEAD"];
  return !character.statusEffects.some((effect) =>
    blockingEffects.includes(effect.type)
  );
}

/**
 * Attempt fear recovery for all combatants
 * @param {Array} combatants - Array of combatants
 * @param {Function} logCallback - Logging callback
 */
export function attemptFearRecovery(combatants = [], logCallback = () => {}) {
  if (!Array.isArray(combatants)) return;

  combatants.forEach((combatant) => {
    if (!combatant || !combatant.statusEffects) return;

    const fearEffects = combatant.statusEffects.filter(
      (e) => e.type === "FEAR" || e.name?.toLowerCase().includes("fear")
    );

    fearEffects.forEach((effect) => {
      // Simple recovery check (can be enhanced with saving throws)
      if (Math.random() < 0.2) {
        // 20% chance to recover
        combatant.statusEffects = combatant.statusEffects.filter(
          (e) => e !== effect
        );
        logCallback(
          `${combatant.name || "Character"} recovers from fear`,
          "status"
        );
      }
    });
  });
}

export default {
  mapOCCSkillsToCombat,
  getProwlSkill,
  getTrackSkill,
  hasHorsemanship,
  getAttacksPerMelee,
  applyStatusEffect,
  updateStatusEffects,
  getStatusPenalties,
  getStatusCombatPenalties,
  canCharacterAct,
  attemptFearRecovery,
  STATUS_EFFECTS,
};
