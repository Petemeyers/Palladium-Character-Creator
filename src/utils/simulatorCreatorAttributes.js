import {
  FIXED_SIMULATOR_ATTRIBUTE_DEFAULTS,
  ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS,
  SIMULATOR_ATTRIBUTE_DEFINITIONS,
} from "../data/simulatorAttributes.js";
import {
  mapSourceAttributeRollsToSimulatorBase,
  resolveSpeciesAttributeDiceProfile,
  SIMULATOR_ATTRIBUTE_TO_SOURCE_ABBREV,
  SOURCE_ABBREV_TO_SIMULATOR_ATTRIBUTES,
} from "../data/simulatorAttributeDice.js";
import { rollDiceDetailed } from "./dice.js";

export {
  FIXED_SIMULATOR_ATTRIBUTE_DEFAULTS,
  ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS,
  SIMULATOR_ATTRIBUTE_DEFINITIONS,
};

export const CLASSIC_ABILITY_TO_SIMULATOR = Object.freeze({
  str: "might",
  dex: "deftness",
  con: "vigor",
  int: "intellect",
  wis: "awareness",
  cha: "presence",
});

export const SIMULATOR_TO_CLASSIC_ABILITY = Object.freeze({
  might: "str",
  deftness: "dex",
  vigor: "con",
  endurance: "con",
  mobility: "dex",
  intellect: "int",
  awareness: "wis",
  cunning: "wis",
  resolve: "wis",
  discipline: "wis",
  presence: "cha",
});

const LABEL_BY_KEY = Object.freeze(
  Object.fromEntries(SIMULATOR_ATTRIBUTE_DEFINITIONS.map(([key, label]) => [key, label])),
);

const toFiniteScore = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export function getSimulatorAttributeLabel(key) {
  return LABEL_BY_KEY[key] || String(key || "");
}

export function calculateSimulatorAttributeModifier(score) {
  return Math.floor(((toFiniteScore(score) ?? 10) - 10) / 2);
}

export function rollSourceAttributeDice(attributeDice = {}, { rollNotation } = {}) {
  const roll = rollNotation || ((notation) => rollDiceDetailed(notation).total);
  return Object.fromEntries(
    Object.entries(attributeDice).map(([abbrev, notation]) => [abbrev, roll(notation)]),
  );
}

export function rollSimulatorBaseAttributesFromProfile({
  species = "",
  publicSpeciesId = "",
  profile = null,
  rollNotation,
} = {}) {
  const attributeDice = resolveSpeciesAttributeDiceProfile({
    species,
    publicSpeciesId,
    profile,
  });
  const sourceRolls = rollSourceAttributeDice(attributeDice, { rollNotation });
  return mapSourceAttributeRollsToSimulatorBase(sourceRolls);
}

export function rollSimulatorBaseAttributes({
  rollDie = () => Math.floor(Math.random() * 6) + 1,
  keys = ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS,
  species = "",
  publicSpeciesId = "",
  profile = null,
} = {}) {
  if (species || publicSpeciesId || profile) {
    return rollSimulatorBaseAttributesFromProfile({
      species,
      publicSpeciesId,
      profile,
      rollNotation: (notation) => {
        const match = String(notation).trim().match(/^(\d*)d(\d+)$/i);
        if (!match) return rollDiceDetailed(notation).total;
        const count = Number(match[1] || 1);
        const sides = Number(match[2]);
        return Array.from({ length: count }, rollDie).reduce((sum, value) => sum + value, 0);
      },
    });
  }

  const roll3d6 = () => Array.from({ length: 3 }, rollDie).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(keys.map((key) => [key, roll3d6()]));
}

export function hasBaseSimulatorAttributes(baseScores = {}) {
  return ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.every((key) => toFiniteScore(baseScores[key]) !== undefined);
}

export function calculateBackgroundAttributeBonuses({
  mode = "split",
  options = [],
  plusTwoAttribute = "",
  plusOneAttribute = "",
} = {}) {
  const optionSet = new Set(options);
  const bonuses = {};

  if (mode === "all") {
    options.slice(0, 3).forEach((attributeId) => {
      bonuses[attributeId] = 1;
    });
    return bonuses;
  }

  if (plusTwoAttribute && optionSet.has(plusTwoAttribute)) {
    bonuses[plusTwoAttribute] = 2;
  }
  if (plusOneAttribute && optionSet.has(plusOneAttribute) && plusOneAttribute !== plusTwoAttribute) {
    bonuses[plusOneAttribute] = 1;
  }

  return bonuses;
}

