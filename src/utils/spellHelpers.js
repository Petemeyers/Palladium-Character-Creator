/**
 * Spell Utility Helpers
 * Centralized functions for spell cost, range, targeting, and classification
 */

// Constants for spell classification
export const HEAL_KEYWORDS = ["heal", "restor", "regenerat", "revive", "resurrect", "resurrection", "lay on hands"];
export const TOUCH_RANGE_HINTS = ["touch", "target", "per person", "per target", "per creature", "per ally"];
export const SELF_ONLY_HINTS = ["self only", "self-only"];
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
 * @param {string|number} rangeValue - Range value (e.g., "60ft", "100 feet", "touch", "self")
 * @returns {number} Range in feet, or Infinity for unlimited range
 */
export function parseRangeToFeet(rangeValue) {
  if (!rangeValue) return Infinity;
  const range = String(rangeValue).toLowerCase();
  if (range.includes("line of sight") || range.includes("line-of-sight") || range.includes("any target")) return Infinity;
  if (range.includes("self")) return 0;
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
 * Get spell cost (PPE) from spell object
 * @param {Object} spell - Spell object
 * @returns {number} Spell cost in PPE
 */
export function getSpellCost(spell) {
  if (!spell) return 0;
  const candidates = [
    spell.cost,
    spell.ppe,
    spell.PPE,
    spell.ppeCost,
    spell.PPECOST,
    spell.ppCost,
    spell.ispCost,
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
 * Get psionic power cost (ISP) from power object
 * @param {Object} power - Psionic power object
 * @returns {number} Power cost in ISP
 */
export function getPsionicCost(power) {
  if (!power) return 0;
  const candidates = [power.isp, power.cost, power.ISP];
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

  const flatMatch = text.match(/(\d+)\s*(hp|hit points|points|s\.?d\.?c\.?|sdc)/i);
  if (flatMatch) {
    return { type: "flat", amount: parseInt(flatMatch[1], 10) };
  }

  return null;
}

/**
 * Get healing formula from spell object
 * @param {Object} spell - Spell object
 * @returns {Object|null} Healing formula object { type: "dice"|"flat", expression?: string, amount?: number }
 */
export function getSpellHealingFormula(spell) {
  if (!spell) return null;

  if (typeof spell.healingAmount === "number") {
    return { type: "flat", amount: spell.healingAmount };
  }

  if (typeof spell.healing === "number") {
    return { type: "flat", amount: spell.healing };
  }

  const healingFields = [
    spell.healing,
    spell.effect,
    spell.damage,
    spell.description,
    spell.notes,
  ];

  for (const field of healingFields) {
    const formula = extractHealingFormulaFromText(field);
    if (formula) return formula;
  }

  return null;
}

/**
 * Check if spell has damage
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell has damage
 */
export function hasSpellDamage(spell) {
  if (!spell) return false;

  const damageCandidates = [
    spell.combatDamage,
    spell.damage,
    spell.effect,
    spell.description,
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
 * Get spell range in feet
 * @param {Object} spell - Spell object
 * @returns {number} Range in feet, or Infinity for unlimited range
 */
export function getSpellRangeInFeet(spell) {
  if (!spell) return Infinity;
  return parseRangeToFeet(spell.range);
}

/**
 * Check if spell is a healing spell
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell is healing
 */
export function isHealingSpell(spell) {
  if (!spell) return false;
  if (typeof spell.damageType === "string" && spell.damageType.toLowerCase().includes("healing")) {
    return true;
  }
  if (typeof spell.category === "string" && spell.category.toLowerCase().includes("healing")) {
    return true;
  }
  return Boolean(getSpellHealingFormula(spell));
}

/**
 * Check if spell is an offensive spell
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell is offensive (has damage and is not healing)
 */
export function isOffensiveSpell(spell) {
  return !isHealingSpell(spell) && hasSpellDamage(spell);
}

/**
 * Check if spell is a support spell
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell is support (buff, utility, etc.)
 */
export function isSupportSpell(spell) {
  if (!spell) return false;
  if (isHealingSpell(spell)) return true;
  if (hasSpellDamage(spell)) return false;

  const name = (spell.name || "").toLowerCase();
  const description = (spell.description || spell.effect || "").toLowerCase();
  const range = (spell.range || "").toLowerCase();

  if (HARMFUL_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
    return false;
  }

  if (range.includes("self")) return true;
  if (range.includes("touch") || range.includes("per person") || range.includes("per target")) {
    if (SUPPORT_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
      return true;
    }
  }

  return SUPPORT_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword));
}

/**
 * Check if spell requires a target
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell requires a target
 */
export function doesSpellRequireTarget(spell) {
  if (!spell) return false;
  if (hasSpellDamage(spell)) return true;
  const range = (spell.range || "").toLowerCase();
  if (!range) return false;
  if (range.includes("self") && !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) {
    return false;
  }
  if (TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) return true;
  if (/\d/.test(range) || range.includes("line") || range.includes("area")) return true;
  return false;
}

/**
 * Alias for doesSpellRequireTarget (for backward compatibility)
 */
export const spellRequiresTarget = doesSpellRequireTarget;

/**
 * Check if spell can affect the target
 * @param {Object} spell - Spell object
 * @param {Object} caster - Caster fighter object
 * @param {Object} target - Target fighter object
 * @returns {boolean} True if spell can affect target
 */
export function spellCanAffectTarget(spell, caster, target) {
  if (!spell) return false;
  if (!target) return !doesSpellRequireTarget(spell);
  if (!caster) return false;
  if (target.id === caster.id) return true;

  const range = (spell.range || "").toLowerCase();
  if (!range) return true;

  if (SELF_ONLY_HINTS.some((hint) => range.includes(hint))) return false;
  if (range.includes("self") && !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) {
    return false;
  }

  const isFriendlyTarget = caster.type === target.type;
  if (!isFriendlyTarget) {
    if (isHealingSpell(spell)) return false;
    if (isSupportSpell(spell)) return false;
  }

  return true;
}

