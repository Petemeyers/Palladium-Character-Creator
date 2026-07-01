const TURN_ADVANCE_RETRY_REASONS = new Set([
  "endTurn-direct",
  "effect-turn-advance",
  "new-melee-round-direct",
  "ai-toggle-resume",
  "horror-action-consumed",
]);

export function isPlayerAiTurnAdvanceRetryReason(reason) {
  return TURN_ADVANCE_RETRY_REASONS.has(String(reason || ""));
}

export function shouldRetryPlayerAiActiveFighterMismatch({
  reason,
  retryCount = 0,
  maxRetries = 3,
  aiControlEnabled = false,
  isPartyActor = false,
  combatActive = false,
  combatPaused = false,
  combatOver = false,
  actionBusy = false,
  actionResolving = false,
} = {}) {
  return (
    isPlayerAiTurnAdvanceRetryReason(reason) &&
    retryCount < maxRetries &&
    aiControlEnabled === true &&
    isPartyActor === true &&
    combatActive === true &&
    combatPaused !== true &&
    combatOver !== true &&
    actionBusy !== true &&
    actionResolving !== true
  );
}

