import {
  claimCanonicalFall,
  createCanonicalFallRegistry,
  resolveCanonicalFall,
} from "./canonicalFallingState.js";

export const CARRIER_RELATIONSHIP_TYPES = Object.freeze([
  "mounted",
  "flying-mounted",
  "prey-carry",
  "hostile-carry",
  "consensual-carry",
]);

export const CARRIER_CONTROL_TYPES = Object.freeze([
  "rider-controlled",
  "carrier-controlled",
  "independent-intelligent-mount",
  "restrained-prey",
  "consensual-passenger",
]);

export const CARRIER_LINK_STATES = Object.freeze([
  "forming",
  "attached",
  "moving",
  "airborne",
  "struggling",
  "releasing",
  "dismounting",
  "falling",
  "released",
  "broken",
]);

const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const text = (value) => String(value || "").trim().toLowerCase();
const clonePosition = (position = {}) => ({
  x: finite(position.x, 0),
  y: finite(position.y, 0),
  altitudeFeet: Math.max(0, finite(position.altitudeFeet, 0)),
});
const sizeWeightCompatibility = Object.freeze({
  tiny: 5,
  small: 30,
  medium: 150,
  large: 600,
  huge: 2000,
  "large-heavy": 6000,
});

const event = (eventType, link, data = {}) => ({
  eventType,
  actorId: link?.carrierId ?? null,
  targetId: link?.passengerId ?? null,
  data: {
    linkId: link?.linkId ?? null,
    generationId: link?.generationId ?? null,
    initiativeTurnId: link?.initiativeTurnId ?? null,
    actionToken: link?.currentActionToken ?? link?.establishedByActionToken ?? null,
    ...data,
  },
});

const playerEvent = (eventType, message) => ({ eventType, message });

export function createCanonicalCarrierRegistry({
  fallRegistry = createCanonicalFallRegistry(),
} = {}) {
  return {
    links: new Map(),
    activeByCarrier: new Map(),
    activeByPassenger: new Map(),
    releasedLinkIds: new Set(),
    schedules: new Map(),
    fallRegistry,
  };
}

const equipmentWeight = (equipment) => (Array.isArray(equipment) ? equipment : [])
  .reduce((sum, item) => sum + Math.max(0, finite(item?.weight ?? item?.weightLbs, 0)), 0);

export function resolveCarrierCapacity({
  carrier,
  passenger,
  passengerEquipment,
  relationshipType,
  carrierProfile,
} = {}) {
  const profile = carrierProfile || carrier?.carrierProfile || {};
  const passengerWeight = Math.max(0, finite(
    passenger?.weight
      ?? passenger?.weightLbs
      ?? passenger?.attributes?.weight
      ?? passenger?.stats?.weight,
    sizeWeightCompatibility[text(passenger?.size)] ?? 150,
  ));
  const resolvedEquipmentWeight = equipmentWeight(
    passengerEquipment
      ?? passenger?.equipment
      ?? passenger?.inventory,
  );
  const totalLoad = passengerWeight + resolvedEquipmentWeight;
  const maximumLoad = Math.max(0, finite(
    profile.maximumLoad
      ?? profile.maximumLoadLbs
      ?? profile.carryingCapacity,
    0,
  ));
  const loadRatio = maximumLoad > 0 ? totalLoad / maximumLoad : Infinity;
  let capacityState = "impossible";
  if (maximumLoad > 0 && loadRatio <= 0.25) capacityState = "trivial";
  else if (maximumLoad > 0 && loadRatio <= 0.7) capacityState = "normal";
  else if (maximumLoad > 0 && loadRatio <= 1) capacityState = "strained";
  else if (maximumLoad > 0 && loadRatio <= 1.25) capacityState = "overloaded";
  const flightRelationship = ["prey-carry", "flying-mounted"].includes(relationshipType);
  const allowedType = !Array.isArray(profile.allowedRelationshipTypes)
    || profile.allowedRelationshipTypes.includes(relationshipType);
  const allowed = allowedType
    && maximumLoad > 0
    && loadRatio <= 1
    && !(flightRelationship && capacityState === "overloaded");
  return Object.freeze({
    allowed,
    passengerWeight,
    equipmentWeight: resolvedEquipmentWeight,
    totalLoad,
    maximumLoad,
    loadRatio,
    capacityState,
    reason: !allowedType
      ? "relationship-type-not-supported"
      : maximumLoad <= 0
        ? "carrier-capacity-not-authoritative"
        : loadRatio > 1
          ? (capacityState === "overloaded" ? "carrier-overloaded" : "load-impossible")
          : "",
    authority: profile.authority || "compatibility-profile",
  });
}

