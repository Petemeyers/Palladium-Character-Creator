// src/utils/spellUtils.js

const HEAL_KEYWORDS = [
  "heal",
  "restor",
  "regenerat",
  "revive",
  "resurrect",
  "resurrection",
  "lay on hands",
];

const TOUCH_RANGE_HINTS = [
  "touch",
  "target",
  "per person",
  "per target",
  "per creature",
  "per ally",
];

const SELF_ONLY_HINTS = ["self only", "self-only"];

const SUPPORT_KEYWORDS = [
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

const HARMFUL_KEYWORDS = [
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

export function parseRangeToFeet(rangeValue) {
  if (!rangeValue) return Infinity;
  const range = String(rangeValue).toLowerCase();
  if (
    range.includes("line of sight") ||
    range.includes("line-of-sight") ||
    range.includes("any target")
  )
    return Infinity;
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

export function extractHealingFormulaFromText(text) {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  if (!HEAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return null;

  const diceMatch = text.match(/(\d+d\d+(\s*[+-]\s*\d+)?)/i);
  if (diceMatch) {
    return { type: "dice", expression: diceMatch[1].replace(/\s+/g, "") };
  }

  const flatMatch = text.match(
    /(\d+)\s*(hp|hit points|points|s\.?d\.?c\.?|sdc)/i
  );
  if (flatMatch) {
    return { type: "flat", amount: parseInt(flatMatch[1], 10) };
  }

  return null;
}

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
      if (lower.includes("damage") || /\d+d\d+/.test(lower)) return true;
    }
  }

  return false;
}

export function getSpellRangeInFeet(spell) {
  if (!spell) return Infinity;
  return parseRangeToFeet(spell.range);
}

export function isHealingSpell(spell) {
  if (!spell) return false;
  if (
    typeof spell.damageType === "string" &&
    spell.damageType.toLowerCase().includes("healing")
  ) {
    return true;
  }
  if (
    typeof spell.category === "string" &&
    spell.category.toLowerCase().includes("healing")
  ) {
    return true;
  }
  return Boolean(getSpellHealingFormula(spell));
}

export function isOffensiveSpell(spell) {
  return !isHealingSpell(spell) && hasSpellDamage(spell);
}

export function isSupportSpell(spell) {
  if (!spell) return false;
  if (isHealingSpell(spell)) return true;
  if (hasSpellDamage(spell)) return false;

  const name = (spell.name || "").toLowerCase();
  const description = (spell.description || spell.effect || "").toLowerCase();
  const range = (spell.range || "").toLowerCase();

  if (
    HARMFUL_KEYWORDS.some(
      (keyword) => name.includes(keyword) || description.includes(keyword)
    )
  ) {
    return false;
  }

  if (range.includes("self")) return true;
  if (range.includes("touch") || range.includes("per person") || range.includes("per target")) {
    if (
      SUPPORT_KEYWORDS.some(
        (keyword) => name.includes(keyword) || description.includes(keyword)
      )
    ) {
      return true;
    }
  }

  return SUPPORT_KEYWORDS.some(
    (keyword) => name.includes(keyword) || description.includes(keyword)
  );
}

export function doesSpellRequireTarget(spell) {
  if (!spell) return false;
  if (hasSpellDamage(spell)) return true;
  const range = (spell.range || "").toLowerCase();
  if (!range) return false;
  if (
    range.includes("self") &&
    !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))
  ) {
    return false;
  }
  if (TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) return true;
  if (/\d/.test(range) || range.includes("line") || range.includes("area"))
    return true;
  return false;
}

export function spellCanAffectTarget(spell, caster, target) {
  if (!spell) return false;
  if (!target) return !doesSpellRequireTarget(spell);
  if (!caster) return false;
  if (target.id === caster.id) return true;

  const range = (spell.range || "").toLowerCase();
  if (!range) return true;

  if (SELF_ONLY_HINTS.some((hint) => range.includes(hint))) return false;
  if (
    range.includes("self") &&
    !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))
  ) {
    return false;
  }

  const isFriendlyTarget = caster.type === target.type;
  if (!isFriendlyTarget) {
    if (isHealingSpell(spell)) return false;
    if (isSupportSpell(spell)) return false;
  }

  return true;
}

/**
 * Check if a spell is supported in combat (has implemented handlers)
 * Supported right now if it deals damage, heals, or is a "support" buff.
 * Later you'll expand this with real effect handlers (summon, wards, teleport, etc.)
 * @param {Object} spell - Spell object
 * @returns {boolean} True if spell is combat-supported
 */
export function isCombatSupportedSpell(spell) {
  return hasSpellDamage(spell) || isHealingSpell(spell) || isSupportSpell(spell);
}

// Alias for backward compatibility
export const spellRequiresTarget = doesSpellRequireTarget;

