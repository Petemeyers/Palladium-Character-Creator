export function getPlayerAiContinuationBlockReason(outcome) {
  if (outcome === false) return "executor-rejected";
  if (outcome?.ok === false) return outcome.reason || "executor-rejected";
  return null;
}

export function doesPlayerAiContinuationOwnAttack(activeAttackActionId, expectedAttackActionId) {
  return Boolean(
    expectedAttackActionId &&
    activeAttackActionId === expectedAttackActionId
  );
}