export function validateCanonicalQuarry({ carrier, passenger } = {}) {
  const armored = Boolean(
    passenger?.equippedArmor
    || passenger?.wornArmor
    || passenger?.armorProfile?.rigidCoverage
    || ["plate", "mail", "heavy"].includes(text(passenger?.armorProfile?.armorClass || passenger?.armorProfile?.category)),
  );
  const humanoid = text(passenger?.creatureType) === "humanoid"
    || text(passenger?.species) === "human";
  const quarryEligible = passenger?.quarryProfile?.eligible === true
    || (text(passenger?.size) === "tiny" && !humanoid && !armored);
  const carrierIsRaptor = ["hawk", "falcon"].includes(text(carrier?.actorKey || carrier?.species));
  return quarryEligible && carrierIsRaptor && !armored
    ? { accepted: true, reason: "", eventType: "quarry-accepted" }
    : {
        accepted: false,
        reason: armored ? "armored-target-not-ordinary-quarry" : "illegal-quarry",
        eventType: "quarry-rejected",
      };
}

export function establishPreyControl({
  carrier,
  passenger,
  controlResult,
  actionToken,
  initiativeTurnId,
  generationId,
} = {}) {
  const quarry = validateCanonicalQuarry({ carrier, passenger });
  const reciprocal = controlResult?.carrierId === idOf(carrier)
    && controlResult?.passengerId === idOf(passenger);
  if (!quarry.accepted || controlResult?.accepted !== true || !reciprocal) {
    return {
      accepted: false,
      reason: !quarry.accepted ? quarry.reason : "prey-control-required",
      events: [event("prey-control-rejected", {
        carrierId: idOf(carrier),
        passengerId: idOf(passenger),
        generationId,
        initiativeTurnId,
        currentActionToken: actionToken,
      }, { reason: !quarry.accepted ? quarry.reason : "prey-control-required" })],
    };
  }
  const controlKey = `${generationId}:${initiativeTurnId}:${actionToken}:prey-control:${idOf(carrier)}:${idOf(passenger)}`;
  return {
    accepted: true,
    controlRecord: Object.freeze({
      controlKey,
      carrierId: idOf(carrier),
      passengerId: idOf(passenger),
      generationId,
      initiativeTurnId,
      actionToken,
      state: "established",
    }),
    events: [event("prey-control-established", {
      carrierId: idOf(carrier),
      passengerId: idOf(passenger),
      generationId,
      initiativeTurnId,
      currentActionToken: actionToken,
    }, { controlKey })],
  };
}

const rejectLink = (reason, request = {}) => ({
  accepted: false,
  reason,
  events: [event("carrier-link-rejected", {
    carrierId: idOf(request.carrier),
    passengerId: idOf(request.passenger),
    generationId: request.generationId,
    initiativeTurnId: request.initiativeTurnId,
    currentActionToken: request.actionToken,
  }, { reason })],
});

