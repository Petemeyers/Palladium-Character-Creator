function getId(entity) {
  return entity?.id ?? entity?._id ?? entity?.name;
}

export function makeAiClaim(actor, action, world = {}) {
  const round = world.round ?? 0;
  const actorId = getId(actor);

  return {
    actorId,
    round,
    actionType: action.type,
    actionName: action.name,
    targetId: action.targetId ?? null,
    tags: action.tags ?? [],
  };
}

export function addAiClaimToPatch(patch = {}, actor, action, world = {}) {
  const claim = makeAiClaim(actor, action, world);

  return {
    ...patch,
    aiClaimsByRound: {
      ...(patch.aiClaimsByRound ?? {}),
      [claim.round]: [
        ...((patch.aiClaimsByRound ?? {})[claim.round] ?? []).filter(
          (c) => c.actorId !== claim.actorId
        ),
        claim,
      ],
    },
  };
}

export function getCurrentAiClaims(world = {}) {
  const round = world.round ?? 0;
  return world.aiClaimsByRound?.[round] ?? [];
}

export function countClaimsOnTarget(world = {}, targetId) {
  return getCurrentAiClaims(world).filter((claim) => claim.targetId === targetId)
    .length;
}
