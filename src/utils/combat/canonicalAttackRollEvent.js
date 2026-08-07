const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildCanonicalAttackRollEvent({
  naturalRoll,
  modifier,
  total,
  defense,
  outcome,
  criticalResult = null,
  executionKey = null,
  modifierComponents = {},
} = {}) {
  const appliedComponents = Object.fromEntries(
    Object.entries(modifierComponents)
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
  );
  const appliedModifierTotal = Object.values(appliedComponents).reduce((sum, value) => sum + value, 0);
  const resolvedModifier = finite(modifier);
  return Object.freeze({
    eventType: "attack-roll",
    naturalRoll: finite(naturalRoll),
    modifier: resolvedModifier,
    modifierComponents: Object.freeze(appliedComponents),
    appliedModifierTotal,
    modifierArithmeticValid: Math.abs(appliedModifierTotal - resolvedModifier) < 1e-9,
    total: finite(total),
    defense: finite(defense),
    outcome,
    criticalResult,
    executionKey,
  });
}

export default buildCanonicalAttackRollEvent;
