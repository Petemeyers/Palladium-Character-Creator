const text = (value) => String(value || "").trim().toLowerCase();
const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const FLIGHT_MODES = Object.freeze([
  "grounded",
  "taking-off",
  "airborne",
  "descending",
  "landing",
  "perched",
  "falling",
]);

export function getAltitudeBand(altitudeFeet) {
  const altitude = numberOr(altitudeFeet, 0);
  if (altitude <= 0) return "ground";
  if (altitude <= 10) return "low";
  if (altitude <= 30) return "medium";
  return "high";
}

export function getCanonicalAltitude(actor = {}) {
  return numberOr(
    actor.flightState?.altitudeFeet
      ?? actor.position?.altitudeFeet
      ?? actor.altitudeFeet
      ?? actor.altitude,
    0,
  );
}

export function isCanonicallyAirborne(actor = {}) {
  const mode = text(actor.flightState?.mode);
  return ["taking-off", "airborne", "descending", "landing", "falling"].includes(mode)
    && getCanonicalAltitude(actor) > 0;
}

export function createCanonicalFlightState({
  mode = "grounded",
  altitudeFeet = 0,
  horizontalPosition = null,
  verticalVelocity = 0,
  supportState = "ground",
  transitionState = "idle",
  lastCommittedActionToken = null,
  lastCommittedInitiativeTurnId = null,
} = {}) {
  const canonicalMode = FLIGHT_MODES.includes(text(mode)) ? text(mode) : "grounded";
  const altitude = Math.max(0, numberOr(altitudeFeet, 0));
  const grounded = canonicalMode === "grounded" || canonicalMode === "perched";
  const resolvedAltitude = grounded ? 0 : altitude;
  return Object.freeze({
    mode: canonicalMode,
    altitudeFeet: resolvedAltitude,
    altitudeBand: getAltitudeBand(resolvedAltitude),
    horizontalPosition: horizontalPosition ? Object.freeze({
      x: numberOr(horizontalPosition.x, 0),
      y: numberOr(horizontalPosition.y, 0),
    }) : null,
    verticalVelocity: canonicalMode === "falling"
      ? Math.min(0, numberOr(verticalVelocity, 0))
      : numberOr(verticalVelocity, 0),
    supportState: grounded ? (canonicalMode === "perched" ? "perch" : "ground") : text(supportState || "unsupported"),
    transitionState: text(transitionState || "idle"),
    lastCommittedActionToken,
    lastCommittedInitiativeTurnId,
  });
}

export function normalizeCanonicalFlightState(actor = {}) {
  const diagnostics = [];
  const existing = actor.flightState;
  const legacyAltitude = numberOr(actor.altitudeFeet ?? actor.altitude, 0);
  const positionAltitude = numberOr(actor.position?.altitudeFeet, legacyAltitude);
  const canFly = actor.flightProfile?.kind === "biological"
    || actor.movement?.canFly === true
    || actor.abilities?.movement?.flight?.active === true
    || actor.movementModes?.includes?.("flying");
  const legacyAirborne = actor.isFlying === true || actor.flying === true
    || actor.airborne === true || actor.inFlight === true || actor.hovering === true;
  const altitude = numberOr(existing?.altitudeFeet, positionAltitude);
  const requestedMode = existing?.mode
    || ((legacyAirborne || altitude > 0) && canFly ? "airborne" : "grounded");
  const flightState = createCanonicalFlightState({
    ...existing,
    mode: requestedMode,
    altitudeFeet: altitude,
    horizontalPosition: existing?.horizontalPosition || actor.position || (
      Number.isFinite(Number(actor.x)) && Number.isFinite(Number(actor.y))
        ? { x: actor.x, y: actor.y }
        : null
    ),
  });
  const position = actor.position
    ? { ...actor.position, altitudeFeet: flightState.altitudeFeet }
    : {
        ...(Number.isFinite(Number(actor.x)) ? { x: Number(actor.x) } : {}),
        ...(Number.isFinite(Number(actor.y)) ? { y: Number(actor.y) } : {}),
        altitudeFeet: flightState.altitudeFeet,
      };
  if (existing == null && (legacyAirborne || legacyAltitude > 0)) diagnostics.push({
    eventType: "flight-state-normalized",
    actorId: actor.id ?? null,
    data: { source: "legacy-flight-projection", mode: flightState.mode, altitudeFeet: flightState.altitudeFeet },
  });
  return {
    actor: {
      ...actor,
      flightState,
      position,
      // Compatibility values are projections only. Canonical readers always prefer flightState.
      isFlying: isCanonicallyAirborne({ flightState }),
      airborne: isCanonicallyAirborne({ flightState }),
      altitude: flightState.altitudeFeet,
      altitudeFeet: flightState.altitudeFeet,
      movementMode: isCanonicallyAirborne({ flightState }) ? "flight" : "ground",
      flightCompatibilityProjection: true,
    },
    flightState,
    diagnostics,
  };
}

