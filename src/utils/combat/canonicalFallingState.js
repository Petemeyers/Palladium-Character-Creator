const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const actorIdOf = (actor) => actor?.id ?? actor?._id ?? null;
const clonePosition = (position = {}) => Object.freeze({
  x: finite(position.x, 0),
  y: finite(position.y, 0),
  altitudeFeet: Math.max(0, finite(position.altitudeFeet, 0)),
});

const developerEvent = (eventType, record, data = {}) => ({
  eventType,
  actorId: record?.actorId ?? null,
  data: {
    fallId: record?.fallId ?? null,
    sourceRelationshipId: record?.sourceRelationshipId ?? null,
    generationId: record?.generationId ?? null,
    initiativeTurnId: record?.initiativeTurnId ?? null,
    actionToken: record?.actionToken ?? null,
    ...data,
  },
});

export function createCanonicalFallRegistry() {
  return {
    falls: new Map(),
    completedFallIds: new Set(),
  };
}

export function claimCanonicalFall({
  registry = createCanonicalFallRegistry(),
  actor,
  sourceActorId = null,
  sourceRelationshipId = null,
  cause = "released-from-elevation",
  startingPosition,
  startingAltitudeFeet,
  landingPosition,
  generationId,
  initiativeTurnId,
  actionToken,
  fallId,
} = {}) {
  const actorId = actorIdOf(actor);
  const resolvedFallId = String(
    fallId || `${generationId}:${initiativeTurnId}:${actionToken}:fall:${actorId}`,
  );
  if (!actorId || !generationId || !initiativeTurnId || !actionToken) {
    return {
      accepted: false,
      reason: "fall-ownership-required",
      actor,
      events: [developerEvent("fall-state-rejected", null, { reason: "fall-ownership-required" })],
    };
  }
  if (registry.falls.has(resolvedFallId) || registry.completedFallIds.has(resolvedFallId)) {
    return {
      accepted: false,
      reason: "duplicate-fall",
      actor,
      events: [developerEvent("duplicate-fall-rejected", registry.falls.get(resolvedFallId), { reason: "duplicate-fall" })],
    };
  }
  const origin = clonePosition({
    ...(actor?.position || {}),
    ...(startingPosition || {}),
    altitudeFeet: startingAltitudeFeet
      ?? startingPosition?.altitudeFeet
      ?? actor?.flightState?.altitudeFeet
      ?? actor?.position?.altitudeFeet
      ?? actor?.altitudeFeet
      ?? actor?.altitude
      ?? 0,
  });
  const landing = clonePosition({
    x: landingPosition?.x ?? origin.x,
    y: landingPosition?.y ?? origin.y,
    altitudeFeet: 0,
  });
  const record = {
    fallId: resolvedFallId,
    actorId,
    sourceActorId,
    sourceRelationshipId,
    cause,
    startingPosition: origin,
    startingAltitudeFeet: origin.altitudeFeet,
    currentAltitudeFeet: origin.altitudeFeet,
    landingPosition: landing,
    generationId,
    initiativeTurnId,
    actionToken,
    state: "claimed",
    createdAt: Date.now(),
    completedAt: null,
  };
  registry.falls.set(resolvedFallId, record);
  return {
    accepted: true,
    fallId: resolvedFallId,
    fallState: Object.freeze({ ...record }),
    actor,
    events: [developerEvent("fall-state-started", record, {
      cause,
      startingAltitudeFeet: origin.altitudeFeet,
    })],
  };
}

export function validateCanonicalFallCallback({
  registry,
  fallId,
  generationId,
  initiativeTurnId,
  actionToken,
} = {}) {
  const record = registry?.falls?.get(String(fallId || ""));
  const matches = Boolean(
    record
    && record.generationId === generationId
    && record.initiativeTurnId === initiativeTurnId
    && record.actionToken === actionToken
    && !["completed", "canceled", "rejected"].includes(record.state),
  );
  return matches
    ? { accepted: true, fallState: Object.freeze({ ...record }), events: [] }
    : {
        accepted: false,
        reason: "stale-fall-callback",
        events: [developerEvent("stale-fall-callback-rejected", record, { reason: "stale-fall-callback" })],
      };
}

