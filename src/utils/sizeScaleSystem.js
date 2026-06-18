const CATEGORY_SEQUENCE = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
];

const SIZE_CATEGORY_DATA = {
  tiny: {
    category: "tiny",
    footprint: 1,
    reach: 3,
    attackBonus: -2,
    evadeModifier: 2,
  },
  small: {
    category: "small",
    footprint: 1,
    reach: 4,
    attackBonus: -1,
    evadeModifier: 1,
  },
  medium: {
    category: "medium",
    footprint: 1,
    reach: 5,
    attackBonus: 0,
    evadeModifier: 0,
  },
  large: {
    category: "large",
    footprint: 2,
    reach: 10,
    attackBonus: 1,
    evadeModifier: -1,
  },
  huge: {
    category: "huge",
    footprint: 3,
    reach: 15,
    attackBonus: 2,
    evadeModifier: -2,
  },
  gargantuan: {
    category: "gargantuan",
    footprint: 4,
    reach: 20,
    attackBonus: 3,
    evadeModifier: -3,
  },
};

const KEYWORD_CATEGORY_OVERRIDES = [
  { keyword: "wyrm", category: "gargantuan" },
  { keyword: "titan", category: "gargantuan" },
  { keyword: "leviathan", category: "gargantuan" },
  { keyword: "heavy", category: "huge" },
  { keyword: "behemoth", category: "huge" },
  { keyword: "coloss", category: "gargantuan" }, // colossus / colossal
  { keyword: "golem", category: "large" },
  { keyword: "chimera", category: "huge" },
  { keyword: "animal", category: "gargantuan" },
  { keyword: "hydra", category: "gargantuan" },
];

function clampCategory(category) {
  return SIZE_CATEGORY_DATA[category] ? category : "medium";
}

function upgradeCategory(current, desired) {
  const currentIndex = CATEGORY_SEQUENCE.indexOf(clampCategory(current));
  const desiredIndex = CATEGORY_SEQUENCE.indexOf(clampCategory(desired));
  return CATEGORY_SEQUENCE[Math.max(currentIndex, desiredIndex)];
}

function parseSizeFeet(sizeText) {
  if (!sizeText) return null;

  const cleaned = sizeText.replace(/,/g, "").toLowerCase();

  // Match patterns like "15-20 feet" or "10 to 12 ft"
  const rangeMatch = cleaned.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|')/
  );
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return (min + max) / 2;
    }
  }

  // Match single value with units
  const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|')/);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  // If no unit-specified numbers, fallback to the largest numeric value
  const genericMatches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)/g)];
  if (genericMatches.length > 0) {
    const numbers = genericMatches
      .map((m) => parseFloat(m[1]))
      .filter((n) => !Number.isNaN(n));
    if (numbers.length > 0) {
      return Math.max(...numbers);
    }
  }

  return null;
}

function determineCategoryFromFeet(feet) {
  if (feet == null) return "medium";
  if (feet <= 3) return "tiny";
  if (feet <= 6) return "small";
  if (feet <= 11) return "medium";
  if (feet <= 17) return "large";
  if (feet <= 24) return "huge";
  return "gargantuan";
}

function applyKeywordOverrides(text, initialCategory) {
  let category = initialCategory;
  if (!text) return category;

  const lower = text.toLowerCase();
  KEYWORD_CATEGORY_OVERRIDES.forEach(
    ({ keyword, category: overrideCategory }) => {
      if (lower.includes(keyword)) {
        category = upgradeCategory(category, overrideCategory);
      }
    }
  );

  return category;
}

/**
 * Determine the scale information for a combatant based on its size text, name, or type.
 * @param {Object} combatant
 * @returns {{category:string, footprint:number, reach:number, attackBonus:number, evadeModifier:number, rawFeet:number}|null}
 */
export function getSizeScale(combatant = {}) {
  const sizeText =
    combatant.size || combatant.dimensions || combatant.description || "";
  const rawFeet = parseSizeFeet(sizeText);

  const baseCategory = determineCategoryFromFeet(rawFeet);

  const descriptorText = `${combatant.name || ""} ${combatant.category || ""} ${
    sizeText || ""
  }`;
  const category = applyKeywordOverrides(descriptorText, baseCategory);

  const data = SIZE_CATEGORY_DATA[category] || SIZE_CATEGORY_DATA.medium;

  return {
    ...data,
    rawFeet: rawFeet ?? null,
    sourceText: sizeText || null,
  };
}

/**
 * Apply the size-based combat modifiers to a fighter (attack/evade bonuses and footprint).
 * @param {Object} fighter
 * @param {Object} scaleInfo
 */
export function applySizeCombatModifiers(fighter, scaleInfo) {
  if (!fighter || !scaleInfo) return;
  if (fighter.__sizeScaleApplied) return;

  fighter.bonuses = fighter.bonuses || {};

  if (scaleInfo.attackBonus) {
    fighter.bonuses.attack =
      (fighter.bonuses.attack || 0) + scaleInfo.attackBonus;
  }

  if (scaleInfo.evadeModifier) {
    fighter.bonuses.evade =
      (fighter.bonuses.evade || 0) + scaleInfo.evadeModifier;
  }

  fighter.__sizeScaleApplied = true;
}
