import { calculateAbilityModifier, PUBLIC_ABILITIES } from "./publicAbilityScores.js";
import { getPublicClassById, getPublicClassByName, getPublicSkillById, getPublicSkills } from "./publicClassAdapter.js";

const HIT_DIE_MAX = {
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
};

const ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === "function") return value.toObject();
  return value;
};

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeId = (value) => String(value || "").trim().toLowerCase();

export function formatSignedModifier(value) {
  const number = toFiniteNumber(value);
  return `${number >= 0 ? "+" : ""}${number}`;
}

export function getPublicProficiencyBonus(level = 1) {
  const safeLevel = Math.max(1, toFiniteNumber(level, 1));
  return Math.min(6, Math.max(2, Math.ceil(safeLevel / 4) + 1));
}

export function calculatePublicDerivedStats({
  level = 1,
  publicClassId = "",
  publicClassName = "",
  finalAbilityScores = {},
  abilityModifiers = {},
  publicSkillProficiencies = [],
} = {}) {
  const classEntry =
    getPublicClassById(publicClassId) ||
    getPublicClassByName(publicClassName) ||
    null;
  const scores = toPlainObject(finalAbilityScores);
  const suppliedModifiers = toPlainObject(abilityModifiers);
  const modifiers = PUBLIC_ABILITIES.reduce((acc, ability) => {
    if (suppliedModifiers[ability.id] !== undefined && suppliedModifiers[ability.id] !== null) {
      acc[ability.id] = toFiniteNumber(suppliedModifiers[ability.id]);
      return acc;
    }
    if (scores[ability.id] !== undefined && scores[ability.id] !== null) {
      acc[ability.id] = calculateAbilityModifier(scores[ability.id]);
    }
    return acc;
  }, {});

  const proficiencyBonus = getPublicProficiencyBonus(level);
  const hitDie = classEntry?.hitDie || "d8";
  const hitDieMaximum = HIT_DIE_MAX[hitDie] || 8;
  const hitPoints = Math.max(1, hitDieMaximum + (modifiers.con || 0));
  const skillProficiencySet = new Set((publicSkillProficiencies || []).map(normalizeId));
  const saveProficiencySet = new Set((classEntry?.savingThrowProficiencies || []).map(normalizeId));

  const savingThrows = PUBLIC_ABILITIES.reduce((acc, ability) => {
    const proficient = saveProficiencySet.has(ability.id);
    const modifier = modifiers[ability.id] || 0;
    acc[ability.id] = {
      label: ABILITY_LABELS[ability.id] || ability.name,
      modifier,
      proficient,
      total: modifier + (proficient ? proficiencyBonus : 0),
    };
    return acc;
  }, {});

  const skills = getPublicSkills().map((skill) => {
    const modifier = modifiers[skill.ability] || 0;
    const proficient = skillProficiencySet.has(skill.id);
    return {
      id: skill.id,
      name: skill.name,
      ability: skill.ability,
      modifier,
      proficient,
      total: modifier + (proficient ? proficiencyBonus : 0),
    };
  });

  const perception = skills.find((skill) => skill.id === "perception");

  return {
    level: Math.max(1, toFiniteNumber(level, 1)),
    proficiencyBonus,
    hitPoints,
    hitDie,
    initiative: modifiers.dex || 0,
    baseArmorClass: 10 + (modifiers.dex || 0),
    armorClassLabel: "Base AC",
    passivePerception: 10 + (perception?.total || modifiers.wis || 0),
    savingThrows,
    skills,
    basicAttackSummaries: [],
  };
}

export function getPublicDerivedStatsForCharacter(character = {}) {
  if (character.publicDerivedStats) {
    return character.publicDerivedStats;
  }

  const hasPublicSheetData =
    character.publicClassId ||
    character.publicClassName ||
    character.finalAbilityScores ||
    character.publicSkillProficiencies?.length;
  if (!hasPublicSheetData) {
    return null;
  }

  return calculatePublicDerivedStats({
    level: character.level,
    publicClassId: character.publicClassId,
    publicClassName: character.publicClassName,
    finalAbilityScores: character.finalAbilityScores,
    abilityModifiers: character.abilityModifiers,
    publicSkillProficiencies: character.publicSkillProficiencies,
  });
}

export default {
  calculatePublicDerivedStats,
  formatSignedModifier,
  getPublicDerivedStatsForCharacter,
  getPublicProficiencyBonus,
};
