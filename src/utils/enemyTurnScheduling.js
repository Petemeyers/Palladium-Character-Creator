export function buildEnemyTurnSlotKey({ fighterId, fighterType = "enemy", round = 1, turnIndex = "?", turnCounter = "?" } = {}) {
  return [
    fighterId ?? "?",
    fighterType ?? "enemy",
    round ?? 1,
    turnIndex ?? "?",
    turnCounter ?? "?",
  ].join("|");
}

export function shouldSkipBlockedEnemyTurnStart(blockedSlot, currentSlot = {}) {
  if (!blockedSlot || !currentSlot) return false;
  return (
    blockedSlot.combatSession === currentSlot.combatSession &&
    blockedSlot.turnKey === currentSlot.turnKey &&
    blockedSlot.fighterId === currentSlot.fighterId
  );
}

export function shouldDedupeEnemyTurnStart({ pendingKey, nextKey, hasTimer, isProcessing } = {}) {
  return Boolean(nextKey && pendingKey === nextKey && (hasTimer || isProcessing));
}

export function shouldCoalesceBlockedEnemyTurn({ stillCurrent, combatActive, combatOver, alreadyClaimedAndActive } = {}) {
  return Boolean(stillCurrent && combatActive && !combatOver && !alreadyClaimedAndActive);
}

export default {
  buildEnemyTurnSlotKey,
  shouldCoalesceBlockedEnemyTurn,
  shouldDedupeEnemyTurnStart,
  shouldSkipBlockedEnemyTurnStart,
};
