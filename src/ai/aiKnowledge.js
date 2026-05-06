export const AI_KNOWLEDGE_SCOPE = {
  PRIVATE: "PRIVATE",
  TEAM: "TEAM",
  GLOBAL: "GLOBAL",
};

export function getActorId(actor) {
  return actor?.id ?? actor?._id ?? actor?.name;
}

export function getTeamId(actor) {
  return actor?.team ?? actor?.faction ?? actor?.side ?? actor?.type ?? "neutral";
}

export function makeKnowledgePatch(scope, data = {}) {
  return {
    scope,
    ...data,
  };
}

export function mergeKnowledgePatch(actor, patch) {
  if (!actor || !patch) return actor;

  const meta = actor.meta ?? {};

  if (patch.scope === AI_KNOWLEDGE_SCOPE.PRIVATE) {
    return {
      ...actor,
      meta: {
        ...meta,
        utilityPrivateWorldPatch: {
          ...(meta.utilityPrivateWorldPatch ?? {}),
          ...patch,
        },
      },
    };
  }

  if (patch.scope === AI_KNOWLEDGE_SCOPE.TEAM) {
    return {
      ...actor,
      meta: {
        ...meta,
        utilityTeamWorldPatch: {
          ...(meta.utilityTeamWorldPatch ?? {}),
          ...patch,
        },
      },
    };
  }

  return {
    ...actor,
    meta: {
      ...meta,
      utilityWorldPatch: {
        ...(meta.utilityWorldPatch ?? {}),
        ...patch,
      },
    },
  };
}

export function getPrivatePatch(actor) {
  return actor?.meta?.utilityPrivateWorldPatch ?? {};
}

export function getTeamPatches(actor, fighters = []) {
  const teamId = getTeamId(actor);

  return fighters
    .filter((f) => getTeamId(f) === teamId)
    .map((f) => f?.meta?.utilityTeamWorldPatch)
    .filter(Boolean);
}

export function mergePatchList(patches = []) {
  const merged = {
    lastKnownEnemyByActorId: {},
    hiddenActorIds: [],
    flags: {},
    unlockedActionsByActorId: {},
    teamFocusTargetId: null,
    aiClaimsByRound: {},
    aiMemory: {
      lastUsedRoundByKey: {},
      lastActionByActorId: {},
      failedActionsByActorId: {},
    },
  };

  for (const patch of patches) {
    if (!patch) continue;

    merged.lastKnownEnemyByActorId = {
      ...merged.lastKnownEnemyByActorId,
      ...(patch.lastKnownEnemyByActorId ?? {}),
    };

    merged.hiddenActorIds = [
      ...new Set([
        ...merged.hiddenActorIds,
        ...(patch.hiddenActorIds ?? []),
      ]),
    ];

    merged.flags = {
      ...merged.flags,
      ...(patch.flags ?? {}),
    };

    merged.unlockedActionsByActorId = {
      ...merged.unlockedActionsByActorId,
      ...(patch.unlockedActionsByActorId ?? {}),
    };

    merged.teamFocusTargetId =
      patch.teamFocusTargetId ?? merged.teamFocusTargetId;

    merged.aiClaimsByRound = {
      ...(merged.aiClaimsByRound ?? {}),
      ...(patch.aiClaimsByRound ?? {}),
    };

    merged.aiMemory = {
      ...merged.aiMemory,
      lastUsedRoundByKey: {
        ...(merged.aiMemory.lastUsedRoundByKey ?? {}),
        ...(patch.aiMemory?.lastUsedRoundByKey ?? {}),
      },
      lastActionByActorId: {
        ...(merged.aiMemory.lastActionByActorId ?? {}),
        ...(patch.aiMemory?.lastActionByActorId ?? {}),
      },
      failedActionsByActorId: {
        ...(merged.aiMemory.failedActionsByActorId ?? {}),
        ...(patch.aiMemory?.failedActionsByActorId ?? {}),
      },
    };
  }

  return merged;
}