export function establishCanonicalCarrierLink(request = {}) {
  const {
    registry = createCanonicalCarrierRegistry(),
    carrier,
    passenger,
    relationshipType,
    controlType,
    generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn = {},
    controlRecord = null,
    passengerOffset = { x: 0, y: 0, altitudeFeet: 0 },
    saddleState = "none",
    harnessState = "none",
    restraintState = "none",
  } = request;
  const carrierId = idOf(carrier);
  const passengerId = idOf(passenger);
  const actionOwnerId = request.actionOwnerId || carrierId;
  if (!carrierId || !passengerId) return rejectLink("carrier-and-passenger-required", request);
  if (carrierId === passengerId) return rejectLink("carrier-equals-passenger", request);
  if (!CARRIER_RELATIONSHIP_TYPES.includes(relationshipType)) return rejectLink("invalid-relationship-type", request);
  if (!CARRIER_CONTROL_TYPES.includes(controlType)) return rejectLink("invalid-control-type", request);
  if (!generationId || !initiativeTurnId || !actionToken) return rejectLink("carrier-link-ownership-required", request);
  if (
    !authoritativeTurn.generationId
    || !authoritativeTurn.initiativeTurnId
    || !authoritativeTurn.actionToken
    || !authoritativeTurn.actorId
  ) return rejectLink("carrier-link-ownership-required", request);
  if (
    (authoritativeTurn.generationId != null && authoritativeTurn.generationId !== generationId)
    || (authoritativeTurn.initiativeTurnId && authoritativeTurn.initiativeTurnId !== initiativeTurnId)
    || (authoritativeTurn.actorId && authoritativeTurn.actorId !== actionOwnerId)
    || (authoritativeTurn.actionToken && authoritativeTurn.actionToken !== actionToken)
  ) return rejectLink("stale-carrier-action", request);
  if (registry.activeByCarrier.has(carrierId)) return rejectLink("duplicate-active-carrier-link", request);
  if (registry.activeByPassenger.has(passengerId)) return rejectLink("passenger-already-attached", request);
  if (["prey-carry", "hostile-carry"].includes(relationshipType)) {
    if (
      !controlRecord
      || controlRecord.state !== "established"
      || controlRecord.carrierId !== carrierId
      || controlRecord.passengerId !== passengerId
      || controlRecord.actionToken !== actionToken
    ) return rejectLink("carry-without-control", request);
  }
  const capacity = resolveCarrierCapacity({
    carrier,
    passenger,
    passengerEquipment: request.passengerEquipment,
    relationshipType,
    carrierProfile: request.carrierProfile,
  });
  if (!capacity.allowed) return rejectLink(capacity.reason || "carry-over-capacity", request);
  const linkId = String(
    request.linkId
      || `${generationId}:${initiativeTurnId}:${actionToken}:carrier:${carrierId}:${passengerId}`,
  );
  if (registry.links.has(linkId)) return rejectLink("duplicate-carrier-link", request);
  const altitude = Math.max(0, finite(
    carrier?.flightState?.altitudeFeet
      ?? carrier?.position?.altitudeFeet
      ?? carrier?.altitudeFeet
      ?? carrier?.altitude,
    0,
  ));
  const now = Date.now();
  const link = {
    linkId,
    carrierId,
    passengerId,
    relationshipType,
    controlType,
    state: altitude > 0 ? "airborne" : "attached",
    positionAuthority: "carrier",
    altitudeAuthority: "carrier",
    generationId,
    initiativeTurnId,
    establishedByActionToken: actionToken,
    currentActionToken: actionToken,
    releasedByActionToken: null,
    passengerOffset: Object.freeze(clonePosition(passengerOffset)),
    passengerWeight: capacity.passengerWeight,
    equipmentWeight: capacity.equipmentWeight,
    totalLoad: capacity.totalLoad,
    capacityClass: capacity.capacityState,
    overloaded: capacity.capacityState === "overloaded",
    restraintState,
    saddleState,
    harnessState,
    reinsState: request.reinsState || "none",
    mountedState: relationshipType === "mounted"
      ? Object.freeze({
          pairId: linkId,
          riderId: passengerId,
          mountId: carrierId,
          initiativeTurnId,
          generationId,
          state: "mounted",
          controlState: controlType === "rider-controlled" ? "controlled" : "independent",
          saddleState,
          reinsState: request.reinsState || "none",
          riderSeatState: "seated",
          currentActionOwner: null,
          coordinatedActionId: null,
        })
      : null,
    createdAt: now,
    completedAt: null,
  };
  registry.links.set(linkId, link);
  registry.activeByCarrier.set(carrierId, linkId);
  registry.activeByPassenger.set(passengerId, linkId);
  return {
    accepted: true,
    link: Object.freeze({ ...link }),
    capacity,
    events: [
      event("carrier-link-requested", link),
      event("capacity-check-resolved", link, {
        capacityState: capacity.capacityState,
        totalLoad: capacity.totalLoad,
        maximumLoad: capacity.maximumLoad,
      }),
      event("carrier-link-established", link),
      ...(relationshipType === "mounted" ? [event("mount-link-established", link)] : []),
      ...(relationshipType === "prey-carry" ? [event("prey-lifted", link)] : []),
    ],
    playerEvents: [playerEvent(
      relationshipType === "mounted" ? "mount-established" : "carry-established",
      relationshipType === "mounted"
        ? `${passenger?.name || "Rider"} mounts ${carrier?.name || "mount"}.`
        : `${carrier?.name || "Carrier"} secures ${passenger?.name || "passenger"}.`,
    )],
  };
}

