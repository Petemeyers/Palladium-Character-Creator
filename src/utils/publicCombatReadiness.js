import {
  adaptPublicEnemyToCombatant,
  buildPublicEnemyActionPreview,
} from "./publicEnemyCombatAdapter.js";
import { buildPublicPlayerAttackPreviews } from "./publicPlayerAttackPreview.js";

const REQUIRED_COMPATIBILITY_ATTRIBUTES = ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"];
const REQUIRED_PUBLIC_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const hasValue = (value) => value !== undefined && value !== null && value !== "";
const hasArrayValue = (value) => Array.isArray(value) && value.length > 0;

const pushMissing = (missing, condition, field) => {
  if (!condition) missing.push(field);
};

const firstValue = (...values) => values.find(hasValue);

const valueAtPath = (entry, path) => {
  if (!entry || !path) return undefined;
  return path.split(".").reduce((current, key) => current?.[key], entry);
};

const firstPathValue = (entry, paths) => {
  for (const path of paths) {
    const value = valueAtPath(entry, path);
    if (hasValue(value)) return value;
  }
  return undefined;
};

const hasAnyPathValue = (entry, paths) => hasValue(firstPathValue(entry, paths));

const hasCompletePublicAbilities = (scores = {}) =>
  REQUIRED_PUBLIC_ABILITIES.every((ability) => hasValue(scores?.[ability]));

const hasCompleteCompatibilityAttributes = (attributes = {}) =>
  REQUIRED_COMPATIBILITY_ATTRIBUTES.every((attribute) => hasValue(attributes?.[attribute]));

const hasAttackMetadata = (entry = {}) =>
  hasArrayValue(entry.attacks) ||
  hasArrayValue(entry.actions) ||
  hasArrayValue(entry.equistaminadWeapons) ||
  hasArrayValue(entry.equippedWeapons) ||
  hasArrayValue(entry.autoRollCharacter?.attacks) ||
  hasArrayValue(entry.autoRollCharacter?.actions) ||
  hasArrayValue(entry.autoRollCharacter?.equistaminadWeapons);

const normalizeMissing = (fields = []) =>
  [...new Set(fields.filter(Boolean).map((field) => String(field)))];

const formatValue = (value, fallback = "Missing") => {
  if (!hasValue(value)) return fallback;
  if (Array.isArray(value)) return value.map((item) => formatValue(item, "")).filter(Boolean).join(", ") || fallback;
  if (typeof value === "object") {
    if (hasValue(value.name)) return String(value.name);
    if (hasValue(value.label)) return String(value.label);
    if (hasValue(value.type)) return String(value.type);
    return fallback;
  }
  return String(value);
};

const getActionPreviews = (entry = {}, side = "") => {
  if (side === "player") {
    if (hasArrayValue(entry.publicAttackPreviews)) return entry.publicAttackPreviews;
    if (hasArrayValue(entry.autoRollCharacter?.publicAttackPreviews)) return entry.autoRollCharacter.publicAttackPreviews;
    return buildPublicPlayerAttackPreviews(entry);
  }

  const publicEnemyActions = entry.publicEnemyMetadata?.actions;
  if (hasArrayValue(publicEnemyActions)) {
    return publicEnemyActions.map(buildPublicEnemyActionPreview);
  }

  if (hasArrayValue(entry.actions)) {
    return entry.actions.map(buildPublicEnemyActionPreview);
  }

  if (hasArrayValue(entry.attacks)) {
    return entry.attacks.map((attack) => (
      attack?.actionPreview
        ? buildPublicEnemyActionPreview(attack.actionPreview)
        : buildPublicEnemyActionPreview(attack)
    ));
  }

  if (hasArrayValue(entry.autoRollCharacter?.attacks)) {
    return entry.autoRollCharacter.attacks.map(buildPublicEnemyActionPreview);
  }

  return [];
};

export function getEncounterCombatantSource(entry = {}) {
  if (
    entry.source === "saved-character" ||
    entry.publicDisplaySource === "saved-character" ||
    entry.autoRollCharacter?.publicDisplaySource === "saved-character" ||
    entry.autoRollCharacter
  ) {
    return "saved character";
  }
  if (entry.source === "public-enemy" || entry.publicEnemyMetadata) {
    return "public enemy";
  }
  if (entry.source === "static-roster" || entry.staticRoster || entry.arenaRosterId) {
    return "static roster";
  }
  return "compatibility";
}

export function getEncounterCombatantSide(entry = {}) {
  const side = entry.side || entry.type || entry.autoRollCharacter?.side || entry.autoRollCharacter?.type;
  if (side === "player" || entry.playable === true || entry.autoRollCharacter?.playable === true) return "player";
  if (side === "enemy" || entry.source === "public-enemy" || entry.publicEnemyMetadata) return "enemy";
  return side || "";
}

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
  pushMissing(missing, hasAttackMetadata(entry), "attacks");

  return {
    ready: missing.length === 0,
    missing: normalizeMissing(missing),
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
    missing: normalizeMissing(missing),
    missingArenaShape: normalizeMissing(missingArenaShape),
    warnings: conversion.warnings,
    recommendedPath: "Map public enemy metadata to the existing arena roster enemy shape before calling live combat add paths.",
  };
}

