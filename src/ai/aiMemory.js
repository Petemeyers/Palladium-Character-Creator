const makeKey = (actorId, action) => {
  const actionName =
    action.technique?.name ||
    action.tactical?.name ||
    action.skillName ||
    action.name ||
    action.type;

  return `${actorId}:${action.type}:${actionName}`;
};

export function updateAiMemoryAfterAction(memory = {}, actor, action, result, world = {}) {
  const actorId = actor.id ?? actor._id ?? actor.name;
  const round = world.round ?? world.currentRound ?? world.turnCounter ?? 0;
  const key = makeKey(actorId, action);
  const previousFailed = (memory.failedActionsByActorId ?? {})[actorId] ?? [];

  return {
    ...memory,

    lastUsedRoundByKey: {
      ...(memory.lastUsedRoundByKey ?? {}),
      [key]: round,
    },

    lastActionByActorId: {
      ...(memory.lastActionByActorId ?? {}),
      [actorId]: {
        round,
        type: action.type,
        name: action.name,
        targetId: action.targetId ?? null,
        success: result?.success ?? null,
      },
    },

    failedActionsByActorId: {
      ...(memory.failedActionsByActorId ?? {}),
      [actorId]:
        result?.success === false
          ? [
              ...previousFailed,
              {
                round,
                type: action.type,
                name: action.name,
                reason: result?.reason ?? "failed roll",
              },
            ].slice(-5)
          : previousFailed,
    },
  };
}