export function deriveCanonicalPassengerPosition({ link, carrier } = {}) {
  if (!link || link.positionAuthority !== "carrier" || link.altitudeAuthority !== "carrier") {
    return { accepted: false, reason: "invalid-carrier-link", events: [] };
  }
  const carrierPosition = clonePosition({
    ...(carrier?.position || {}),
    x: carrier?.position?.x ?? carrier?.x,
    y: carrier?.position?.y ?? carrier?.y,
    altitudeFeet: carrier?.flightState?.altitudeFeet
      ?? carrier?.position?.altitudeFeet
      ?? carrier?.altitudeFeet
      ?? carrier?.altitude
      ?? 0,
  });
  const offset = link.passengerOffset || {};
  const position = Object.freeze({
    x: carrierPosition.x + finite(offset.x, 0),
    y: carrierPosition.y + finite(offset.y, 0),
    altitudeFeet: Math.max(0, carrierPosition.altitudeFeet + finite(offset.altitudeFeet, 0)),
  });
  return {
    accepted: true,
    position,
    events: [event("passenger-position-derived", link, { position })],
  };
}

export function commitCanonicalCarrierMovement({
  registry,
  linkId,
  carrier,
  passenger,
  destination,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn = {},
} = {}) {
  const link = registry?.links?.get(String(linkId || ""));
  if (
    !link
    || registry.activeByCarrier.get(link.carrierId) !== link.linkId
    || link.carrierId !== idOf(carrier)
    || link.passengerId !== idOf(passenger)
  ) return rejectLink("invalid-carrier-link", { carrier, passenger, generationId, initiativeTurnId, actionToken });
  if (
    link.generationId !== generationId
    || !initiativeTurnId
    || !actionToken
    || authoritativeTurn.generationId !== generationId
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || authoritativeTurn.actorId !== idOf(carrier)
    || authoritativeTurn.actionToken !== actionToken
  ) return {
    accepted: false,
    reason: "stale-carrier-callback",
    carrier,
    passenger,
    events: [event("stale-carrier-callback-rejected", link, { reason: "stale-carrier-callback" })],
  };
  const carrierPosition = clonePosition(destination);
  const nextCarrier = {
    ...carrier,
    position: carrierPosition,
    x: carrierPosition.x,
    y: carrierPosition.y,
    altitude: carrierPosition.altitudeFeet,
    altitudeFeet: carrierPosition.altitudeFeet,
  };
  if (nextCarrier.flightState) {
    nextCarrier.flightState = Object.freeze({
      ...nextCarrier.flightState,
      altitudeFeet: carrierPosition.altitudeFeet,
      altitudeBand: carrierPosition.altitudeFeet <= 0 ? "ground" : carrierPosition.altitudeFeet <= 10 ? "low" : carrierPosition.altitudeFeet <= 30 ? "medium" : "high",
      horizontalPosition: Object.freeze({ x: carrierPosition.x, y: carrierPosition.y }),
      mode: carrierPosition.altitudeFeet > 0 ? "airborne" : "grounded",
    });
  }
  link.currentActionToken = actionToken;
  link.initiativeTurnId = initiativeTurnId;
  link.state = carrierPosition.altitudeFeet > 0 ? "airborne" : "moving";
  const derived = deriveCanonicalPassengerPosition({ link, carrier: nextCarrier });
  const nextPassenger = {
    ...passenger,
    position: { ...derived.position },
    x: derived.position.x,
    y: derived.position.y,
    altitude: derived.position.altitudeFeet,
    altitudeFeet: derived.position.altitudeFeet,
  };
  return {
    accepted: true,
    carrier: nextCarrier,
    passenger: nextPassenger,
    link: Object.freeze({ ...link }),
    events: [
      event("carrier-link-state-changed", link, { state: link.state }),
      ...derived.events,
      ...(link.relationshipType === "prey-carry" ? [event("prey-carried", link)] : []),
    ],
  };
}

