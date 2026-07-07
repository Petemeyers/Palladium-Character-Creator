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
  forceAutomaticSurvival = false,
} = {}) {
  if (!activeFighterMatches) return { route: "blocked", blockReason: "active-fighter-mismatch" };
  if (!canAct) return { route: "blocked", blockReason: "cannot-act" };
  if (!isPartyActor) return { route: "blocked", blockReason: "not-party-actor" };
  if (forceAutomaticSurvival) return { route: "player-ai", blockReason: "" };
  if (!aiControlEnabled || effectiveControlMode !== "ai") {
    return { route: "manual", blockReason: "ai-disabled-or-manual" };
  }
  return { route: "player-ai", blockReason: "" };
}

export function shouldAutoResolvePlayerSurvival(actor = {}) {
  const moraleStatus = String(actor?.moraleState?.status || "").trim().toLowerCase();
  const stateMorale = String(actor?.state?.moraleState || "").trim().toLowerCase();
  const combatStatus = String(actor?.combatState || actor?.status || "").trim().toLowerCase();
  const effects = Array.isArray(actor?.statusEffects)
    ? actor.statusEffects.map((effect) => String(effect || "").trim().toLowerCase())
    : [];
  return (
    ["routed", "broken", "fleeing", "panic", "panicked"].includes(moraleStatus) ||
    ["routed", "broken", "fleeing", "panic", "panicked"].includes(stateMorale) ||
    ["routed", "broken", "fleeing", "panic", "panicked"].includes(combatStatus) ||
    effects.some((effect) => ["routed", "broken", "fleeing", "panic", "panicked"].includes(effect))
  );
}

export function shouldAllowSurvivalFinalizerHandoff({
  source = "",
  actor = {},
} = {}) {
  const normalizedSource = String(source || "").trim().toLowerCase();
  const explicitSurvivalSources = [
    "horror-action-consumed",
    "horror-action-consumed-recovery",
    "routed-move",
    "flee",
    "fled",
    "mark-fled",
    "surrender",
    "broken",
    "panic",
    "panic-response",
    "player-ai-routed-move",
  ];
  if (explicitSurvivalSources.some((survivalSource) => normalizedSource.includes(survivalSource))) {
    return true;
  }
  return normalizedSource === "player-ai" && shouldAutoResolvePlayerSurvival(actor);
}

export function shouldEnterManualPlayerWait({
  aiControlEnabled = false,
  isPartyActor = false,
  forceAutomaticSurvival = false,
  currentTurnKey = "",
  lastWaitTurnKey = "",
} = {}) {
  return Boolean(
    !aiControlEnabled &&
    isPartyActor &&
    !forceAutomaticSurvival &&
    currentTurnKey &&
    currentTurnKey !== lastWaitTurnKey
  );
}

export default planAiToggleResume;
