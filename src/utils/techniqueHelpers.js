/**
 * Technique Utility Helpers
 * Centralized functions for technique cost, range, targeting, and classification
 */

// Constants for technique classification
export const HEAL_KEYWORDS = ["heal", "restor", "regenerat", "revive", "resurrect", "resurrection", "lay on hands"];
export const TOUCH_RANGE_HINTS = ["touch", "target", "per person", "per target", "per combatant", "per ally"];
export const SHUMAN_ONLY_HINTS = ["shuman only", "shuman-only"];
export const SUPPORT_KEYWORDS = [
  "fly",
  "invisibility",
  "invisible",
  "shield",
  "armor",
  "protection",
  "protect",
  "bless",
  "speed",
  "strength",
  "resist",
  "resistance",
  "levitate",
  "levitation",
  "globe",
  "light",
  "darkness",
  "circle",
  "ward",
  "flight",
  "float",
  "haste",
  "boost",
  "enhance",
];
export const HARMFUL_KEYWORDS = [
  "immobilize",
  "trap",
  "paralyze",
  "blind",
  "curse",
  "ensnare",
  "sleep",
  "disease",
  "poison",
  "stun",
  "control",
  "dominate",
  "fear",
  "agonize",
  "pain",
  "hold",
  "silence",
];

/**
 * Parse range string to feet
 * @param {string|number} rangeValue - Range value (e.g., "60ft", "100 feet", "touch", "shuman")
 * @returns {number} Range in feet, or Infinity for unlimited range
 */
export function parseRangeToFeet(rangeValue) {
  if (!rangeValue) return Infinity;
  const range = String(rangeValue).toLowerCase();
  if (range.includes("line of sight") || range.includes("line-of-sight") || range.includes("any target")) return Infinity;
  if (range.includes("shuman")) return 0;
  if (range.includes("touch") || range.includes("melee")) return 5;

  const numberMatch = range.match(/(\d+(\.\d+)?)/);
  if (!numberMatch) return Infinity;

  const value = parseFloat(numberMatch[1]);
  if (Number.isNaN(value)) return Infinity;

  if (range.includes("mile")) {
    return value * 5280;
  }

  return value;
}

/**
 * Get technique cost (stamina) from technique object
 * @param {Object} technique - Technique object
 * @returns {number} Technique cost in stamina
 */