export function calculateFinalSimulatorAttributes(baseScores = {}, bonuses = {}) {
  const finalScores = {
    ...FIXED_SIMULATOR_ATTRIBUTE_DEFAULTS,
  };

  ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.forEach((key) => {
    const base = toFiniteScore(baseScores[key]);
    if (base === undefined) return;
    finalScores[key] = Math.min(20, base + (bonuses[key] || 0));
  });

  return finalScores;
}

export function convertSimulatorToClassicAbilityScores(finalScores = {}) {
  return Object.entries(SIMULATOR_TO_CLASSIC_ABILITY).reduce((acc, [simulatorKey, classicKey]) => {
    const score = toFiniteScore(finalScores[simulatorKey]);
    if (score === undefined) return acc;
    if (acc[classicKey] === undefined || score > acc[classicKey]) {
      acc[classicKey] = score;
    }
    return acc;
  }, {});
}

export function convertSimulatorToCompatibilityAttributes(finalScores = {}) {
  const classic = convertSimulatorToClassicAbilityScores(finalScores);
  const legacy = {
    PS: classic.str ?? 10,
    PP: classic.dex ?? 10,
    PE: classic.con ?? 10,
    IQ: classic.int ?? 10,
    ME: classic.wis ?? 10,
    MA: classic.cha ?? 10,
  };
  legacy.PB = legacy.MA;
  legacy.Spd = toFiniteScore(finalScores.mobility) ?? legacy.PP;
  legacy.total = legacy.PS + legacy.PP + legacy.PE + legacy.IQ + legacy.ME + legacy.MA + legacy.PB + legacy.Spd;
  return legacy;
}

function mapLegacyAbbreviationAttributes(legacy = {}) {
  const mapped = {};
  Object.entries(SOURCE_ABBREV_TO_SIMULATOR_ATTRIBUTES).forEach(([abbrev, targets]) => {
    const score = toFiniteScore(legacy[abbrev]);
    if (score === undefined) return;
    targets.forEach((key) => {
      if (ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.includes(key) && mapped[key] === undefined) {
        mapped[key] = score;
      }
    });
  });
  return mapped;
}

export function normalizeCreatorSimulatorAttributes(character = {}) {
  const direct = character?.simulatorAttributes || character?.originalActorMetadata?.attributes;
  if (direct && typeof direct === "object" && hasBaseSimulatorAttributes(direct)) {
    return {
      ...FIXED_SIMULATOR_ATTRIBUTE_DEFAULTS,
      ...direct,
    };
  }

  const classicScores = character?.finalAbilityScores || character?.publicAbilityScores || character?.abilityScores;
  if (classicScores && typeof classicScores === "object") {
    const mapped = {};
    Object.entries(CLASSIC_ABILITY_TO_SIMULATOR).forEach(([classicKey, simulatorKey]) => {
      const score = toFiniteScore(classicScores[classicKey]);
      if (score !== undefined) mapped[simulatorKey] = score;
    });
    if (hasBaseSimulatorAttributes(mapped)) {
      return calculateFinalSimulatorAttributes(mapped, {});
    }
  }

  const legacy = character?.attributes || character?.compatibilityAttributes;
  if (legacy && typeof legacy === "object") {
    const mapped = mapLegacyAbbreviationAttributes(legacy);
    if (hasBaseSimulatorAttributes(mapped)) {
      return calculateFinalSimulatorAttributes(mapped, {});
    }
  }

  return null;
}

export function getBackgroundAttributeOptions(background = {}) {
  if (Array.isArray(background.attributeOptions) && background.attributeOptions.length > 0) {
    return background.attributeOptions;
  }
  return (background.abilityScoreOptions || [])
    .map((option) => CLASSIC_ABILITY_TO_SIMULATOR[option] || option)
    .filter((option) => ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.includes(option));
}

export function getCreatorSectionOrder() {
  return {
    identity: 0,
    attributes: 1,
    class: 2,
    background: 3,
    species: 4,
    languages: 5,
    proficiencies: 6,
    equipment: 7,
    alignment: 8,
    derivedStats: 9,
    review: 10,
    tactics: 11,
  };
}

export { resolveSpeciesAttributeDiceProfile, mapSourceAttributeRollsToSimulatorBase, SIMULATOR_ATTRIBUTE_TO_SOURCE_ABBREV };
