export const CREATURE_SIZE_5E = {
  TINY: "Tiny",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  HUGE: "Huge",
  GARGANTUAN: "Gargantuan",
};

const SIZE_RANKS_5E = {
  [CREATURE_SIZE_5E.TINY]: 1,
  [CREATURE_SIZE_5E.SMALL]: 2,
  [CREATURE_SIZE_5E.MEDIUM]: 3,
  [CREATURE_SIZE_5E.LARGE]: 4,
  [CREATURE_SIZE_5E.HUGE]: 5,
  [CREATURE_SIZE_5E.GARGANTUAN]: 6,
};

const SIZE_PATTERNS = [
  [/\bgargantuan\b/i, CREATURE_SIZE_5E.GARGANTUAN],
  [/\bhuge\b/i, CREATURE_SIZE_5E.HUGE],
  [/\blarge\b/i, CREATURE_SIZE_5E.LARGE],
  [/\bmedium\b/i, CREATURE_SIZE_5E.MEDIUM],
  [/\bsmall\b/i, CREATURE_SIZE_5E.SMALL],
  [/\btiny\b/i, CREATURE_SIZE_5E.TINY],
];

function normalizeSizeText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  for (const [pattern, size] of SIZE_PATTERNS) {
    if (pattern.test(trimmed)) return size;
  }

  return null;
}

function categoryContainsSizeWord(category) {
  return normalizeSizeText(category);
}

function getSafeSpeciesFallback(input) {
  const species = String(input?.species || input?.race || "").trim().toLowerCase();
  if (!species) return null;

  if (
    species === "human" ||
    species === "humanoid" ||
    species.includes("human")
  ) {
    return CREATURE_SIZE_5E.MEDIUM;
  }

  return null;
}

export function getCreatureSize5e(input) {
  if (typeof input === "string") {
    return normalizeSizeText(input) || CREATURE_SIZE_5E.MEDIUM;
  }

  if (!input || typeof input !== "object") {
    return CREATURE_SIZE_5E.MEDIUM;
  }

  return (
    normalizeSizeText(input.creatureSize) ||
    normalizeSizeText(input.sizeCategory) ||
    normalizeSizeText(input.size) ||
    normalizeSizeText(input.stats?.size) ||
    normalizeSizeText(input.attributes?.size) ||
    categoryContainsSizeWord(input.category) ||
    getSafeSpeciesFallback(input) ||
    CREATURE_SIZE_5E.MEDIUM
  );
}

export function isTiny5e(input) {
  return getCreatureSize5e(input) === CREATURE_SIZE_5E.TINY;
}

export function isSmall5e(input) {
  return getCreatureSize5e(input) === CREATURE_SIZE_5E.SMALL;
}

export function isMedium5e(input) {
  return getCreatureSize5e(input) === CREATURE_SIZE_5E.MEDIUM;
}

export function isLarge5e(input) {
  return getCreatureSize5e(input) === CREATURE_SIZE_5E.LARGE;
}

export function isHuge5e(input) {
  return getCreatureSize5e(input) === CREATURE_SIZE_5E.HUGE;
}

export function isGargantuan5e(input) {
  return getCreatureSize5e(input) === CREATURE_SIZE_5E.GARGANTUAN;
}

export function getCreatureSizeRank5e(input) {
  return SIZE_RANKS_5E[getCreatureSize5e(input)] || SIZE_RANKS_5E[CREATURE_SIZE_5E.MEDIUM];
}

export function getCreatureSizeLabel5e(input) {
  return getCreatureSize5e(input);
}

export function getLegacyWeaponSizeCompatibility(input) {
  return {
    creatureSize: getCreatureSize5e(input),
    sizeRank: getCreatureSizeRank5e(input),
    isLegacyBridge: true,
  };
}

export default {
  CREATURE_SIZE_5E,
  getCreatureSize5e,
  isTiny5e,
  isSmall5e,
  isMedium5e,
  isLarge5e,
  isHuge5e,
  isGargantuan5e,
  getCreatureSizeRank5e,
  getCreatureSizeLabel5e,
  getLegacyWeaponSizeCompatibility,
};
