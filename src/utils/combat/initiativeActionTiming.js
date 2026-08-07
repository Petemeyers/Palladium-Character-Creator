export const INITIATIVE_ACTIONS_MODE = "initiative-actions";

export function isInitiativeActionsMode(mode) {
  return String(mode || "") === INITIATIVE_ACTIONS_MODE;
}

export function allowsSameActorActionContinuation(mode) {
  return !isInitiativeActionsMode(mode);
}

export function getInitiativeActionPassIndex(fighter = {}) {
  const maximumActions = Math.max(
    1,
    Number(
      fighter.actionsPerRound ??
      fighter.actionsPerMelee ??
      fighter.maxActions ??
      fighter.attacks ??
      1,
    ) || 1,
  );
  const remainingActions = Math.max(
    0,
    Number(fighter.remainingActions ?? maximumActions) || 0,
  );
  return Math.max(1, Math.min(maximumActions, maximumActions - remainingActions + 1));
}

export function canTakeInitiativeActionPass(fighter = {}, canStartFighter = () => true) {
  return Boolean(
    fighter &&
    canStartFighter(fighter) &&
    (Number(fighter.remainingActions ?? 0) || 0) > 0
  );
}

export function createInitiativeTurnSlotKey({
  combatSession = "default",
  round = 1,
  turnCounter = 0,
  initiativeIndex = 0,
  actorId = "?",
} = {}) {
  const normalizedCounter = Number.isFinite(Number(turnCounter))
    ? Math.max(0, Math.floor(Number(turnCounter)))
    : String(turnCounter ?? "?");
  return [
    combatSession || "default",
    Number.isFinite(Number(round)) ? Math.max(1, Math.floor(Number(round))) : round,
    `slot-${normalizedCounter}`,
    Number.isFinite(Number(initiativeIndex))
      ? Math.max(0, Math.floor(Number(initiativeIndex)))
      : initiativeIndex,
    actorId || "?",
  ].join("|");
}