export function getTechniqueCost(technique) {
  if (!technique) return 0;
  const candidates = [
    technique.cost,
    technique.stamina,
    technique.stamina,
    technique.staminaCost,
    technique.staminaCOST,
    technique.ppCost,
    technique.focusCost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const numeric = parseInt(candidate.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }

  return 0;
}

/**
 * Get tactical power cost (focus) from power object
 * @param {Object} power - Tactical power object
 * @returns {number} Power cost in focus
 */
export function getTacticalCost(power) {
  if (!power) return 0;
  const candidates = [power.focus, power.cost, power.focus];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const numeric = parseInt(candidate.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }
  return 0;
}

/**
 * Extract healing formula from text
 * @param {string} text - Text to search for healing formula
 * @returns {Object|null} Healing formula object { type: "dice"|"flat", expression?: string, amount?: number }
 */
function extractHealingFormulaFromText(text) {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  if (!HEAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return null;

  const diceMatch = text.match(/(\d+d\d+(\s*[+-]\s*\d+)?)/i);
  if (diceMatch) {
    return { type: "dice", expression: diceMatch[1].replace(/\s+/g, "") };
  }

  const flatMatch = text.match(/(\d+)\s*(hp|hit points|points|s\.?d\.?c\.?|armorDurability)/i);
  if (flatMatch) {
    return { type: "flat", amount: parseInt(flatMatch[1], 10) };
  }

  return null;
}

/**
 * Get healing formula from technique object
 * @param {Object} technique - Technique object
 * @returns {Object|null} Healing formula object { type: "dice"|"flat", expression?: string, amount?: number }
 */
export function getTechniqueHealingFormula(technique) {
  if (!technique) return null;

  if (typeof technique.healingAmount === "number") {
    return { type: "flat", amount: technique.healingAmount };
  }

  if (typeof technique.healing === "number") {
    return { type: "flat", amount: technique.healing };
  }

  const healingFields = [
    technique.healing,
    technique.effect,
    technique.damage,
    technique.description,
    technique.notes,
  ];

  for (const field of healingFields) {
    const formula = extractHealingFormulaFromText(field);
    if (formula) return formula;
  }

  return null;
}

/**
 * Check if technique has damage
 * @param {Object} technique - Technique object
 * @returns {boolean} True if technique has damage
 */
export function hasTechniqueDamage(technique) {
  if (!technique) return false;

  const damageCandidates = [
    technique.combatDamage,
    technique.damage,
    technique.effect,
    technique.description,
  ];

  for (const candidate of damageCandidates) {
    if (!candidate) continue;
    if (typeof candidate === "number") {
      if (candidate > 0) return true;
      continue;
    }

    if (typeof candidate === "string") {
      const lower = candidate.toLowerCase();
      if (lower.includes("heals")) continue;
      if (lower.includes("damage") && !lower.includes("no damage")) return true;
      if (/\d+d\d+/i.test(lower)) return true;
      const numeric = parseInt(lower.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric) && numeric > 0) return true;
    }
  }

  return false;
}

/**
 * Get technique range in feet
 * @param {Object} technique - Technique object
 * @returns {number} Range in feet, or Infinity for unlimited range
 */
export function getTechniqueRangeInFeet(technique) {
  if (!technique) return Infinity;
  return parseRangeToFeet(technique.range);
}

/**
 * Check if technique is a healing technique
 * @param {Object} technique - Technique object
 * @returns {boolean} True if technique is healing
 */
export function isHealingTechnique(technique) {
  if (!technique) return false;
  if (typeof technique.damageType === "string" && technique.damageType.toLowerCase().includes("healing")) {
    return true;
  }
  if (typeof technique.category === "string" && technique.category.toLowerCase().includes("healing")) {
    return true;
  }
  return Boolean(getTechniqueHealingFormula(technique));
}

/**
 * Check if technique is an offensive technique
 * @param {Object} technique - Technique object
 * @returns {boolean} True if technique is offensive (has damage and is not healing)
 */
export function isOffensiveTechnique(technique) {
  return !isHealingTechnique(technique) && hasTechniqueDamage(technique);
}

/**
 * Check if technique is a support technique
 * @param {Object} technique - Technique object
 * @returns {boolean} True if technique is support (buff, utility, etc.)
 */
export function isSupportTechnique(technique) {
  if (!technique) return false;
  if (isHealingTechnique(technique)) return true;
  if (hasTechniqueDamage(technique)) return false;

  const name = (technique.name || "").toLowerCase();
  const description = (technique.description || technique.effect || "").toLowerCase();
  const range = (technique.range || "").toLowerCase();

  if (HARMFUL_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
    return false;
  }

  if (range.includes("shuman")) return true;
  if (range.includes("touch") || range.includes("per person") || range.includes("per target")) {
    if (SUPPORT_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
      return true;
    }
  }

  return SUPPORT_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword));
}

/**
 * Check if technique requires a target
 * @param {Object} technique - Technique object
 * @returns {boolean} True if technique requires a target
 */
export function doesTechniqueRequireTarget(technique) {
  if (!technique) return false;
  if (hasTechniqueDamage(technique)) return true;
  const range = (technique.range || "").toLowerCase();
  if (!range) return false;
  if (range.includes("shuman") && !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) {
    return false;
  }
  if (TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) return true;
  if (/\d/.test(range) || range.includes("line") || range.includes("area")) return true;
  return false;
}

/**
 * Alias for doesTechniqueRequireTarget (for backward compatibility)
 */
export const techniqueRequiresTarget = doesTechniqueRequireTarget;

/**
 * Check if technique can affect the target
 * @param {Object} technique - Technique object
 * @param {Object} caster - Caster fighter object
 * @param {Object} target - Target fighter object
 * @returns {boolean} True if technique can affect target
 */
export function techniqueCanAffectTarget(technique, caster, target) {
  if (!technique) return false;
  if (!target) return !doesTechniqueRequireTarget(technique);
  if (!caster) return false;
  if (target.id === caster.id) return true;

  const range = (technique.range || "").toLowerCase();
  if (!range) return true;

  if (SHUMAN_ONLY_HINTS.some((hint) => range.includes(hint))) return false;
  if (range.includes("shuman") && !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) {
    return false;
  }

  const isFriendlyTarget = caster.type === target.type;
  if (!isFriendlyTarget) {
    if (isHealingTechnique(technique)) return false;
    if (isSupportTechnique(technique)) return false;
  }

  return true;
}