export function rejectIndependentPassengerMovement({
  registry,
  passenger,
  requestedPosition,
} = {}) {
  const linkId = registry?.activeByPassenger?.get(idOf(passenger));
  if (!linkId) return { accepted: true, position: clonePosition(requestedPosition), events: [] };
  const link = registry.links.get(linkId);
  return {
    accepted: false,
    reason: "passenger-independent-movement",
    passenger,
    events: [
      event("passenger-independent-movement-rejected", link, { requestedPosition }),
      ...(link.relationshipType === "mounted"
        ? [event("mount-independent-rider-movement-rejected", link, { requestedPosition })]
        : []),
    ],
  };
}

export function registerCanonicalCarrierSchedule({
  registry,
  scheduleId,
  scheduleKind,
  ownerType = "carrier-link",
  ownerId,
  generationId,
  initiativeTurnId,
  actionToken,
} = {}) {
  if (!registry || !scheduleId || !ownerId || !generationId || !initiativeTurnId || !actionToken) {
    return { accepted: false, reason: "carrier-schedule-ownership-required" };
  }
  const record = Object.freeze({
    scheduleId,
    scheduleKind,
    ownerType,
    ownerId,
    generationId,
    initiativeTurnId,
    actionToken,
    state: "pending",
    cancellationReason: null,
  });
  registry.schedules.set(scheduleId, record);
  return { accepted: true, schedule: record };
}

export function validateCanonicalCarrierSchedule({
  registry,
  scheduleId,
  generationId,
  initiativeTurnId,
  actionToken,
  combatActive = true,
  carrier = null,
  passenger = null,
} = {}) {
  const schedule = registry?.schedules?.get(scheduleId);
  const link = schedule ? registry.links.get(schedule.ownerId) : null;
  const accepted = Boolean(
    schedule
    && schedule.state === "pending"
    && schedule.generationId === generationId
    && schedule.initiativeTurnId === initiativeTurnId
    && schedule.actionToken === actionToken
    && link
    && registry.activeByCarrier.get(link.carrierId) === link.linkId
    && combatActive !== false
    && (!carrier || (
      idOf(carrier) === link.carrierId
      && !carrier.dead
      && !carrier.isDead
      && !carrier.unconscious
      && !carrier.isUnconscious
    ))
    && (!passenger || idOf(passenger) === link.passengerId)
  );
  if (accepted) return { accepted: true, schedule, events: [] };
  const cancellationReason = combatActive === false
    ? "encounter-ended"
    : carrier && (carrier.dead || carrier.isDead || carrier.unconscious || carrier.isUnconscious)
      ? "carrier-terminal"
      : passenger && link && idOf(passenger) !== link.passengerId
        ? "target-changed"
        : schedule?.generationId !== generationId
          ? "generation-changed"
          : schedule?.initiativeTurnId !== initiativeTurnId
            ? "initiative-turn-changed"
            : schedule?.actionToken !== actionToken
              ? "action-token-changed"
              : "relationship-broken";
  const canceledSchedule = schedule
    ? Object.freeze({ ...schedule, state: "canceled", cancellationReason })
    : null;
  if (schedule && registry?.schedules) registry.schedules.set(scheduleId, canceledSchedule);
  return {
    accepted: false,
    reason: "stale-carrier-callback",
    schedule: canceledSchedule,
    events: [event("stale-carrier-callback-rejected", link, {
      reason: "stale-carrier-callback",
      cancellationReason,
      scheduleId,
    })],
  };
}

