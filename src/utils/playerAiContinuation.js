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

export function createPlayerAiContinuationOwnership({
  fighterId,
  turnIndex,
  turnCounter,
  turnToken,
  source = "player-ai-continuation",
  claimedAt = Date.now(),
  timeoutMs = 6500,
} = {}) {
  const safeTimeoutMs = Math.max(1, Number(timeoutMs) || 6500);
  const continuationKey = [
    fighterId ?? "fighter",
    turnIndex ?? "index",
    turnCounter ?? "turn",
    turnToken ?? "token",
    source,
  ].join("|");
  return {
    continuationKey,
    fighterId: fighterId ?? null,
    turnIndex: Number.isInteger(turnIndex) ? turnIndex : null,
    turnCounter: Number.isFinite(Number(turnCounter)) ? Number(turnCounter) : null,
    turnToken: turnToken ?? null,
    source,
    claimedAt,
    deadline: claimedAt + safeTimeoutMs,
  };
}

export function doesPlayerAiContinuationOwnTurn(ownership, current = {}) {
  if (!ownership?.fighterId || ownership.fighterId !== current?.fighterId) return false;
  if (current.turnIndex != null && ownership.turnIndex !== current.turnIndex) return false;
  if (current.turnCounter != null && ownership.turnCounter !== current.turnCounter) return false;
  if (current.turnToken != null && ownership.turnToken !== current.turnToken) return false;
  return true;
}

export function shouldPlayerAiContinuationWatchdogFire(ownership, current, now = Date.now()) {
  return doesPlayerAiContinuationOwnTurn(ownership, current) && now >= ownership.deadline;
}
