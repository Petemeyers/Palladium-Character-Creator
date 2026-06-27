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

export function spendEnemyNoTargetAction(fighters = [], fighterId = "") {
  if (!Array.isArray(fighters) || !fighterId) return fighters;
  return fighters.map((fighter) => {
    if (fighter?.id !== fighterId) return fighter;
    const remainingActions = Math.max(0, Number(fighter.remainingActions ?? 0) || 0);
    return remainingActions > 0
      ? { ...fighter, remainingActions: remainingActions - 1 }
      : fighter;
  });
}

export default {
  buildEnemyTurnSlotKey,
  shouldCoalesceBlockedEnemyTurn,
  shouldDedupeEnemyTurnStart,
  shouldSkipBlockedEnemyTurnStart,
  spendEnemyNoTargetAction,
};