export function cancelCanonicalCarrierSchedules(registry, ownerId, cancellationReason) {
  const canceled = [];
  for (const [scheduleId, schedule] of registry?.schedules || []) {
    if (schedule.ownerId !== ownerId || schedule.state !== "pending") continue;
    const next = Object.freeze({ ...schedule, state: "canceled", cancellationReason });
    registry.schedules.set(scheduleId, next);
    canceled.push(next);
  }
  return canceled;
}

export function releaseCanonicalCarrierLink({
  registry,
  linkId,
  carrier,
  passenger,
  generationId,
  initiativeTurnId,
  actionToken,
  cause = "release",
  landingPosition,
  occupied = false,
  emergency = false,
  authoritativeTurn = {},
  actionOwnerId = null,
} = {}) {
  const link = registry?.links?.get(String(linkId || ""));
  if (!link || registry.activeByCarrier.get(link.carrierId) !== link.linkId) {
    return rejectLink(
      registry?.releasedLinkIds?.has(String(linkId || "")) ? "duplicate-release" : "invalid-carrier-link",
      { carrier, passenger, generationId, initiativeTurnId, actionToken },
    );
  }
  if (
    link.carrierId !== idOf(carrier)
    || link.passengerId !== idOf(passenger)
    || link.generationId !== generationId
    || !initiativeTurnId
    || !actionToken
    || authoritativeTurn.generationId !== generationId
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || authoritativeTurn.actionToken !== actionToken
    || authoritativeTurn.actorId !== (actionOwnerId || idOf(carrier))
  ) return {
    accepted: false,
    reason: "stale-carrier-callback",
    events: [event("stale-carrier-callback-rejected", link, { reason: "stale-carrier-callback" })],
  };
  if (occupied) return rejectLink("occupied-dismount-destination", {
    carrier, passenger, generationId, initiativeTurnId, actionToken,
  });
  const derived = deriveCanonicalPassengerPosition({ link, carrier });
  const releasePosition = clonePosition(landingPosition || derived.position);
  const startingAltitudeFeet = derived.position.altitudeFeet;
  link.currentActionToken = actionToken;
  link.state = emergency || startingAltitudeFeet > 0 ? "falling"
    : link.relationshipType === "mounted" ? "dismounting" : "releasing";
  const transitionEvent = event("carrier-link-state-changed", link, { state: link.state });
  let fallClaim = null;
  if (startingAltitudeFeet > 0 || emergency) {
    fallClaim = claimCanonicalFall({
      registry: registry.fallRegistry,
      actor: passenger,
      sourceActorId: link.carrierId,
      sourceRelationshipId: link.linkId,
      cause: emergency ? "emergency-dismount" : cause,
      startingPosition: derived.position,
      startingAltitudeFeet,
      landingPosition: releasePosition,
      generationId,
      initiativeTurnId,
      actionToken,
    });
    if (!fallClaim.accepted) return fallClaim;
  }
  registry.activeByCarrier.delete(link.carrierId);
  registry.activeByPassenger.delete(link.passengerId);
  registry.releasedLinkIds.add(link.linkId);
  cancelCanonicalCarrierSchedules(registry, link.linkId, "carrier-link-released");
  link.releasedByActionToken = actionToken;
  link.state = "released";
  link.completedAt = Date.now();
  const releasedPassenger = {
    ...passenger,
    position: releasePosition,
    x: releasePosition.x,
    y: releasePosition.y,
    altitude: startingAltitudeFeet > 0 ? startingAltitudeFeet : 0,
    altitudeFeet: startingAltitudeFeet > 0 ? startingAltitudeFeet : 0,
  };
  return {
    accepted: true,
    carrier,
    passenger: releasedPassenger,
    passengerPosition: releasePosition,
    link: Object.freeze({ ...link }),
    fallClaim,
    events: [
      transitionEvent,
      ...derived.events,
      ...(fallClaim?.events || []),
      event("carrier-link-released", link, { cause }),
      ...(link.relationshipType === "mounted" ? [event("mount-link-released", link, { cause })] : []),
      ...(link.relationshipType === "prey-carry" ? [event("prey-released", link, { cause })] : []),
    ],
  };
}

