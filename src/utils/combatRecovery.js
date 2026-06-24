import { getFatigueLabel } from "./combatStamina.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toPositiveNumber = (value) => {
  const number = toNumber(value);
  return number !== null && number > 0 ? number : null;
};

export function getRecoveryAmount(_combatant = {}, action = {}) {
  return (
    toPositiveNumber(action?.recoveryAmount) ??
    toPositiveNumber(action?.metadata?.recoveryAmount) ??
    2
  );
}

export function applyStaminaRecovery(combatantOrTurnEntry = {}, amount = 2) {
  const maxStamina = toPositiveNumber(
    combatantOrTurnEntry?.maxStamina ??
    combatantOrTurnEntry?.fatigueState?.maxStamina
  );
  const currentStamina = toNumber(
    combatantOrTurnEntry?.currentStamina ??
    combatantOrTurnEntry?.fatigueState?.currentStamina
  );
  const missingFields = [];

  if (currentStamina === null || currentStamina < 0) missingFields.push("currentStamina");
  if (maxStamina === null) missingFields.push("maxStamina");

  if (missingFields.length > 0) {
    return {
      ok: false,
      updated: { ...combatantOrTurnEntry },
      missingFields,
      message: `Missing: ${missingFields.join(", ")}`,
    };
  }

  if (currentStamina >= maxStamina) {
    return {
      ok: false,
      updated: { ...combatantOrTurnEntry },
      oldStamina: currentStamina,
      newStamina: maxStamina,
      maxStamina,
      recovered: 0,
      missingFields: [],
      message: "Stamina already full.",
    };
  }

  const recoveryAmount = getRecoveryAmount(combatantOrTurnEntry, { recoveryAmount: amount });
  const newStamina = Math.min(maxStamina, currentStamina + recoveryAmount);
  const recovered = newStamina - currentStamina;
  const fatigueLabel = getFatigueLabel(newStamina, maxStamina);
  const updated = {
    ...combatantOrTurnEntry,
    currentStamina: newStamina,
    maxStamina,
    fatigueLabel,
  };

  if (combatantOrTurnEntry?.fatigueState && typeof combatantOrTurnEntry.fatigueState === "object") {
    updated.fatigueState = {
      ...combatantOrTurnEntry.fatigueState,
      currentStamina: newStamina,
      maxStamina,
      fatigueLabel,
    };
  }

  return {
    ok: recovered > 0,
    updated,
    oldStamina: currentStamina,
    newStamina,
    maxStamina,
    recovered,
    missingFields: [],
    message: `Recover ${recovered} stamina.`,
  };
}

export default {
  applyStaminaRecovery,
  getRecoveryAmount,
};
