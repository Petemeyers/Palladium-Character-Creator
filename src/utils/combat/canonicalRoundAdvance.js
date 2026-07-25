export function createLogicalInitiativeKey({
  generationId = "default",
  round,
  initiativeIndex,
  actorId,
} = {}) {
  return [generationId, round, initiativeIndex, actorId].join("|");
}

export function isCurrentRoundInitiativeSlotAvailable({
  fighter,
  initiativeIndex,
  generationId = "default",
  round,
  logicalTurnRegistry,
  canStartFighter = () => true,
} = {}) {
  if (
    !fighter ||
    !canStartFighter(fighter) ||
    (Number(fighter.remainingActions ?? 0) || 0) <= 0
  ) {
    return false;
  }
  const logicalKey = createLogicalInitiativeKey({
    generationId,
    round,
    initiativeIndex,
    actorId: fighter.id,
  });
  const record = logicalTurnRegistry?.get?.(logicalKey);
  return !record || !["completed", "canceled"].includes(record.state);
}

export function resolveAtomicRoundAdvance({
  fighters = [],
  currentRound,
  currentInitiativeIndex,
  generationId = "default",
  logicalTurnRegistry = new Map(),
  canStartFighter = () => true,
} = {}) {
  const available = fighters
    .map((fighter, initiativeIndex) => ({ fighter, initiativeIndex }))
    .filter(({ fighter, initiativeIndex }) => isCurrentRoundInitiativeSlotAvailable({
      fighter,
      initiativeIndex,
      generationId,
      round: currentRound,
      logicalTurnRegistry,
      canStartFighter,
    }));
  if (available.length === 0) {
    const firstEligibleIndex = fighters.findIndex((fighter) => (
      fighter &&
      canStartFighter(fighter)
    ));
    return Object.freeze({
      round: currentRound + 1,
      initiativeIndex: firstEligibleIndex >= 0 ? firstEligibleIndex : 0,
      wrappedRound: true,
    });
  }
  const next =
    available.find(({ initiativeIndex }) => initiativeIndex > currentInitiativeIndex) ||
    available[0];
  return Object.freeze({
    round: currentRound,
    initiativeIndex: next.initiativeIndex,
    wrappedRound: false,
  });
}
