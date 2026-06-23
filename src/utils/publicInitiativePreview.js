import {
  getEncounterCombatantSide,
  getEncounterCombatantSource,
} from "./publicCombatReadiness.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatBonus = (value) => {
  const number = toNumber(value);
  if (number === null) return "Missing";
  return number >= 0 ? `+${number}` : String(number);
};

const sourceLabel = (source) => (
  source === "compatibility" ? "Compatibility combatant" : source
);

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return null;
};

const getPublicDexterityModifier = (combatant = {}) => {
  const dexModifier = firstNumber(
    combatant.abilityModifiers?.dex,
    combatant.publicAbilityModifiers?.dex,
    combatant.autoRollCharacter?.abilityModifiers?.dex,
    combatant.autoRollCharacter?.publicAbilityModifiers?.dex,
    combatant.publicDerivedStats?.abilityModifiers?.dex,
    combatant.publicEnemyMetadata?.abilityModifiers?.dex
  );
  if (dexModifier !== null) return { value: dexModifier, source: "public dexterity modifier" };

  const dexScore = firstNumber(
    combatant.finalAbilityScores?.dex,
    combatant.publicAbilityScores?.dex,
    combatant.abilityScores?.dex,
    combatant.autoRollCharacter?.finalAbilityScores?.dex,
    combatant.autoRollCharacter?.publicAbilityScores?.dex,
    combatant.autoRollCharacter?.abilityScores?.dex,
    combatant.publicEnemyMetadata?.abilityScores?.dex
  );
  if (dexScore !== null) {
    return {
      value: Math.floor((dexScore - 10) / 2),
      source: "public dexterity score",
    };
  }

  const compatibilityProwess = firstNumber(
    combatant.compatibilityAttributes?.PP,
    combatant.attributes?.PP,
    combatant.PP,
    combatant.autoRollCharacter?.compatibilityAttributes?.PP,
    combatant.autoRollCharacter?.attributes?.PP,
    combatant.autoRollCharacter?.PP
  );
  if (compatibilityProwess !== null) {
    return {
      value: Math.floor((compatibilityProwess - 10) / 2),
      source: "compatibility PP",
    };
  }

  return { value: null, source: "" };
};

export function buildPublicInitiativePreviewRow(combatant = {}, options = {}) {
  combatant = combatant || {};
  const side = getEncounterCombatantSide(combatant);
  const source = getEncounterCombatantSource(combatant);
  const dexterity = getPublicDexterityModifier(combatant);
  const explicitBonus = firstNumber(
    combatant.initiativeBonus,
    combatant.bonuses?.initiative,
    combatant.autoRollCharacter?.initiativeBonus,
    combatant.autoRollCharacter?.bonuses?.initiative
  ) ?? 0;
  const missingFields = [];

  if (!hasValue(combatant.name || combatant.autoRollCharacter?.name)) missingFields.push("name");
  if (!side) missingFields.push("side");
  if (dexterity.value === null) missingFields.push("dexterity");

  const totalBonus = dexterity.value === null ? null : dexterity.value + explicitBonus;
  const rollValue = typeof options.rollPreview === "function"
    ? toNumber(options.rollPreview(combatant))
    : null;

  return {
    id: String(combatant.id || combatant._id || combatant.autoRollCharacter?.id || combatant.name || "unknown"),
    name: String(combatant.name || combatant.autoRollCharacter?.name || "Unnamed"),
    side: side === "player" ? "player" : side === "enemy" ? "enemy" : "unknown",
    source,
    sourceLabel: sourceLabel(source),
    dexterityModifier: dexterity.value,
    dexteritySource: dexterity.source,
    explicitInitiativeBonus: explicitBonus,
    initiativeBonus: totalBonus,
    initiativeBonusLabel: formatBonus(totalBonus),
    rollPreview: rollValue,
    rollPreviewLabel: rollValue === null || totalBonus === null ? "pending" : String(rollValue + totalBonus),
    status: missingFields.length === 0 ? "ready" : "missing fields",
    missingFields,
  };
}

export function buildPublicInitiativePreviewRows(combatants = [], options = {}) {
  const list = Array.isArray(combatants) ? combatants : [];
  return list.map((combatant) => buildPublicInitiativePreviewRow(combatant, options));
}

export default {
  buildPublicInitiativePreviewRow,
  buildPublicInitiativePreviewRows,
};
