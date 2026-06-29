import { getPublicDerivedStatsForCharacter } from "./publicDerivedStats.js";
import { buildPublicPlayerAttackPreviews } from "./publicPlayerAttackPreview.js";
import { addOriginalActorMetadata } from "./originalActorMetadata.js";

const PUBLIC_TO_COMPATIBILITY_ATTRIBUTES = {
  str: "PS",
  dex: "PP",
  con: "PE",
  int: "IQ",
  wis: "ME",
  cha: "MA",
};

const toPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === "function") return value.toObject();
  return value;
};

const toFiniteNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const firstPlainObject = (...values) => {
  for (const value of values) {
    const plain = toPlainObject(value);
    if (plain && typeof plain === "object" && Object.keys(plain).length > 0) {
      return plain;
    }
  }
  return {};
};

export function buildCompatibilityAttributesFromPublicCharacter(character = {}) {
  const existingAttributes = toPlainObject(character.attributes);
  const publicScores = firstPlainObject(
    character.finalAbilityScores,
    character.publicAbilityScores,
    character.abilityScores
  );
  const attributes = { ...existingAttributes };

  Object.entries(PUBLIC_TO_COMPATIBILITY_ATTRIBUTES).forEach(([publicKey, compatibilityKey]) => {
    const score = toFiniteNumber(publicScores[publicKey]);
    if (score !== null) {
      attributes[compatibilityKey] = score;
    }
  });

  if (attributes.PB === undefined || attributes.PB === null) {
    attributes.PB = attributes.MA ?? 10;
  }
  if (attributes.Spd === undefined || attributes.Spd === null) {
    attributes.Spd = toFiniteNumber(character.speed, attributes.PP ?? 10);
  }

  return attributes;
}

export function isSavedCharacterCombatData(character = {}) {
  return Boolean(
    character?.source === "saved-character" ||
    character?.publicDisplaySource === "saved-character" ||
    character?.generated === false
  );
}

export function getPlayableCharacterImportLogLines(character = {}, name = "Combatant") {
  const safeName = String(name || character?.name || "Combatant");
  if (isSavedCharacterCombatData(character)) {
    return [
      `Loaded saved character ${safeName}.`,
      "Loaded saved character attributes from Character List.",
    ];
  }
  return [`Auto-rolled ${safeName}:`];
}

export function adaptPublicCharacterForAutoRoll(character = {}) {
  const missingRequiredFields = [];
  const finalAbilityScores = firstPlainObject(
    character.finalAbilityScores,
    character.publicAbilityScores,
    character.abilityScores
  );
  const abilityModifiers = firstPlainObject(
    character.abilityModifiers,
    character.publicAbilityModifiers
  );
  const attributes = buildCompatibilityAttributesFromPublicCharacter(character);
  const derivedStats =
    character.publicDerivedStats ||
    character.derivedStats ||
    getPublicDerivedStatsForCharacter({
      ...character,
      finalAbilityScores,
      abilityModifiers,
    });
  const hasClass = Boolean(character.publicClassName || character.class || character.profession);
  const hasSpecies = Boolean(character.publicSpeciesName || character.species || character.race || character.category);

  ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"].forEach((key) => {
    if (attributes[key] === undefined || attributes[key] === null || attributes[key] === "") {
      missingRequiredFields.push(`attribute ${key}`);
    }
  });
  if (!hasClass) missingRequiredFields.push("class");
  if (!hasSpecies) missingRequiredFields.push("species");
  if (!derivedStats?.hitPoints && !character.hp && !character.HP) missingRequiredFields.push("hit points");

  if (missingRequiredFields.length > 0) {
    return {
      ready: false,
      missingRequiredFields,
      combatCharacter: null,
    };
  }

  const attributeDice = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, String(toFiniteNumber(value, 10))])
  );
  const hitPoints = toFiniteNumber(derivedStats?.hitPoints, toFiniteNumber(character.hp, toFiniteNumber(character.HP, 10)));
  const baseArmorClass = toFiniteNumber(
    derivedStats?.baseArmorClass,
    toFiniteNumber(character.guardRating, toFiniteNumber(character.ac, 10))
  );
  const speed = toFiniteNumber(character.speed, toFiniteNumber(attributes.Spd, 10));
  const publicAttackPreviews = buildPublicPlayerAttackPreviews({
    ...character,
    publicDerivedStats: derivedStats,
  });

  const combatCharacter = addOriginalActorMetadata({
      ...character,
      id: character.id || character._id || `public-${character.name || "character"}`,
      name: character.name || "Public Character",
      race: character.publicSpeciesName || character.species || character.race || character.category || "Human",
      species: character.publicSpeciesName || character.species || character.race || character.category || "Human",
      class: character.publicClassName || character.class || character.profession || "Adventurer",
      profession: character.publicClassName || character.class || character.profession || "Adventurer",
      category: character.category || "public-character",
      playable: true,
      attributes,
      attribute_dice: attributeDice,
      HP: hitPoints,
      hp: hitPoints,
      guardRating: baseArmorClass,
      ac: baseArmorClass,
      Spd: speed,
      spd: speed,
      alignment_options: character.alignment ? [character.alignment] : undefined,
      finalAbilityScores,
      abilityModifiers,
      publicAbilityScores: finalAbilityScores,
      publicAbilityModifiers: abilityModifiers,
      publicDisplaySource: "saved-character",
      publicDerivedStats: derivedStats,
      publicLanguages: character.publicLanguages || [],
      publicSkillProficiencies: character.publicSkillProficiencies || [],
      publicStartingEquipment: character.publicStartingEquipment,
      publicAttackPreviews,
      attacks: character.attacks || [{ name: "Unarmed Attack", damage: "1d4", count: 1 }],
      bonuses: character.bonuses || {},
      source: "saved-character",
      sourceCharacterId: character.id || character._id || character.characterId,
      generated: false,
      special_abilities: character.special_abilities || [],
      training: character.training || [],
      tactics: character.tactics || [],
    });

  return {
    ready: true,
    missingRequiredFields: [],
    combatCharacter,
  };
}

export default {
  adaptPublicCharacterForAutoRoll,
  buildCompatibilityAttributesFromPublicCharacter,
  getPlayableCharacterImportLogLines,
  isSavedCharacterCombatData,
};
