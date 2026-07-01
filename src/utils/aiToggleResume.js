export function planAiToggleResume({
  aiControlEnabled = false,
  isPartyActor = false,
  effectiveControlMode = "",
  expectedPlayerTurnKey = "",
  playerTurnInFlightKey = "",
  expectedTurnStartKey = "",
  turnStartInFlightKey = "",
  expectedTurnStartPending = false,
  playerTimerPending = false,
  enemyTimerPending = false,
  processingPlayerAI = false,
  processingEnemyAI = false,
  actionBusy = false,
  actionResolving = false,
  turnAdvancePending = false,
} = {}) {
  const eligible = aiControlEnabled && isPartyActor && effectiveControlMode === "ai";
  const idle = !playerTimerPending && !enemyTimerPending &&
    !processingPlayerAI && !processingEnemyAI &&
    !actionBusy && !actionResolving && !turnAdvancePending;
  if (!eligible || !idle) {
    return {
      eligible,
      idle,
      clearPlayerTurnInFlight: false,
      clearTurnStartInFlight: false,
      clearPendingTurnStart: false,
      shouldSchedule: false,
    };
  }

  const clearPlayerTurnInFlight = Boolean(
    expectedPlayerTurnKey && playerTurnInFlightKey === expectedPlayerTurnKey,
  );
  const clearTurnStartInFlight = Boolean(
    expectedTurnStartKey && turnStartInFlightKey === expectedTurnStartKey,
  );
  const clearPendingTurnStart = Boolean(expectedTurnStartKey && expectedTurnStartPending);
  const unrelatedPlayerTurnInFlight = Boolean(
    playerTurnInFlightKey && !clearPlayerTurnInFlight,
  );
  const unrelatedTurnStartInFlight = Boolean(turnStartInFlightKey && !clearTurnStartInFlight);

  return {
    eligible,
    idle,
    clearPlayerTurnInFlight,
    clearTurnStartInFlight,
    clearPendingTurnStart,
    shouldSchedule: !unrelatedPlayerTurnInFlight && !unrelatedTurnStartInFlight,
  };
}

export function decidePlayerTurnStartRoute({
  aiControlEnabled = false,
  isPartyActor = false,
  effectiveControlMode = "",
  activeFighterMatches = false,
  canAct = false,
} = {}) {
  if (!activeFighterMatches) return { route: "blocked", blockReason: "active-fighter-mismatch" };
  if (!canAct) return { route: "blocked", blockReason: "cannot-act" };
  if (!isPartyActor) return { route: "blocked", blockReason: "not-party-actor" };
  if (!aiControlEnabled || effectiveControlMode !== "ai") {
    return { route: "manual", blockReason: "ai-disabled-or-manual" };
  }
  return { route: "player-ai", blockReason: "" };
}

export default planAiToggleResume;