export function checkEncounterCombatantReadiness(entry = {}) {
  const side = getEncounterCombatantSide(entry);
  const missing = [];

  pushMissing(missing, hasValue(firstValue(entry.name, entry.autoRollCharacter?.name)), "name");

  if (side === "player") {
    const publicScores = entry.publicAbilityScores || entry.finalAbilityScores || entry.autoRollCharacter?.publicAbilityScores || {};
    const compatibilityAttributes =
      entry.compatibilityAttributes ||
      entry.attributes ||
      entry.autoRollCharacter?.attributes ||
      {};

    pushMissing(missing, side === "player", "side/player flag");
    pushMissing(
      missing,
      hasAnyPathValue(entry, [
        "HP",
        "hp",
        "currentHP",
        "maxHP",
        "publicDerivedStats.hitPoints",
        "autoRollCharacter.HP",
        "autoRollCharacter.hp",
        "autoRollCharacter.publicDerivedStats.hitPoints",
      ]),
      "HP"
    );
    pushMissing(
      missing,
      hasAnyPathValue(entry, [
        "armorClass",
        "ac",
        "baseArmorClass",
        "guardRating",
        "publicDerivedStats.baseArmorClass",
        "autoRollCharacter.armorClass",
        "autoRollCharacter.ac",
        "autoRollCharacter.guardRating",
        "autoRollCharacter.publicDerivedStats.baseArmorClass",
      ]),
      "AC or Guard"
    );
    pushMissing(
      missing,
      hasAnyPathValue(entry, ["speed", "Spd", "spd", "attributes.Spd", "attributes.spd", "autoRollCharacter.speed", "autoRollCharacter.Spd", "autoRollCharacter.spd", "autoRollCharacter.attributes.Spd"]),
      "speed"
    );
    pushMissing(
      missing,
      hasCompletePublicAbilities(publicScores) || hasCompleteCompatibilityAttributes(compatibilityAttributes),
      "ability scores or compatibility attributes"
    );
    pushMissing(missing, hasAttackMetadata(entry), "attacks");
  } else if (side === "enemy") {
    pushMissing(missing, side === "enemy", "side/enemy flag");
    pushMissing(missing, hasAnyPathValue(entry, ["HP", "hp", "hitPoints", "currentHP", "maxHP"]), "HP");
    pushMissing(missing, hasAnyPathValue(entry, ["guardRating", "armorClass", "ac"]), "AC or Guard");
    pushMissing(missing, hasAnyPathValue(entry, ["speed", "Spd", "spd", "attributes.Spd", "attributes.spd"]), "speed");
    pushMissing(missing, hasAnyPathValue(entry, ["size", "sizeCategory"]), "size");
    pushMissing(missing, hasAnyPathValue(entry, ["category", "creatureType", "combatantType"]), "category/creatureType");
    pushMissing(missing, hasAttackMetadata(entry), "attacks");
  } else {
    pushMissing(missing, false, "side");
  }

  return {
    ready: normalizeMissing(missing).length === 0,
    missing: normalizeMissing(missing),
  };
}

export function getEncounterReadinessSummary(entry = {}) {
  const side = getEncounterCombatantSide(entry);
  const readiness = checkEncounterCombatantReadiness(entry);
  const source = getEncounterCombatantSource(entry);
  const derivedStats = entry.publicDerivedStats || entry.autoRollCharacter?.publicDerivedStats || {};
  const publicEnemyMetadata = entry.publicEnemyMetadata || {};

  return {
    name: formatValue(firstValue(entry.name, entry.autoRollCharacter?.name), "Unnamed"),
    side: side === "player" ? "Player" : side === "enemy" ? "Enemy" : "Unknown",
    source,
    sourceLabel: source === "compatibility" ? "Compatibility combatant" : source,
    hp: formatValue(firstPathValue(entry, ["HP", "hp", "hitPoints", "currentHP", "maxHP", "publicDerivedStats.hitPoints", "autoRollCharacter.HP", "autoRollCharacter.hp", "autoRollCharacter.publicDerivedStats.hitPoints"])),
    acOrGuard: formatValue(firstPathValue(entry, ["armorClass", "ac", "baseArmorClass", "guardRating", "publicDerivedStats.baseArmorClass", "autoRollCharacter.armorClass", "autoRollCharacter.ac", "autoRollCharacter.guardRating", "autoRollCharacter.publicDerivedStats.baseArmorClass"])),
    speed: formatValue(firstPathValue(entry, ["speed", "Spd", "spd", "attributes.Spd", "attributes.spd", "autoRollCharacter.speed", "autoRollCharacter.Spd", "autoRollCharacter.spd", "autoRollCharacter.attributes.Spd"])),
    size: formatValue(firstPathValue(entry, ["size", "sizeCategory", "autoRollCharacter.size", "autoRollCharacter.sizeCategory"])),
    category: formatValue(firstPathValue(entry, ["category", "creatureType", "combatantType", "autoRollCharacter.category", "autoRollCharacter.creatureType"])),
    publicClassName: formatValue(firstValue(entry.publicClassName, entry.autoRollCharacter?.publicClassName, entry.class, entry.profession), ""),
    publicSpeciesName: formatValue(firstValue(entry.publicSpeciesName, entry.autoRollCharacter?.publicSpeciesName, entry.species, entry.race), ""),
    publicBackgroundName: formatValue(firstValue(entry.publicBackgroundName, entry.autoRollCharacter?.publicBackgroundName, entry.background, entry.socialBackground), ""),
    enemyCreatureType: formatValue(firstValue(entry.creatureType, publicEnemyMetadata.creatureType, entry.category), ""),
    proficiencyBonus: formatValue(firstValue(derivedStats.proficiencyBonus, entry.proficiencyBonus, publicEnemyMetadata.proficiencyBonus), ""),
    actionPreviews: getActionPreviews(entry, side),
    ready: readiness.ready,
    missing: readiness.missing,
  };
}

export default {
  checkPublicEnemyCombatReadiness,
  checkPublicPlayerCombatReadiness,
  checkEncounterCombatantReadiness,
  getEncounterCombatantSide,
  getEncounterCombatantSource,
  getEncounterReadinessSummary,
};
