import { adaptPublicEnemyToCombatant } from "./publicEnemyCombatAdapter.js";

const REQUIRED_COMPATIBILITY_ATTRIBUTES = ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"];
const REQUIRED_PUBLIC_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const pushMissing = (missing, condition, field) => {
  if (!condition) missing.push(field);
};

export function checkPublicPlayerCombatReadiness(entry = {}) {
  const missing = [];
  const autoRollCharacter = entry.autoRollCharacter || {};
  const publicScores = entry.publicAbilityScores || entry.finalAbilityScores || {};
  const derivedStats = entry.publicDerivedStats || autoRollCharacter.publicDerivedStats || {};
  const compatibilityAttributes = entry.compatibilityAttributes || autoRollCharacter.attributes || {};
  const attributeDice = entry.attribute_dice || autoRollCharacter.attribute_dice || {};

  pushMissing(missing, entry.side === "player", "side: player");
  pushMissing(missing, hasValue(entry.id || entry._id || autoRollCharacter.id || autoRollCharacter._id), "id");
  pushMissing(missing, hasValue(entry.name || autoRollCharacter.name), "name");
  pushMissing(missing, hasValue(entry.publicClassName || autoRollCharacter.publicClassName), "publicClassName");
  pushMissing(missing, hasValue(entry.publicSpeciesName || autoRollCharacter.publicSpeciesName), "publicSpeciesName");

  REQUIRED_PUBLIC_ABILITIES.forEach((ability) => {
    pushMissing(missing, hasValue(publicScores[ability]), `publicAbilityScores.${ability}`);
  });

  REQUIRED_COMPATIBILITY_ATTRIBUTES.forEach((attribute) => {
    pushMissing(missing, hasValue(compatibilityAttributes[attribute]), `compatibilityAttributes.${attribute}`);
    pushMissing(missing, hasValue(attributeDice[attribute]), `attribute_dice.${attribute}`);
  });

  pushMissing(missing, hasValue(derivedStats.hitPoints || autoRollCharacter.HP || autoRollCharacter.hp), "hit points");
  pushMissing(missing, hasValue(derivedStats.baseArmorClass || autoRollCharacter.guardRating || autoRollCharacter.ac), "armor class");
  pushMissing(missing, hasValue(autoRollCharacter.playable), "autoRollCharacter.playable");

  return {
    ready: missing.length === 0,
    missing,
    recommendedPath: "Use autoRollCharacter with the existing playable addCombatant path and a player side override.",
  };
}

export function checkPublicEnemyCombatReadiness(entry = {}) {
  const missing = [];
  const conversion = adaptPublicEnemyToCombatant(entry);

  pushMissing(missing, entry.side === "enemy", "side: enemy");
  pushMissing(missing, hasValue(entry.id), "id");
  pushMissing(missing, hasValue(entry.name), "name");
  pushMissing(missing, hasValue(entry.creatureType), "creatureType");
  pushMissing(missing, hasValue(entry.size), "size");
  pushMissing(missing, hasValue(entry.armorClass), "armorClass");
  pushMissing(missing, hasValue(entry.hitPoints), "hitPoints");
  pushMissing(missing, hasValue(entry.speed), "speed");
  pushMissing(missing, entry.abilityScores && REQUIRED_PUBLIC_ABILITIES.every((ability) => hasValue(entry.abilityScores[ability])), "abilityScores");
  pushMissing(missing, Array.isArray(entry.actions) && entry.actions.length > 0, "actions");

  const missingArenaShape = conversion.ok ? [] : [...conversion.missingFields];

  return {
    metadataReady: missing.length === 0,
    ready: missing.length === 0 && missingArenaShape.length === 0,
    missing,
    missingArenaShape,
    warnings: conversion.warnings,
    recommendedPath: "Map public enemy metadata to the existing arena roster enemy shape before calling live combat add paths.",
  };
}

export default {
  checkPublicEnemyCombatReadiness,
  checkPublicPlayerCombatReadiness,
};
