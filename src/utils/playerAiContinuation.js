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

export function validateCapturedFlankingAttackIdentity(captured = {}, current = {}) {
  const required = [
    "executionKey",
    "grantId",
    "generation",
    "combatSession",
    "initiativeTurnId",
    "actorId",
    "targetId",
    "actionSequence",
  ];
  if (required.some((field) => captured[field] === null || captured[field] === undefined || captured[field] === "")) {
    return { accepted: false, reason: "incomplete-captured-identity" };
  }
  for (const field of required.slice(2)) {
    if (String(captured[field]) !== String(current[field] ?? "")) {
      return { accepted: false, reason: `${field}-mismatch` };
    }
  }
  return { accepted: true, reason: null, executionKey: captured.executionKey };
}

export function createPlayerAiContinuationOwnership({
  fighterId,
  turnIndex,
  turnCounter,
  turnToken,
  generationId = null,
  initiativeTurnId = null,
  actionSequence = null,
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
    generationId ?? "generation",
    initiativeTurnId ?? "initiative-turn",
    actionSequence ?? "sequence",
    source,
  ].join("|");
  return {
    continuationKey,
    fighterId: fighterId ?? null,
    turnIndex: Number.isInteger(turnIndex) ? turnIndex : null,
    turnCounter: Number.isFinite(Number(turnCounter)) ? Number(turnCounter) : null,
    turnToken: turnToken ?? null,
    generationId: generationId ?? null,
    initiativeTurnId: initiativeTurnId ?? null,
    actionSequence: Number.isFinite(Number(actionSequence)) ? Number(actionSequence) : null,
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
  if (current.generationId != null && ownership.generationId !== current.generationId) return false;
  if (current.initiativeTurnId != null && ownership.initiativeTurnId !== current.initiativeTurnId) return false;
  if (current.actionSequence != null && ownership.actionSequence !== Number(current.actionSequence)) return false;
  return true;
}

export function classifyPlayerAiContinuationAdmission({ ownership, current, activeExecutionKey = null } = {}) {
  if (!doesPlayerAiContinuationOwnTurn(ownership, current)) {
    return { accepted: false, deferred: false, reason: "stale-continuation-identity" };
  }
  if (activeExecutionKey) {
    return {
      accepted: false,
      deferred: true,
      reason: "prior-player-ai-execution-settling",
      existingExecutionKey: activeExecutionKey,
    };
  }
  return { accepted: true, deferred: false, reason: null };
}

export function shouldPlayerAiContinuationWatchdogFire(ownership, current, now = Date.now()) {
  return doesPlayerAiContinuationOwnTurn(ownership, current) && now >= ownership.deadline;
}