export function createFlightAuthorityRegistry() {
  return {
    transitions: new Map(),
    actorSequence: new Map(),
    falls: new Map(),
  };
}

const rejectTransition = (actor, reason, request, extra = {}) => ({
  accepted: false,
  reason,
  actor,
  staminaSpent: 0,
  events: [{
    eventType: reason.startsWith("stale-") ? "stale-flight-callback-rejected" : "flight-transition-rejected",
    actorId: actor?.id ?? null,
    data: {
      reason,
      actionToken: request.actionToken ?? null,
      initiativeTurnId: request.initiativeTurnId ?? null,
      generationId: request.generationId ?? null,
      ...extra,
    },
  }],
});

export function resolveFlightTransition({
  actor,
  currentFlightState,
  requestedTransition,
  destination = {},
  actionToken,
  initiativeTurnId,
  generationId,
  movementSequence = 1,
  authoritativeTurn = {},
  registry = createFlightAuthorityRegistry(),
  occupied = false,
  landingValid = true,
  takeoffBlocked = false,
  ceilingHeightFeet = null,
  obstacleHeightFeet = null,
  movementRequired = 0,
  movementAvailable = Infinity,
  staminaCost = 0,
  staminaAvailable = Infinity,
} = {}) {
  const request = { actionToken, initiativeTurnId, generationId };
  const state = createCanonicalFlightState(currentFlightState || actor?.flightState || {});
  const transition = text(requestedTransition);
  const actorId = actor?.id;
  const key = `${generationId}:${initiativeTurnId}:${actionToken}:${actorId}:${movementSequence}`;
  const actorSequenceKey = `${generationId}:${actorId}`;
  const requestedEvent = {
    eventType: "flight-transition-requested",
    actorId,
    data: { transition, actionToken, initiativeTurnId, generationId, movementSequence },
  };
  if (!actorId || actor?.flightProfile?.kind !== "biological" || actor?.anatomyProfile?.wingsPresent !== true) return rejectTransition(actor, "actor-cannot-fly", request);
  if (!actionToken) return rejectTransition(actor, "stale-action-token", request);
  if (!initiativeTurnId || (authoritativeTurn.initiativeTurnId && authoritativeTurn.initiativeTurnId !== initiativeTurnId)) return rejectTransition(actor, "stale-initiative-turn", request);
  if (authoritativeTurn.generationId != null && String(authoritativeTurn.generationId) !== String(generationId)) return rejectTransition(actor, "invalid-generation", request);
  if (authoritativeTurn.actorId && authoritativeTurn.actorId !== actorId) return rejectTransition(actor, "stale-action-token", request);
  if (authoritativeTurn.actionToken && authoritativeTurn.actionToken !== actionToken) return rejectTransition(actor, "stale-action-token", request);
  if (actor.dead || actor.isDead || actor.currentHP <= 0 && actor.unconscious) return rejectTransition(actor, "actor-dead", request);
  if (actor.unconscious || actor.isUnconscious) return rejectTransition(actor, "actor-unconscious", request);
  if (actor.captured || actor.surrenderState?.state === "captured") return rejectTransition(actor, "actor-captured", request);
  if (actor.grappleState?.opponent && transition !== "fall") return rejectTransition(actor, "grappled-flight-restricted", request);
  if (registry.transitions.has(key)) return rejectTransition(actor, "duplicate-flight-transition", request);
  const lastSequence = numberOr(registry.actorSequence.get(actorSequenceKey), 0);
  if (numberOr(movementSequence, 0) <= lastSequence) return rejectTransition(actor, "stale-action-token", request, { lastSequence });
  if (numberOr(movementRequired, 0) > numberOr(movementAvailable, Infinity)) return rejectTransition(actor, "insufficient-movement", request);
  if (numberOr(staminaCost, 0) > numberOr(staminaAvailable, Infinity)) return rejectTransition(actor, "insufficient-stamina", request);
  if (transition === "takeoff" && takeoffBlocked) return rejectTransition(actor, "blocked-takeoff", request);
  if ((transition === "land" || transition === "perch") && occupied) return rejectTransition(actor, "occupied-landing-hex", request);
  if ((transition === "land" || transition === "perch") && landingValid === false) return rejectTransition(actor, "invalid-landing-hex", request);
  if ((transition === "land" || transition === "perch")) {
    const fromX = numberOr(state.horizontalPosition?.x ?? actor.position?.x ?? actor.x, 0);
    const fromY = numberOr(state.horizontalPosition?.y ?? actor.position?.y ?? actor.y, 0);
    const toX = numberOr(destination.x, fromX);
    const toY = numberOr(destination.y, fromY);
    if ((toX !== fromX || toY !== fromY) && numberOr(movementRequired, 0) <= 0) {
      return rejectTransition(actor, "invalid-landing-hex", request, { reasonDetail: "horizontal-teleportation-blocked" });
    }
  }
  const fromAltitude = state.altitudeFeet;
  let mode = state.mode;
  let altitudeFeet = numberOr(destination.altitudeFeet, fromAltitude);
  if (transition === "takeoff") {
    if (!["grounded", "perched"].includes(state.mode)) return rejectTransition(actor, "incompatible-flight-state", request);
    mode = "airborne";
    altitudeFeet = numberOr(destination.altitudeFeet, actor.flightProfile?.takeoffAltitudeFeet);
  } else if (transition === "ascend" || transition === "horizontal-flight" || transition === "recover-flight") {
    if (!["airborne", "descending", "falling"].includes(state.mode)) return rejectTransition(actor, "incompatible-flight-state", request);
    mode = "airborne";
  } else if (transition === "descend") {
    if (!["airborne", "descending"].includes(state.mode)) return rejectTransition(actor, "incompatible-flight-state", request);
    mode = "descending";
  } else if (transition === "land" || transition === "perch") {
    if (!["airborne", "descending", "landing"].includes(state.mode)) return rejectTransition(actor, "incompatible-flight-state", request);
    mode = transition === "perch" ? "perched" : "grounded";
    altitudeFeet = 0;
  } else if (transition === "leave-perch") {
    if (state.mode !== "perched") return rejectTransition(actor, "incompatible-flight-state", request);
    mode = "airborne";
    altitudeFeet = numberOr(destination.altitudeFeet, actor.flightProfile?.takeoffAltitudeFeet);
  } else if (transition === "fall") {
    mode = "falling";
    altitudeFeet = fromAltitude;
  } else {
    return rejectTransition(actor, "incompatible-flight-state", request);
  }
  const maxAltitude = numberOr(actor.flightProfile?.maximumAltitudeFeet, Infinity);
  if (!Number.isFinite(altitudeFeet) || altitudeFeet < 0 || altitudeFeet > maxAltitude) return rejectTransition(actor, "altitude-out-of-bounds", request);
  if (["airborne", "descending", "falling"].includes(mode) && altitudeFeet <= 0) return rejectTransition(actor, "altitude-out-of-bounds", request);
  if (ceilingHeightFeet != null && Number.isFinite(Number(ceilingHeightFeet)) && altitudeFeet >= Number(ceilingHeightFeet)) return rejectTransition(actor, "altitude-out-of-bounds", request, { obstruction: "ceiling" });
  if (transition === "horizontal-flight" && obstacleHeightFeet != null && Number.isFinite(Number(obstacleHeightFeet)) && altitudeFeet <= Number(obstacleHeightFeet)) {
    return rejectTransition(actor, "altitude-out-of-bounds", request, { obstruction: "solid-obstacle" });
  }

  const horizontalPosition = {
    x: numberOr(destination.x, state.horizontalPosition?.x ?? actor.position?.x ?? actor.x),
    y: numberOr(destination.y, state.horizontalPosition?.y ?? actor.position?.y ?? actor.y),
  };
  const flightState = createCanonicalFlightState({
    mode,
    altitudeFeet,
    horizontalPosition,
    verticalVelocity: mode === "falling" ? Math.min(-1, numberOr(destination.verticalVelocity, -1)) : numberOr(destination.verticalVelocity, 0),
    supportState: mode === "perched" ? "perch" : mode === "grounded" ? "ground" : "unsupported",
    transitionState: "committed",
    lastCommittedActionToken: actionToken,
    lastCommittedInitiativeTurnId: initiativeTurnId,
  });
  const appliedStaminaCost = Math.max(0, numberOr(staminaCost, 0));
  let normalized = normalizeCanonicalFlightState({
    ...actor,
    x: horizontalPosition.x,
    y: horizontalPosition.y,
    position: { ...horizontalPosition, altitudeFeet },
    flightState,
  }).actor;
  if (appliedStaminaCost > 0) {
    const previousStamina = numberOr(
      actor.combatStamina?.current ?? actor.currentStamina,
      numberOr(staminaAvailable, 0),
    );
    const nextStamina = Math.max(0, previousStamina - appliedStaminaCost);
    normalized = {
      ...normalized,
      currentStamina: nextStamina,
      combatStamina: actor.combatStamina
        ? { ...actor.combatStamina, current: nextStamina }
        : actor.combatStamina,
    };
  }
  registry.transitions.set(key, { key, actorId, actionToken, initiativeTurnId, generationId, movementSequence, flightState });
  registry.actorSequence.set(actorSequenceKey, numberOr(movementSequence, 0));
  const events = [
    requestedEvent,
    { eventType: "flight-transition-accepted", actorId, data: { transition, actionToken, initiativeTurnId, generationId, movementSequence } },
    { eventType: "flight-position-committed", actorId, data: { x: horizontalPosition.x, y: horizontalPosition.y, altitudeFeet, mode, actionToken, initiativeTurnId, generationId } },
    { eventType: "altitude-authority-updated", actorId, data: { previousAltitudeFeet: fromAltitude, altitudeFeet, actionToken, initiativeTurnId, generationId } },
  ];
  if (appliedStaminaCost > 0) events.push({
    eventType: "combat-stamina-spent",
    actorId,
    data: {
      actionToken,
      initiativeTurnId,
      generationId,
      previous: numberOr(actor.combatStamina?.current ?? actor.currentStamina, numberOr(staminaAvailable, 0)),
      requested: appliedStaminaCost,
      applied: appliedStaminaCost,
      next: normalized.combatStamina?.current ?? normalized.currentStamina,
      reason: `flight-${transition}`,
    },
  });
  if (transition === "takeoff" || transition === "leave-perch") events.push({ eventType: "takeoff-completed", actorId, data: { altitudeFeet, actionToken, initiativeTurnId, generationId } });
  if (transition === "land" || transition === "perch") events.push({ eventType: "landing-completed", actorId, data: { mode, actionToken, initiativeTurnId, generationId } });
  return {
    accepted: true,
    actor: normalized,
    flightState,
    position: normalized.position,
    staminaSpent: appliedStaminaCost,
    movementSpent: Math.max(0, numberOr(movementRequired, 0)),
    transitionKey: key,
    events,
  };
}

