export const FUMBLE_HANDOFF_STATES = Object.freeze({
  CLAIMED: "claimed",
  COMMITTING: "committing",
  COMMITTED: "committed",
  RELEASED: "released",
  REJECTED: "rejected",
  CANCELED: "canceled",
});

export function createFumbleHandoffOwnership({
  handoffToken,
  expectedOutgoingTurnId,
  expectedCoordinate,
  now = Date.now(),
} = {}) {
  if (!handoffToken || !expectedOutgoingTurnId || !expectedCoordinate) {
    return Object.freeze({
      accepted: false,
      state: FUMBLE_HANDOFF_STATES.REJECTED,
      reason: "missing-handoff-identity",
    });
  }
  return Object.freeze({
    accepted: true,
    handoffOwner: "fumble",
    handoffToken,
    expectedOutgoingTurnId,
    expectedCoordinate,
    committedCoordinate: null,
    state: FUMBLE_HANDOFF_STATES.CLAIMED,
    claimedAt: now,
  });
}

export function transitionFumbleHandoffOwnership(ownership, state, {
  committedCoordinate = ownership?.committedCoordinate ?? null,
  reason = null,
  now = Date.now(),
} = {}) {
  const allowed = {
    [FUMBLE_HANDOFF_STATES.CLAIMED]: [FUMBLE_HANDOFF_STATES.COMMITTING, FUMBLE_HANDOFF_STATES.REJECTED, FUMBLE_HANDOFF_STATES.CANCELED],
    [FUMBLE_HANDOFF_STATES.COMMITTING]: [FUMBLE_HANDOFF_STATES.COMMITTED, FUMBLE_HANDOFF_STATES.REJECTED, FUMBLE_HANDOFF_STATES.CANCELED],
    [FUMBLE_HANDOFF_STATES.COMMITTED]: [FUMBLE_HANDOFF_STATES.RELEASED],
  };
  if (!ownership?.accepted || !allowed[ownership.state]?.includes(state)) {
    return Object.freeze({ ...ownership, accepted: false, reason: "invalid-handoff-transition" });
  }
  return Object.freeze({
    ...ownership,
    state,
    committedCoordinate,
    reason,
    [`${state}At`]: now,
  });
}

export function isActiveFumbleHandoffOwnership(ownership) {
  return Boolean(
    ownership?.accepted &&
    [FUMBLE_HANDOFF_STATES.CLAIMED, FUMBLE_HANDOFF_STATES.COMMITTING, FUMBLE_HANDOFF_STATES.COMMITTED].includes(ownership.state),
  );
}

export function resolveFumbleHandoffCoordinate({
  ownership,
  fighters = [],
  currentCoordinate,
  canStartFighter = () => true,
} = {}) {
  if (!isActiveFumbleHandoffOwnership(ownership) || ownership.state !== FUMBLE_HANDOFF_STATES.CLAIMED) {
    return Object.freeze({ accepted: false, reason: "fumble-handoff-not-claimed" });
  }
  const outgoingIndex = fighters.findIndex((fighter) => fighter?.id === currentCoordinate?.actorId);
  if (outgoingIndex < 0) return Object.freeze({ accepted: false, reason: "outgoing-actor-not-found" });
  const nextRound = outgoingIndex === fighters.length - 1
    ? Number(currentCoordinate.round) + 1
    : Number(currentCoordinate.round);
  const eligible = fighters
    .map((fighter, initiativeIndex) => ({ fighter, initiativeIndex }))
    .filter(({ fighter }) => fighter && canStartFighter(fighter));
  const next = outgoingIndex === fighters.length - 1
    ? eligible[0]
    : eligible.find(({ initiativeIndex }) => initiativeIndex > outgoingIndex) || eligible[0];
  if (!next) return Object.freeze({ accepted: false, reason: "no-next-actor" });
  return Object.freeze({
    accepted: true,
    coordinate: Object.freeze({
      ...currentCoordinate,
      round: nextRound,
      initiativeIndex: next.initiativeIndex,
      turnCounter: Number(currentCoordinate.turnCounter) + 1,
      actorId: next.fighter.id,
      initiativeTurnId: null,
    }),
    wrappedRound: nextRound > Number(currentCoordinate.round),
  });
}
