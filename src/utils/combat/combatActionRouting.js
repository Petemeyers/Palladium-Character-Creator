import { resolveExertionActionPolicy } from "./exertionState.js";

export function resolveAttackOverexertionPolicy({
  currentStamina,
  maxStamina,
  attackCost,
  alreadyOverexerted = false,
  survivalOverride = null,
  manualChoice = false,
} = {}) {
  const numericCurrentStamina = Number(currentStamina);
  const numericMaxStamina = Number(maxStamina);
  const resolvedMaxStamina = Number.isFinite(numericMaxStamina) && numericMaxStamina > 0
    ? numericMaxStamina
    : Math.max(1, Number.isFinite(numericCurrentStamina) ? numericCurrentStamina : 1);
  const policy = resolveExertionActionPolicy({
    currentStamina,
    maxStamina: resolvedMaxStamina,
    cost: attackCost,
    alreadyOverexerted,
    survivalOverride,
    manualChoice,
  });
  return {
    ...policy,
    attackCost: Math.max(0, Number(attackCost) || 0),
  };
}
