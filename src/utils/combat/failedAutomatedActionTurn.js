export function resolveFailedAutomatedActionTurn({
  fighters = [],
  activeIndex = 0,
  round = 1,
  actorId,
  canStartTurn = (fighter) => !fighter.dead && !fighter.unconscious && !fighter.surrendered,
} = {}) {
  const nextFighters = fighters.map((fighter) => fighter.id === actorId
    ? { ...fighter, remainingActions: Math.max(0, Number(fighter.remainingActions || 0) - 1) }
    : fighter);
  for (let offset = 1; offset <= nextFighters.length; offset += 1) {
    const index = (activeIndex + offset) % nextFighters.length;
    const candidate = nextFighters[index];
    if (candidate && canStartTurn(candidate) && Number(candidate.remainingActions || 0) > 0) {
      return { fighters: nextFighters, nextIndex: index, round, wrapped: index <= activeIndex, roundAdvanced: false };
    }
  }
  const reset = nextFighters.map((fighter) => ({
    ...fighter,
    remainingActions: canStartTurn(fighter) ? Number(fighter.actionsPerRound || 2) : 0,
  }));
  const nextIndex = reset.findIndex((fighter) => canStartTurn(fighter) && fighter.remainingActions > 0);
  return {
    fighters: reset,
    nextIndex: nextIndex < 0 ? 0 : nextIndex,
    round: round + 1,
    wrapped: true,
    roundAdvanced: true,
  };
}

export default resolveFailedAutomatedActionTurn;
