import { pruneExpiredAiUnlocks } from "./aiUnlocks";
import {
  getPrivatePatch,
  getTeamPatches,
  mergePatchList,
} from "./aiKnowledge";
import { buildTeamTactics } from "./aiTeamTactics";

function getId(entity) {
  return entity?.id ?? entity?._id ?? entity?.name;
}

function withPositions(fighters = [], positions = {}) {
  return fighters.map((fighter) => {
    const id = getId(fighter);
    return {
      ...fighter,
      position: fighter?.position ?? positions?.[id] ?? null,
    };
  });
}

function buildVisibilityForActor(actor, fighters, options = {}) {
  const actorId = getId(actor);
  const explicitVisibleIds = options.visibilityByActorId?.[actorId];
  if (Array.isArray(explicitVisibleIds)) return explicitVisibleIds;

  const sightRangeFt = actor.sightRangeFt ?? options.defaultSightRangeFt ?? 60;
  const visibleIds = [];

  for (const other of fighters) {
    const otherId = getId(other);
    if (!otherId || otherId === actorId) continue;
    if (other.isDead || other.currentHP <= 0) continue;

    const hiddenIds = options.hiddenActorIds ?? [];
    if (hiddenIds.includes(otherId)) continue;

    const dx = Number(actor.position?.x ?? 0) - Number(other.position?.x ?? 0);
    const dz =
      Number(actor.position?.z ?? actor.position?.y ?? 0) -
      Number(other.position?.z ?? other.position?.y ?? 0);

    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= sightRangeFt) {
      visibleIds.push(otherId);
    }
  }

  return visibleIds;
}

export function buildAiWorldState({
  actor,
  fighters,
  round,
  encounter,
  baseWorld = {},
}) {
  const positionedFighters = withPositions(fighters, baseWorld.positions);
  const actorId = getId(actor);
  const actorWithPosition =
    positionedFighters.find((fighter) => getId(fighter) === actorId) ?? {
      ...actor,
      position: actor?.position ?? baseWorld.positions?.[actorId] ?? null,
    };
  const privatePatch = pruneExpiredAiUnlocks(getPrivatePatch(actorWithPosition), round);
  const teamPatch = mergePatchList(
    getTeamPatches(actorWithPosition, positionedFighters).map((patch) =>
      pruneExpiredAiUnlocks(patch, round)
    )
  );
  const legacyActorPatch = pruneExpiredAiUnlocks(
    actorWithPosition?.meta?.utilityWorldPatch,
    round
  );
  const mergedKnowledge = mergePatchList([
    teamPatch,
    privatePatch,
    legacyActorPatch,
    baseWorld,
  ]);

  const actorMemory =
    actor?.meta?.utilityAiMemory ??
    mergedKnowledge.aiMemory ??
    {};

  const hiddenActorIds = [
    ...new Set([
      ...(baseWorld.hiddenActorIds ?? []),
      ...(mergedKnowledge.hiddenActorIds ?? []),
    ]),
  ];

  const visibilityByActorId = {
    ...(baseWorld.visibilityByActorId ?? {}),
    [actorId]: buildVisibilityForActor(actorWithPosition, positionedFighters, {
      hiddenActorIds,
      visibilityByActorId: baseWorld.visibilityByActorId,
      defaultSightRangeFt: baseWorld.defaultSightRangeFt ?? 60,
    }),
  };

  const perceivedWorld = {
    ...baseWorld,

    round,
    fighters: positionedFighters,
    encounter,

    flags: {
      ...(baseWorld.flags ?? {}),
      ...(mergedKnowledge.flags ?? {}),
    },

    hiddenActorIds,

    unlockedActionsByActorId: {
      ...(baseWorld.unlockedActionsByActorId ?? {}),
      ...(mergedKnowledge.unlockedActionsByActorId ?? {}),
    },

    lastKnownEnemyByActorId: {
      ...(baseWorld.lastKnownEnemyByActorId ?? {}),
      ...(mergedKnowledge.lastKnownEnemyByActorId ?? {}),
    },

    teamFocusTargetId:
      mergedKnowledge.teamFocusTargetId ?? baseWorld.teamFocusTargetId ?? null,

    aiClaimsByRound: {
      ...(baseWorld.aiClaimsByRound ?? {}),
      ...(mergedKnowledge.aiClaimsByRound ?? {}),
    },

    visibilityByActorId,

    aiMemory: mergePatchList([{ aiMemory: mergedKnowledge.aiMemory }, { aiMemory: actorMemory }]).aiMemory,

    currentActorId: actorId,
  };

  const teamTactics = buildTeamTactics({
    actor: actorWithPosition,
    fighters: positionedFighters,
    world: perceivedWorld,
  });

  return {
    ...perceivedWorld,
    teamTactics,
  };
}
