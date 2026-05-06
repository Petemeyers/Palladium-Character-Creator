export function addAiUnlock(patch = {}, actorId, unlockType, options = {}) {
  const round = options.round ?? 0;
  const ttlRounds = options.ttlRounds ?? 1;

  const current = patch.unlockedActionsByActorId?.[actorId] ?? [];

  const unlock = {
    type: unlockType,
    createdRound: round,
    expiresRound: round + ttlRounds,
    data: options.data ?? {},
  };

  return {
    ...patch,
    unlockedActionsByActorId: {
      ...(patch.unlockedActionsByActorId ?? {}),
      [actorId]: [
        ...current.filter((u) => {
          const t = typeof u === "string" ? u : u.type;
          return t !== unlockType;
        }),
        unlock,
      ],
    },
  };
}

export function getActiveAiUnlocks(world = {}, actorId, round = 0) {
  const raw = world.unlockedActionsByActorId?.[actorId] ?? [];

  return raw
    .map((u) =>
      typeof u === "string"
        ? { type: u, createdRound: round, expiresRound: round + 1, data: {} }
        : u
    )
    .filter((u) => u.expiresRound == null || u.expiresRound >= round);
}

export function hasAiUnlock(world, actorId, unlockType, round = 0) {
  return getActiveAiUnlocks(world, actorId, round).some(
    (u) => u.type === unlockType
  );
}

export function consumeAiUnlock(patch = {}, actorId, unlockType) {
  const current = patch.unlockedActionsByActorId?.[actorId] ?? [];

  return {
    ...patch,
    unlockedActionsByActorId: {
      ...(patch.unlockedActionsByActorId ?? {}),
      [actorId]: current.filter((u) => {
        const t = typeof u === "string" ? u : u.type;
        return t !== unlockType;
      }),
    },
  };
}

export function pruneExpiredAiUnlocks(patch = {}, round = 0) {
  const next = {};

  for (const [actorId, unlocks] of Object.entries(
    patch.unlockedActionsByActorId ?? {}
  )) {
    next[actorId] = unlocks.filter((u) => {
      if (typeof u === "string") return true;
      return u.expiresRound == null || u.expiresRound >= round;
    });
  }

  return {
    ...patch,
    unlockedActionsByActorId: next,
  };
}
