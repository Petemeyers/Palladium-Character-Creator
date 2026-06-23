const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toPositiveNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const toNonNegativeNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export function getDefaultActionBudget(combatant = {}) {
  return toPositiveNumber(combatant?.maxActions) || 1;
}

export function initializeActionBudget(combatant = {}) {
  const maxActions = getDefaultActionBudget(combatant);

  return {
    ...combatant,
    maxActions,
    remainingActions: maxActions,
  };
}

export function spendAction(turnEntryOrCombatant = {}, cost = 1) {
  const maxActions = getDefaultActionBudget(turnEntryOrCombatant);
  const remainingActions = toNonNegativeNumber(turnEntryOrCombatant?.remainingActions) ?? maxActions;
  const actionCost = toPositiveNumber(cost) || 1;
  const nextRemainingActions = Math.max(0, remainingActions - actionCost);
  const spent = remainingActions - nextRemainingActions;

  return {
    ok: spent > 0,
    updated: {
      ...turnEntryOrCombatant,
      maxActions,
      remainingActions: nextRemainingActions,
    },
    spent,
    maxActions,
    remainingActions: nextRemainingActions,
    missingFields: spent > 0 ? [] : ["remainingActions"],
  };
}

export function resetActionBudgetForTurn(turnEntryOrCombatant = {}) {
  const maxActions = getDefaultActionBudget(turnEntryOrCombatant);

  return {
    ...turnEntryOrCombatant,
    maxActions,
    remainingActions: maxActions,
  };
}

export default {
  getDefaultActionBudget,
  initializeActionBudget,
  resetActionBudgetForTurn,
  spendAction,
};