export function resolveReleasedPassengerFall({
  registry,
  release,
  actor,
  generationId,
  initiativeTurnId,
  actionToken,
  authorizeImpact,
  resolveImpact,
} = {}) {
  if (!release?.fallClaim?.accepted) {
    return { accepted: true, actor, damage: 0, events: [] };
  }
  return resolveCanonicalFall({
    registry: registry.fallRegistry,
    fallId: release.fallClaim.fallId,
    actor,
    generationId,
    initiativeTurnId,
    actionToken,
    authorizeImpact,
    resolveImpact,
  });
}

export function resolvePreyStruggle({
  registry,
  linkId,
  opposedResult,
  actionToken,
  carrier,
  passenger,
  generationId,
  initiativeTurnId,
  landingPosition,
  authoritativeTurn,
  actionOwnerId,
} = {}) {
  const link = registry?.links?.get(String(linkId || ""));
  if (!link || link.relationshipType !== "prey-carry") return { accepted: false, reason: "invalid-prey-carry-link", events: [] };
  if (!actionToken) return { accepted: false, reason: "prey-struggle-action-token-required", events: [] };
  link.currentActionToken = actionToken;
  link.state = opposedResult?.escaped === true ? "broken" : "struggling";
  const struggleEvent = event("prey-struggle-resolved", link, {
    escaped: opposedResult?.escaped === true,
    resolutionSource: "existing-grapple-opposition",
  });
  if (opposedResult?.escaped === true) {
    const released = releaseCanonicalCarrierLink({
      registry,
      linkId,
      carrier,
      passenger,
      generationId,
      initiativeTurnId,
      actionToken,
      cause: "prey-control-broken",
      landingPosition,
      authoritativeTurn,
      actionOwnerId,
    });
    return {
      ...released,
      escaped: true,
      events: [struggleEvent, ...(released.events || [])],
    };
  }
  return {
    accepted: true,
    escaped: false,
    link: Object.freeze({ ...link }),
    events: [struggleEvent],
  };
}