export function resolveCanonicalFall({
  registry,
  fallId,
  actor,
  generationId,
  initiativeTurnId,
  actionToken,
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ actor: currentActor }) => ({ actor: currentActor, damage: 0 }),
} = {}) {
  if (registry?.completedFallIds?.has(String(fallId || ""))) {
    const completed = registry.falls.get(String(fallId || ""));
    return {
      accepted: false,
      reason: "duplicate-fall",
      actor,
      damage: 0,
      events: [developerEvent("duplicate-fall-rejected", completed, { reason: "duplicate-fall" })],
    };
  }
  const validation = validateCanonicalFallCallback({
    registry,
    fallId,
    generationId,
    initiativeTurnId,
    actionToken,
  });
  if (!validation.accepted) return { ...validation, actor, damage: 0 };
  const record = registry.falls.get(String(fallId));
  if (actorIdOf(actor) !== record.actorId) {
    return {
      accepted: false,
      reason: "fall-actor-mismatch",
      actor,
      damage: 0,
      events: [developerEvent("fall-state-rejected", record, { reason: "fall-actor-mismatch" })],
    };
  }

  record.state = "descending";
  record.currentAltitudeFeet = 0;
  record.state = "impact-pending";
  const impactAuthorization = authorizeImpact({
    actor,
    fallState: Object.freeze({ ...record }),
    fallDistanceFeet: record.startingAltitudeFeet,
  });
  if (impactAuthorization?.accepted !== true) {
    record.state = "rejected";
    return {
      accepted: false,
      reason: impactAuthorization?.reason || "fall-impact-rejected",
      actor,
      damage: 0,
      events: [developerEvent("fall-impact-rejected", record, {
        reason: impactAuthorization?.reason || "fall-impact-rejected",
      })],
    };
  }

  record.state = "impact-authorized";
  const impactEvent = developerEvent("fall-impact-authorized", record, {
    fallDistanceFeet: record.startingAltitudeFeet,
  });
  const impact = resolveImpact({
    actor,
    fallState: Object.freeze({ ...record }),
    fallDistanceFeet: record.startingAltitudeFeet,
    landingPosition: record.landingPosition,
  }) || {};
  const impactedActor = impact.actor || actor;
  const groundedActor = {
    ...impactedActor,
    position: { ...record.landingPosition },
    x: record.landingPosition.x,
    y: record.landingPosition.y,
    altitude: 0,
    altitudeFeet: 0,
    prone: record.startingAltitudeFeet > 0 ? true : impactedActor.prone,
    fallState: Object.freeze({ ...record, state: "completed", currentAltitudeFeet: 0 }),
  };
  if (groundedActor.flightState) {
    groundedActor.flightState = Object.freeze({
      ...groundedActor.flightState,
      mode: "grounded",
      altitudeFeet: 0,
      altitudeBand: "ground",
      horizontalPosition: Object.freeze({
        x: record.landingPosition.x,
        y: record.landingPosition.y,
      }),
      verticalVelocity: 0,
      supportState: "ground",
      transitionState: "committed",
      lastCommittedActionToken: actionToken,
      lastCommittedInitiativeTurnId: initiativeTurnId,
    });
  }
  record.state = "committed";
  record.state = "completed";
  record.completedAt = Date.now();
  registry.completedFallIds.add(record.fallId);
  return {
    accepted: true,
    actor: groundedActor,
    damage: Math.max(0, finite(impact.damage, 0)),
    fallState: Object.freeze({ ...record }),
    events: [
      impactEvent,
      developerEvent("fall-state-completed", record, {
        fallDistanceFeet: record.startingAltitudeFeet,
        damage: Math.max(0, finite(impact.damage, 0)),
      }),
    ],
  };
}

export default {
  claimCanonicalFall,
  createCanonicalFallRegistry,
  resolveCanonicalFall,
  validateCanonicalFallCallback,
};
