export function createTurnFinalizerSnapshot({
  combatSession,
  generation,
  fighterId,
  turnIndex,
  meleeRound,
  turnCounter,
  turnToken,
  remainingActions,
  actionKey = null,
} = {}) {
  return {
    combatSession,
    generation,
    fighterId,
    turnIndex,
    meleeRound,
    turnCounter,
    turnToken,
    remainingActions,
    actionKey,
  };
}

export function getTurnFinalizerKey(snapshot = {}) {
  return [
    snapshot.combatSession ?? "session?",
    snapshot.generation ?? "generation?",
    snapshot.fighterId ?? "fighter?",
    snapshot.meleeRound ?? "round?",
    snapshot.turnIndex ?? "index?",
    snapshot.turnCounter ?? "counter?",
    snapshot.turnToken ?? "token?",
    snapshot.actionKey ?? "action?",
  ].join("|");
}

export function getTurnFinalizerStaleReason(expected = {}, current = {}) {
  const checks = [
    ["combat-session-changed", "combatSession"],
    ["generation-changed", "generation"],
    ["active-fighter-changed", "fighterId"],
    ["turn-index-changed", "turnIndex"],
    ["round-changed", "meleeRound"],
    ["turn-counter-changed", "turnCounter"],
    ["turn-token-changed", "turnToken"],
    ["action-key-changed", "actionKey"],
  ];

  for (const [reason, field] of checks) {
    if (expected[field] == null) continue;
    if (expected[field] !== current[field]) return reason;
  }

  if (
    expected.remainingActions != null &&
    current.remainingActions != null &&
    expected.remainingActions !== current.remainingActions
  ) {
    return "remaining-actions-changed";
  }

  return null;
}

export function shouldAcceptTurnFinalizer(expected, current) {
  return getTurnFinalizerStaleReason(expected, current) == null;
}

export function shouldDeferTurnStartUntilRefsSettle(finalizerMeta = {}) {
  return finalizerMeta?.deferTurnStart === true;
}