export function validateCanonicalCarrierRelationships({ registry, actors = [] } = {}) {
  const diagnostics = [];
  const actorById = new Map(actors.map((actor) => [idOf(actor), actor]));
  const passengerOwners = new Map();
  for (const link of registry?.links?.values?.() || []) {
    if (["released", "broken"].includes(link.state)) continue;
    if (link.carrierId === link.passengerId) diagnostics.push(event("invalid-carrier-link", link, { reason: "carrier-equals-passenger" }));
    if (!actorById.has(link.carrierId)) diagnostics.push(event("invalid-carrier-link", link, { reason: "missing-carrier" }));
    if (!actorById.has(link.passengerId)) diagnostics.push(event("invalid-carrier-link", link, { reason: "missing-passenger" }));
    if (passengerOwners.has(link.passengerId)) diagnostics.push(event("duplicate-carrier-link", link, { reason: "passenger-attached-multiple-times" }));
    passengerOwners.set(link.passengerId, link.carrierId);
    if (link.positionAuthority !== "carrier" || link.altitudeAuthority !== "carrier") diagnostics.push(event("invalid-carrier-link", link, { reason: "invalid-authority" }));
    if (link.overloaded) diagnostics.push(event("invalid-carrier-link", link, { reason: "carry-over-capacity" }));
    const carrier = actorById.get(link.carrierId);
    const passenger = actorById.get(link.passengerId);
    if (carrier && passenger && carrier !== passenger) {
      if (carrier.hpState && carrier.hpState === passenger.hpState) diagnostics.push(event("mount-rider-hp-merge", link));
      if (carrier.armorProfile && carrier.armorProfile === passenger.armorProfile) diagnostics.push(event("invalid-carrier-link", link, { reason: "shared-armor-object" }));
      if (carrier.naturalAttackProfiles && carrier.naturalAttackProfiles === passenger.naturalAttackProfiles) diagnostics.push(event("invalid-carrier-link", link, { reason: "shared-natural-attacks" }));
    }
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

export function executeCanonicalMountAction({
  registry,
  rider,
  mount,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
  saddleState = "none",
  harnessState = "none",
  reinsState = "none",
} = {}) {
  if (mount?.mountProfile?.mayServeAsMount !== true) {
    return rejectLink("mounted-link-without-mount-profile", {
      carrier: mount, passenger: rider, generationId, initiativeTurnId, actionToken,
    });
  }
  if (rider?.riderProfile?.mayRide !== true) {
    return rejectLink("mounted-link-without-rider-profile", {
      carrier: mount, passenger: rider, generationId, initiativeTurnId, actionToken,
    });
  }
  if (
    !mount.mountProfile.permittedRiderSizes?.includes?.(text(rider?.size))
    || Number(mount.mountProfile.maximumRiders) !== 1
  ) {
    return rejectLink("mounted-profile-incompatible", {
      carrier: mount, passenger: rider, generationId, initiativeTurnId, actionToken,
    });
  }
  return establishCanonicalCarrierLink({
    registry,
    carrier: mount,
    passenger: rider,
    relationshipType: "mounted",
    controlType: "rider-controlled",
    generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn: {
      ...authoritativeTurn,
    },
    actionOwnerId: idOf(rider),
    saddleState,
    harnessState,
    reinsState,
  });
}

export function executeCanonicalDismountAction({
  registry,
  linkId,
  rider,
  mount,
  generationId,
  initiativeTurnId,
  actionToken,
  destination,
  occupied = false,
  emergency = false,
  authoritativeTurn,
} = {}) {
  return releaseCanonicalCarrierLink({
    registry,
    linkId,
    carrier: mount,
    passenger: rider,
    generationId,
    initiativeTurnId,
    actionToken,
    cause: emergency ? "emergency-dismount" : "dismount",
    landingPosition: destination,
    occupied,
    emergency,
    authoritativeTurn,
    actionOwnerId: idOf(rider),
  });
}

export default {
  CARRIER_CONTROL_TYPES,
  CARRIER_LINK_STATES,
  CARRIER_RELATIONSHIP_TYPES,
  cancelCanonicalCarrierSchedules,
  commitCanonicalCarrierMovement,
  createCanonicalCarrierRegistry,
  deriveCanonicalPassengerPosition,
  executeCanonicalDismountAction,
  executeCanonicalMountAction,
  establishCanonicalCarrierLink,
  establishPreyControl,
  registerCanonicalCarrierSchedule,
  rejectIndependentPassengerMovement,
  releaseCanonicalCarrierLink,
  resolveCarrierCapacity,
  resolvePreyStruggle,
  resolveReleasedPassengerFall,
  validateCanonicalCarrierRelationships,
  validateCanonicalCarrierSchedule,
  validateCanonicalQuarry,
};