export function authorizeAirborneNaturalAttack({
  actor,
  target,
  profile,
  actionToken,
  initiativeTurnId,
  generationId,
  horizontalDistanceFeet = 0,
} = {}) {
  const altitude = getCanonicalAltitude(actor);
  const targetAltitude = getCanonicalAltitude(target);
  const verticalDistance = Math.abs(altitude - targetAltitude);
  const reach = numberOr(profile?.reachFeet ?? profile?.reach, 5);
  const eventData = {
    actionToken, initiativeTurnId, generationId,
    attackKey: profile?.attackKey,
    actorAltitudeFeet: altitude,
    targetAltitudeFeet: targetAltitude,
    horizontalDistanceFeet,
    verticalDistanceFeet: verticalDistance,
  };
  if (!actionToken || !initiativeTurnId) return { accepted: false, reason: "airborne-attack-action-ownership-required", events: [{ eventType: "airborne-attack-rejected", actorId: actor?.id, targetId: target?.id, data: { ...eventData, reason: "airborne-attack-action-ownership-required" } }] };
  if (profile?.swoopProfile && altitude < numberOr(profile.swoopProfile.minimumAltitudeFeet, Infinity)) return { accepted: false, reason: "swoop-minimum-altitude", events: [{ eventType: "swoop-prerequisite-rejected", actorId: actor?.id, targetId: target?.id, data: { ...eventData, reason: "swoop-minimum-altitude" } }] };
  if (!profile?.swoopProfile && profile?.requiresMovement === true) return { accepted: false, reason: "swoop-profile-missing", events: [{ eventType: "swoop-prerequisite-rejected", actorId: actor?.id, targetId: target?.id, data: { ...eventData, reason: "swoop-profile-missing" } }] };
  const maximumAltitude = numberOr(profile?.altitudeRequirements?.maximumActorAltitudeFeet, reach);
  if (altitude > maximumAltitude || verticalDistance > reach || numberOr(horizontalDistanceFeet, 0) > reach) {
    return { accepted: false, reason: "target-outside-aerial-reach", events: [{ eventType: "airborne-attack-rejected", actorId: actor?.id, targetId: target?.id, data: { ...eventData, reason: "target-outside-aerial-reach" } }] };
  }
  return { accepted: true, profile, events: [{ eventType: "airborne-attack-authorized", actorId: actor?.id, targetId: target?.id, data: eventData }] };
}

