import { getDexModifier, normalize5eCombatant } from "./normalize5eCombatant.js";

function firstNumber(...values) {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return undefined;
}

export function getInitiativeModifier(combatant = {}) {
  const normalized = normalize5eCombatant(combatant);
  const dexModifier = firstNumber(normalized.abilityMods?.dex) ?? getDexModifier(normalized);
  const initiativeBonus = firstNumber(combatant?.initiativeBonus) ?? 0;

  return {
    dexModifier,
    initiativeBonus,
    totalModifier: dexModifier + initiativeBonus,
  };
}

export function rollInitiative5e(combatant = {}, options = {}) {
  const d20Roll = firstNumber(options.d20Roll, options.roll) ?? 1;
  const { dexModifier, initiativeBonus, totalModifier } = getInitiativeModifier(combatant);

  return {
    d20Roll,
    dexModifier,
    initiativeBonus,
    totalModifier,
    total: d20Roll + totalModifier,
  };
}
