const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return null;
};

const modifierFromScore = (score) => {
  const number = toNumber(score);
  return number === null ? null : Math.floor((number - 10) / 2);
};

const getConstitutionModifier = (combatant = {}) => {
  const explicitModifier = firstNumber(
    combatant.abilityModifiers?.con,
    combatant.publicAbilityModifiers?.con,
    combatant.autoRollCharacter?.abilityModifiers?.con,
    combatant.autoRollCharacter?.publicAbilityModifiers?.con,
    combatant.publicDerivedStats?.abilityModifiers?.con,
    combatant.publicEnemyMetadata?.abilityModifiers?.con
  );
  if (explicitModifier !== null) return explicitModifier;

  const constitutionScore = firstNumber(
    combatant.finalAbilityScores?.con,
    combatant.publicAbilityScores?.con,
    combatant.abilityScores?.con,
    combatant.autoRollCharacter?.finalAbilityScores?.con,
    combatant.autoRollCharacter?.publicAbilityScores?.con,
    combatant.autoRollCharacter?.abilityScores?.con,
    combatant.publicEnemyMetadata?.abilityScores?.con
  );
  const publicModifier = modifierFromScore(constitutionScore);
  if (publicModifier !== null) return publicModifier;

  return modifierFromScore(firstNumber(
    combatant.compatibilityAttributes?.PE,
    combatant.attributes?.PE,
    combatant.PE,
    combatant.autoRollCharacter?.compatibilityAttributes?.PE,
    combatant.autoRollCharacter?.attributes?.PE,
    combatant.autoRollCharacter?.PE
  ));
};

export function getFatigueLabel(currentStamina, maxStamina) {
  const current = Math.max(0, toNumber(currentStamina) ?? 0);
  const max = Math.max(1, toNumber(maxStamina) ?? 1);

  if (current <= 0) return "Exhausted";
  if (current <= max / 2) return "Winded";
  return "Fresh";
}

export function getDefaultStamina(combatant = {}) {
  const constitutionModifier = getConstitutionModifier(combatant);
  return Math.max(1, 10 + (constitutionModifier ?? 0));
}

export function initializeStamina(combatant = {}) {
  const maxStamina = getDefaultStamina(combatant);

  return {
    ...combatant,
    maxStamina,
    currentStamina: maxStamina,
    fatigueLabel: getFatigueLabel(maxStamina, maxStamina),
  };
}

export function getStaminaState(combatantOrTurnEntry = {}) {
  const maxStamina = Math.max(1, toNumber(combatantOrTurnEntry?.maxStamina) ?? getDefaultStamina(combatantOrTurnEntry));
  const currentStamina = Math.max(
    0,
    Math.min(maxStamina, toNumber(combatantOrTurnEntry?.currentStamina) ?? maxStamina)
  );

  return {
    maxStamina,
    currentStamina,
    fatigueLabel: getFatigueLabel(currentStamina, maxStamina),
  };
}

export function spendStamina(combatantOrTurnEntry = {}, cost = 1) {
  const state = getStaminaState(combatantOrTurnEntry);
  const staminaCost = Math.max(1, toNumber(cost) ?? 1);
  const nextStamina = Math.max(0, state.currentStamina - staminaCost);
  const spent = state.currentStamina - nextStamina;
  const fatigueLabel = getFatigueLabel(nextStamina, state.maxStamina);

  return {
    ok: spent > 0,
    updated: {
      ...combatantOrTurnEntry,
      maxStamina: state.maxStamina,
      currentStamina: nextStamina,
      fatigueLabel,
    },
    spent,
    maxStamina: state.maxStamina,
    currentStamina: nextStamina,
    fatigueLabel,
    missingFields: spent > 0 ? [] : ["currentStamina"],
  };
}

export function resetStaminaForEncounter(combatantOrTurnEntry = {}) {
  return initializeStamina(combatantOrTurnEntry);
}

export default {
  getDefaultStamina,
  getFatigueLabel,
  getStaminaState,
  initializeStamina,
  resetStaminaForEncounter,
  spendStamina,
};
