import { addOriginalActorMetadata } from "./originalActorMetadata.js";
import { normalizeReferenceCombatActor } from "./combat/normalizeCombatActorSchema.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toDisplayText = (value) => {
  if (!hasValue(value)) return undefined;
  if (Array.isArray(value)) {
    const rendered = value.map(toDisplayText).filter(Boolean).join(", ");
    return rendered || undefined;
  }
  if (typeof value === "object") {
    if (hasValue(value.name)) return String(value.name);
    if (hasValue(value.label)) return String(value.label);
    if (hasValue(value.type)) return String(value.type);
    return undefined;
  }
  return String(value);
};

const getSaveDisplay = (action = {}) => {
  const save = action.save || action.savingThrow;
  const dc = action.dc ?? action.saveDC ?? action.saveDc ?? save?.dc ?? save?.DC;
  const ability = action.saveAbility || action.ability || save?.ability || save?.type;

  if (!hasValue(dc) && !hasValue(ability)) return undefined;
  if (hasValue(dc) && hasValue(ability)) return `DC ${dc} ${ability}`;
  if (hasValue(dc)) return `DC ${dc}`;
  return toDisplayText(ability);
};

export function buildPublicEnemyActionPreview(action = {}) {
  return {
    name: toDisplayText(action.name) || "Unnamed action",
    attackType: toDisplayText(action.attackType || action.actionType || action.type),
    reach: toDisplayText(action.reach),
    range: toDisplayText(action.range),
    hitBonus: toDisplayText(action.hitBonus ?? action.attackBonus),
    damage: toDisplayText(action.damage || action.damageExpression),
    damageType: toDisplayText(action.damageType),
    save: getSaveDisplay(action),
    notes: toDisplayText(action.notes || action.note || action.description),
  };
}

function convertPublicEnemyAction(action = {}) {
  const missingFields = [];
  if (!hasValue(action.name)) missingFields.push("action.name");
  if (!hasValue(action.damage)) missingFields.push("action.damage");

  if (missingFields.length > 0) {
    return {
      ok: false,
      missingFields,
      metadata: { ...action },
      preview: buildPublicEnemyActionPreview(action),
    };
  }

  return {
    ok: true,
    attack: {
      name: action.name,
      damage: action.damage,
      damageType: action.damageType,
      attackBonus: action.attackBonus,
      count: action.count || 1,
      actionPreview: buildPublicEnemyActionPreview(action),
    },
    preview: buildPublicEnemyActionPreview(action),
  };
}

export function adaptPublicEnemyToCombatant(enemy = {}) {
  const missingFields = [];
  const warnings = [];

  if (!hasValue(enemy.name)) missingFields.push("name");
  if (!hasValue(enemy.hitPoints)) missingFields.push("hitPoints");
  if (!hasValue(enemy.armorClass)) missingFields.push("armorClass");
  if (!hasValue(enemy.size)) missingFields.push("size");
  if (!hasValue(enemy.creatureType)) missingFields.push("creatureType");
  if (!hasValue(enemy.speed)) missingFields.push("speed");
  if (!Array.isArray(enemy.actions) || enemy.actions.length === 0) {
    missingFields.push("actions");
  }

  const convertedActions = Array.isArray(enemy.actions)
    ? enemy.actions.map(convertPublicEnemyAction)
    : [];
  const attacks = convertedActions
    .filter((result) => result.ok)
    .map((result) => result.attack);
  const actionPreviews = convertedActions.map((result) => result.preview);

  convertedActions
    .filter((result) => !result.ok)
    .forEach((result, index) => {
      warnings.push(`Action ${index + 1} is metadata-only: missing ${result.missingFields.join(", ")}`);
    });

  if (Array.isArray(enemy.actions) && enemy.actions.length > 0 && attacks.length === 0) {
    missingFields.push("convertible actions");
  }

  if (missingFields.length > 0) {
    return {
      ok: false,
      combatant: null,
      missingFields,
      warnings,
      source: "public-enemy",
    };
  }

  const compatibilityCombatant = addOriginalActorMetadata({
    id: enemy.id,
    actorKey: enemy.actorKey,
    canonicalActorKey: enemy.canonicalActorKey,
    sourceActorKey: enemy.sourceActorKey || enemy.actorKey,
    pickerId: enemy.pickerId || enemy.id,
    compatibilityId: enemy.compatibilityId,
    sourceEnemyId: enemy.id,
    modelKey: enemy.modelKey,
    name: enemy.name,
    HP: enemy.hitPoints,
    guardRating: enemy.armorClass,
    size: enemy.size,
    category: enemy.creatureType,
    creatureType: enemy.creatureType,
    species: enemy.species,
    speed: enemy.speed,
    spd: enemy.speed,
    abilityScores: enemy.abilityScores ? { ...enemy.abilityScores } : undefined,
    attacks,
    equipment: Array.isArray(enemy.equipment) ? enemy.equipment.map((item) => ({ ...item })) : undefined,
    inventory: Array.isArray(enemy.inventory) ? enemy.inventory.map((item) => ({ ...item })) : undefined,
    weaponProfiles: Array.isArray(enemy.weaponProfiles) ? enemy.weaponProfiles.map((item) => ({ ...item })) : undefined,
    equippedArmor: enemy.equippedArmor ? { ...enemy.equippedArmor } : undefined,
    equippedShield: enemy.equippedShield ? { ...enemy.equippedShield } : undefined,
    armorProfile: enemy.armorProfile ? { ...enemy.armorProfile } : undefined,
    heldItems: enemy.heldItems ? { ...enemy.heldItems } : undefined,
    alignment: enemy.alignment,
    alignmentName: enemy.alignmentName,
    behavior: enemy.behavior ? { ...enemy.behavior } : undefined,
    grappleProfile: enemy.grappleProfile ? { ...enemy.grappleProfile } : undefined,
    surrenderProfile: enemy.surrenderProfile ? { ...enemy.surrenderProfile } : undefined,
    publicEnemyMetadata: {
      creatureType: enemy.creatureType,
      abilityScores: enemy.abilityScores ? { ...enemy.abilityScores } : undefined,
      savingThrows: enemy.savingThrows ? { ...enemy.savingThrows } : undefined,
      skills: enemy.skills ? { ...enemy.skills } : undefined,
      senses: Array.isArray(enemy.senses) ? [...enemy.senses] : undefined,
      languages: Array.isArray(enemy.languages) ? [...enemy.languages] : undefined,
      challengeRating: enemy.challengeRating,
      proficiencyBonus: enemy.proficiencyBonus,
      source: enemy.originalSource || enemy.source,
      ruleset: enemy.ruleset,
      actions: actionPreviews,
    },
    source: "public-enemy",
    ruleset: enemy.ruleset || "core-d20",
    originalActorMetadata: enemy.originalActorMetadata,
  });
  const normalized = normalizeReferenceCombatActor(compatibilityCombatant, { source: "public-enemy-adapter" });
  return {
    ok: true,
    combatant: normalized.normalizedActor,
    missingFields: [],
    warnings,
    source: "public-enemy",
    diagnostics: normalized.diagnostics,
  };
}

export default {
  adaptPublicEnemyToCombatant,
  buildPublicEnemyActionPreview,
};
