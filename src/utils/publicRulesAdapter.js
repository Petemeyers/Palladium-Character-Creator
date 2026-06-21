export const CREATURE_SIZE = {
  TINY: "Tiny",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  HUGE: "Huge",
  GARGANTUAN: "Gargantuan",
};

const SIZE_RANKS = {
  [CREATURE_SIZE.TINY]: 1,
  [CREATURE_SIZE.SMALL]: 2,
  [CREATURE_SIZE.MEDIUM]: 3,
  [CREATURE_SIZE.LARGE]: 4,
  [CREATURE_SIZE.HUGE]: 5,
  [CREATURE_SIZE.GARGANTUAN]: 6,
};

const SIZE_PATTERNS = [
  [/\bgargantuan\b/i, CREATURE_SIZE.GARGANTUAN],
  [/\bhuge\b/i, CREATURE_SIZE.HUGE],
  [/\blarge\b/i, CREATURE_SIZE.LARGE],
  [/\bmedium\b/i, CREATURE_SIZE.MEDIUM],
  [/\bsmall\b/i, CREATURE_SIZE.SMALL],
  [/\btiny\b/i, CREATURE_SIZE.TINY],
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
    return CREATURE_SIZE.MEDIUM;
  }

  return null;
}

export function getCreatureSize(input) {
  if (typeof input === "string") {
    return normalizeSizeText(input) || CREATURE_SIZE.MEDIUM;
  }

  if (!input || typeof input !== "object") {
    return CREATURE_SIZE.MEDIUM;
  }

  return (
    normalizeSizeText(input.creatureSize) ||
    normalizeSizeText(input.sizeCategory) ||
    normalizeSizeText(input.size) ||
    normalizeSizeText(input.stats?.size) ||
    normalizeSizeText(input.attributes?.size) ||
    categoryContainsSizeWord(input.category) ||
    getSafeSpeciesFallback(input) ||
    CREATURE_SIZE.MEDIUM
  );
}

export function isTinyCreature(input) {
  return getCreatureSize(input) === CREATURE_SIZE.TINY;
}

export function isSmallCreature(input) {
  return getCreatureSize(input) === CREATURE_SIZE.SMALL;
}

export function isMediumCreature(input) {
  return getCreatureSize(input) === CREATURE_SIZE.MEDIUM;
}

export function isLargeCreature(input) {
  return getCreatureSize(input) === CREATURE_SIZE.LARGE;
}

export function isHugeCreature(input) {
  return getCreatureSize(input) === CREATURE_SIZE.HUGE;
}

export function isGargantuanCreature(input) {
  return getCreatureSize(input) === CREATURE_SIZE.GARGANTUAN;
}

export function getCreatureSizeRank(input) {
  return SIZE_RANKS[getCreatureSize(input)] || SIZE_RANKS[CREATURE_SIZE.MEDIUM];
}

export function getCreatureSizeLabel(input) {
  return getCreatureSize(input);
}

export function getLegacyWeaponSizeCompatibility(input) {
  return {
    creatureSize: getCreatureSize(input),
    sizeRank: getCreatureSizeRank(input),
    isLegacyBridge: true,
  };
}

export function getWeaponScale(combatantOrSize) {
  return {
    creatureSize: getCreatureSize(combatantOrSize),
    sizeRank: getCreatureSizeRank(combatantOrSize),
    damageScale: 1,
    weightMultiplier: 1,
    lengthMultiplier: 1,
    reachModifier: 0,
  };
}

export function getNeutralWeaponDamage(baseDamage, _combatant) {
  return baseDamage;
}

export function getNeutralWeaponWeight(baseWeight, _combatant) {
  return baseWeight;
}

export function getNeutralWeaponLength(baseLength, _combatant) {
  return baseLength;
}

function getNormalizedAllowedSizes(allowedSizes) {
  if (!Array.isArray(allowedSizes)) return null;
  return allowedSizes.map((size) => getCreatureSize(size));
}

export function canUseWeaponBySize(weapon, combatant) {
  if (!weapon || typeof weapon !== "object") return true;

  const creatureSize = getCreatureSize(combatant);
  const sizeRank = getCreatureSizeRank(combatant);
  const allowedSizes = getNormalizedAllowedSizes(weapon.allowedSizes);

  if (allowedSizes && !allowedSizes.includes(creatureSize)) {
    return false;
  }

  if (weapon.minSize) {
    const minRank = getCreatureSizeRank(weapon.minSize);
    if (sizeRank < minRank) return false;
  }

  if (weapon.maxSize) {
    const maxRank = getCreatureSizeRank(weapon.maxSize);
    if (sizeRank > maxRank) return false;
  }

  return true;
}

export function getWeaponSizePolicy(weapon, combatant) {
  const scale = getWeaponScale(combatant);

  return {
    creatureSize: scale.creatureSize,
    sizeRank: scale.sizeRank,
    weaponName: weapon?.name || "",
    canUse: canUseWeaponBySize(weapon, combatant),
    damageScale: scale.damageScale,
    weightMultiplier: scale.weightMultiplier,
    lengthMultiplier: scale.lengthMultiplier,
    reachModifier: scale.reachModifier,
    policy: "neutral-size",
  };
}

export default {
  CREATURE_SIZE,
  getCreatureSize,
  isTinyCreature,
  isSmallCreature,
  isMediumCreature,
  isLargeCreature,
  isHugeCreature,
  isGargantuanCreature,
  getCreatureSizeRank,
  getCreatureSizeLabel,
  getLegacyWeaponSizeCompatibility,
  getWeaponScale,
  getNeutralWeaponDamage,
  getNeutralWeaponWeight,
  getNeutralWeaponLength,
  canUseWeaponBySize,
  getWeaponSizePolicy,
};