export function resolveCanonicalFall({
  actor,
  fallToken,
  actionToken,
  initiativeTurnId,
  generationId,
  registry = createFlightAuthorityRegistry(),
  landingPosition,
} = {}) {
  const key = String(fallToken || "");
  if (!key || !actionToken || !initiativeTurnId) return { accepted: false, reason: "fall-ownership-required", actor, events: [] };
  if (registry.falls.has(key)) return { accepted: false, reason: "duplicate-fall-completion", actor, events: [] };
  if (actor?.flightState?.lastCommittedInitiativeTurnId && actor.flightState.lastCommittedInitiativeTurnId !== initiativeTurnId) {
    return { accepted: false, reason: "stale-fall-callback", actor, events: [{ eventType: "stale-flight-callback-rejected", actorId: actor?.id, data: { fallToken, actionToken, initiativeTurnId, generationId } }] };
  }
  const startingAltitudeFeet = getCanonicalAltitude(actor);
  const horizontalPosition = landingPosition || actor.flightState?.horizontalPosition || actor.position || { x: actor.x, y: actor.y };
  const grounded = normalizeCanonicalFlightState({
    ...actor,
    position: { x: horizontalPosition.x, y: horizontalPosition.y, altitudeFeet: 0 },
    flightState: createCanonicalFlightState({
      mode: "grounded",
      altitudeFeet: 0,
      horizontalPosition,
      lastCommittedActionToken: actionToken,
      lastCommittedInitiativeTurnId: initiativeTurnId,
    }),
    prone: true,
  }).actor;
  registry.falls.set(key, { actorId: actor?.id, fallToken, actionToken, initiativeTurnId, generationId, completed: true });
  return {
    accepted: true,
    actor: grounded,
    damage: 0,
    events: [
      { eventType: "falling-started", actorId: actor?.id, data: { fallToken, actionToken, initiativeTurnId, generationId, startingAltitudeFeet } },
      { eventType: "fall-distance-resolved", actorId: actor?.id, data: { fallToken, startingAltitudeFeet, damageAuthority: "not-defined" } },
      { eventType: "landing-location-resolved", actorId: actor?.id, data: { fallToken, x: horizontalPosition.x, y: horizontalPosition.y } },
      { eventType: "falling-completed", actorId: actor?.id, data: { fallToken, actionToken, initiativeTurnId, generationId, damage: 0 } },
    ],
  };
}

