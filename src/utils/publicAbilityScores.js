export const PUBLIC_ABILITIES = [
  { id: "str", name: "Strength", legacyKey: "PS" },
  { id: "dex", name: "Dexterity", legacyKey: "PP" },
  { id: "con", name: "Constitution", legacyKey: "PE" },
  { id: "int", name: "Intelligence", legacyKey: "IQ" },
  { id: "wis", name: "Wisdom", legacyKey: "ME" },
  { id: "cha", name: "Charisma", legacyKey: "MA" },
];

export const STANDARD_ARRAY_SCORES = [15, 14, 13, 12, 10, 8];

export const POINT_COSTS = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function calculateAbilityModifier(score) {
  return Math.floor((Number(score) - 10) / 2);
}

export function rollRandomAbilityScores({ rollDie = () => Math.floor(Math.random() * 6) + 1 } = {}) {
  return Array.from({ length: 6 }, () => {
    const rolls = Array.from({ length: 4 }, rollDie).sort((a, b) => a - b);
    return rolls.slice(1).reduce((sum, value) => sum + value, 0);
  });
}

export function getPointCostTotal(scoresByAbility = {}) {
  return Object.values(scoresByAbility).reduce((total, score) => {
    const cost = POINT_COSTS[Number(score)];
    return total + (cost ?? 0);
  }, 0);
}

export function calculateBackgroundAbilityBonuses({
  mode = "split",
  options = [],
  plusTwoAbility = "",
  plusOneAbility = "",
} = {}) {
  const optionSet = new Set(options);
  const bonuses = {};

  if (mode === "all") {
    options.slice(0, 3).forEach((abilityId) => {
      bonuses[abilityId] = 1;
    });
    return bonuses;
  }

  if (plusTwoAbility && optionSet.has(plusTwoAbility)) {
    bonuses[plusTwoAbility] = 2;
  }
  if (plusOneAbility && optionSet.has(plusOneAbility) && plusOneAbility !== plusTwoAbility) {
    bonuses[plusOneAbility] = 1;
  }

  return bonuses;
}

export function calculateFinalAbilityScores(baseScores = {}, bonuses = {}) {
  return PUBLIC_ABILITIES.reduce((acc, ability) => {
    const base = Number(baseScores[ability.id]);
    if (!Number.isFinite(base)) {
      return acc;
    }
    acc[ability.id] = Math.min(20, base + (bonuses[ability.id] || 0));
    return acc;
  }, {});
}

export function convertPublicScoresToLegacyAttributes(finalScores = {}) {
  const legacy = {};
  PUBLIC_ABILITIES.forEach((ability) => {
    legacy[ability.legacyKey] = Number(finalScores[ability.id]) || 10;
  });
  legacy.PB = legacy.MA;
  legacy.Spd = legacy.PP;
  legacy.total = PUBLIC_ABILITIES.reduce((sum, ability) => sum + (Number(finalScores[ability.id]) || 0), 0);
  return legacy;
}