export function getCanonicalFlightPresentation(actor = {}) {
  const altitudeFeet = getCanonicalAltitude(actor);
  const mode = actor.flightState?.mode || (altitudeFeet > 0 ? "airborne" : "grounded");
  return Object.freeze({
    mode,
    altitudeFeet,
    altitudeBand: getAltitudeBand(altitudeFeet),
    compactMarker: altitudeFeet > 0 ? `↑${Math.round(altitudeFeet)}` : "",
    modelElevationFeet: altitudeFeet,
    accessibilityLabel: `${actor.species || actor.name || "actor"}; ${mode}; ${Math.round(altitudeFeet)} feet; stamina ${actor.combatStamina?.current ?? actor.currentStamina ?? "unknown"}; attacks ${(actor.naturalAttackProfiles || actor.attacks || []).map((profile) => profile.displayName || profile.name).join(", ") || "none"}`,
  });
}

export default {
  FLIGHT_MODES,
  authorizeAirborneNaturalAttack,
  createCanonicalFlightState,
  createFlightAuthorityRegistry,
  getAltitudeBand,
  getCanonicalAltitude,
  getCanonicalFlightPresentation,
  isCanonicallyAirborne,
  normalizeCanonicalFlightState,
  resolveCanonicalFall,
  resolveFlightTransition,
};
