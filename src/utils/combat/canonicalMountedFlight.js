import {
  commitCanonicalCarrierMovement,
  deriveCanonicalPassengerPosition,
  establishCanonicalCarrierLink,
  rejectIndependentPassengerMovement,
  releaseCanonicalCarrierLink,
  resolveCarrierCapacity,
  resolveReleasedPassengerFall,
} from "./canonicalCarrierLink.js";
import {
  claimCanonicalFall,
  createCanonicalFallRegistry,
  resolveCanonicalFall,
} from "./canonicalFallingState.js";
import {
  claimCanonicalMountedAction,
  completeCanonicalMountedAction,
  consumeCanonicalMountedContinuation,
  createCanonicalMountedCombatRegistry,
  createCanonicalMountedContinuation,
  createCanonicalMountedTurn,
  getCanonicalMountedPair,
} from "./canonicalMountedCombat.js";
import {
  createFlightAuthorityRegistry,
  getCanonicalAltitude,
  resolveFlightTransition,
} from "./canonicalFlightState.js";
import {
  isCanonicalNaturalAttack,
  isHumanoidSurrenderAllowedForActor,
} from "./canonicalNaturalAttacks.js";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const freeze = (value) => Object.freeze({ ...value });
const positionOf = (actor = {}) => freeze({
  x: finite(actor.position?.x ?? actor.x),
  y: finite(actor.position?.y ?? actor.y),
  altitudeFeet: Math.max(0, finite(actor.flightState?.altitudeFeet ?? actor.position?.altitudeFeet ?? actor.altitudeFeet ?? actor.altitude)),
});
const actorTerminal = (actor = {}) => Boolean(
  actor.dead || actor.isDead || actor.unconscious || actor.isUnconscious
  || actor.captured || actor.isCaptured || actor.canAct === false,
);
const event = (eventType, record = {}, data = {}) => ({
  eventType,
  actorId: record.riderId ?? record.mountId ?? null,
  targetId: data.targetId ?? record.targetId ?? null,
  data: {
    pairId: record.pairId ?? null,
    riderId: record.riderId ?? null,
    mountId: record.mountId ?? null,
    generationId: record.generationId ?? null,
    initiativeTurnId: record.initiativeTurnId ?? null,
    actionToken: record.actionToken ?? null,
    ...data,
  },
});
const reject = (reason, record = {}, eventType = "mounted-flight-action-rejected", data = {}) => ({
  accepted: false,
  reason,
  events: [event(eventType, record, { reason, ...data })],
});

const contract = (key, label, owner, options = {}) => freeze({
  key,
  label,
  category: options.category || "Mounted Flight",
  executor: options.executor,
  owner,
  actionCost: options.actionCost ?? 1,
  riderActionCost: options.riderActionCost,
  mountActionCost: options.mountActionCost,
  staminaOwner: options.staminaOwner ?? null,
  tokenRequired: true,
  legalMountStates: options.legalMountStates || [],
  legalRiderStates: options.legalRiderStates || ["attached"],
  altitudeRequirements: options.altitudeRequirements || "profile",
  loadRequirements: options.loadRequirements || "legal-flight-load",
  attachmentRequirements: options.attachmentRequirements || ["secured", "saddled", "harnessed", "bareback"],
  targetRequirements: options.targetRequirements || null,
  turnEnding: options.turnEnding === true,
  aiAvailable: options.aiAvailable !== false,
  playerVisible: options.playerVisible !== false,
});

export const MOUNTED_FLIGHT_STATES = Object.freeze([
  "grounded-mounted", "taking-off", "airborne", "ascending", "descending",
  "landing", "perched", "out-of-control", "linked-falling", "released",
]);

export const RIDER_ATTACHMENT_STATES = Object.freeze([
  "secured", "saddled", "harnessed", "bareback", "loose", "failing", "released",
]);

export const MOUNTED_FLIGHT_ACTION_CONTRACTS = Object.freeze({
  "flying-mount-takeoff": contract("flying-mount-takeoff", "Flying Mount Takeoff", "mount", { executor: "executeCanonicalMountedFlightTransition", staminaOwner: "mount", legalMountStates: ["grounded-mounted", "perched"] }),
  "flying-mount-ascend": contract("flying-mount-ascend", "Flying Mount Ascend", "mount", { executor: "executeCanonicalMountedFlightTransition", staminaOwner: "mount", legalMountStates: ["airborne", "descending"] }),
  "flying-mount-descend": contract("flying-mount-descend", "Flying Mount Descend", "mount", { executor: "executeCanonicalMountedFlightTransition", staminaOwner: "mount", legalMountStates: ["airborne", "ascending"] }),
  "mounted-flight-move": contract("mounted-flight-move", "Mounted Flight Move", "mount", { executor: "executeCanonicalMountedFlightTransition", staminaOwner: "mount", legalMountStates: ["airborne", "ascending", "descending"] }),
  "flying-mount-land": contract("flying-mount-land", "Flying Mount Land", "mount", { executor: "executeCanonicalMountedFlightTransition", staminaOwner: "mount", legalMountStates: ["airborne", "descending", "landing"], turnEnding: true }),
  "secure-seat": contract("secure-seat", "Secure Seat", "rider", { executor: "changeCanonicalRiderAttachment", legalMountStates: ["grounded-mounted", "airborne", "ascending", "descending", "perched"], attachmentRequirements: ["bareback", "loose", "failing"] }),
  "release-from-flying-mount": contract("release-from-flying-mount", "Release from Flying Mount", "rider", { executor: "executeCanonicalAerialSeparation", legalMountStates: ["grounded-mounted", "perched"], attachmentRequirements: ["secured", "saddled", "harnessed", "bareback", "loose", "failing"], turnEnding: true }),
  "emergency-aerial-separation": contract("emergency-aerial-separation", "Emergency Aerial Separation", "rider", { executor: "executeCanonicalAerialSeparation", legalMountStates: ["airborne", "ascending", "descending", "out-of-control", "linked-falling"], attachmentRequirements: ["secured", "saddled", "harnessed", "bareback", "loose", "failing"], turnEnding: true }),
  "mounted-aerial-rider-ranged-attack": contract("mounted-aerial-rider-ranged-attack", "Mounted Aerial Rider Ranged Attack", "rider", { executor: "executeCanonicalAerialRiderAttack", staminaOwner: "rider", legalMountStates: ["airborne", "ascending", "descending"], targetRequirements: "canonical-projectile-target" }),
  "mounted-aerial-rider-melee-attack": contract("mounted-aerial-rider-melee-attack", "Mounted Aerial Rider Melee Attack", "rider", { executor: "executeCanonicalAerialRiderAttack", staminaOwner: "rider", legalMountStates: ["airborne", "ascending", "descending"], targetRequirements: "canonical-melee-geometry" }),
  "flying-mount-natural-attack": contract("flying-mount-natural-attack", "Flying Mount Natural Attack", "mount", { executor: "executeCanonicalFlyingMountNaturalAttack", staminaOwner: "mount", legalMountStates: ["airborne", "ascending", "descending"], targetRequirements: "canonical-natural-attack-geometry" }),
  "command-intelligent-mount": contract("command-intelligent-mount", "Command Intelligent Mount", "rider", { executor: "resolveCanonicalIntelligentMountCommand", legalMountStates: ["grounded-mounted", "airborne", "ascending", "descending", "out-of-control", "perched"] }),
  "recover-mounted-flight-control": contract("recover-mounted-flight-control", "Recover Mounted Flight Control", "rider", { executor: "resolveCanonicalIntelligentMountCommand", staminaOwner: "rider", legalMountStates: ["out-of-control"] }),
});

export function createCanonicalMountedFlightRegistry({ carrierRegistry } = {}) {
  const mountedRegistry = createCanonicalMountedCombatRegistry({ carrierRegistry });
  return Object.assign(mountedRegistry, {
    flightRegistry: createFlightAuthorityRegistry(),
    linkedFallRegistry: createCanonicalFallRegistry(),
    linkedFalls: new Map(),
    completedLinkedFallIds: new Set(),
    completedTransitionKeys: new Set(),
    completedSeparationIds: new Set(),
    finalizedPairIds: new Set(),
  });
}

export function validateFlyingMountProfile({ mount, rider } = {}) {
  const profile = mount?.flyingMountProfile;
  if (profile?.mayServeAsFlyingMount !== true) return reject("flying-mount-profile-missing", { mountId: idOf(mount), riderId: idOf(rider) }, "flying-mount-profile-missing");
  const required = [
    "permittedRiderSizes", "maximumRiders", "riderAttachmentRequired",
    "allowedAttachmentTypes", "carryingCapacity", "equipmentCapacity",
    "controlProfile", "flightLoadProfile", "supportedMountedFlightActions",
    "supportedRiderActions", "supportedMountActions", "supportedCoordinatedActions",
    "takeoffProfile", "landingProfile", "linkedFallProfile",
  ];
  const missing = required.filter((key) => profile[key] == null);
  if (missing.length) return reject("flying-mount-profile-incomplete", { mountId: idOf(mount), riderId: idOf(rider) }, "flying-mount-profile-missing", { missing });
  if (!profile.permittedRiderSizes.includes(String(rider?.size || "").toLowerCase())) {
    return reject("rider-size-incompatible", { mountId: idOf(mount), riderId: idOf(rider) }, "invalid-flying-mounted-link");
  }
  if (finite(profile.maximumRiders) < 1) return reject("rider-capacity-incompatible", { mountId: idOf(mount), riderId: idOf(rider) }, "invalid-flying-mounted-link");
  return { accepted: true, profile };
}

export function resolveFlyingMountLoad({ mount, rider, riderEquipment, mountEquipment } = {}) {
  const profileValidation = validateFlyingMountProfile({ mount, rider });
  if (!profileValidation.accepted) return profileValidation;
  const profile = profileValidation.profile;
  const capacity = resolveCarrierCapacity({
    carrier: mount,
    passenger: rider,
    passengerEquipment: riderEquipment,
    carrierEquipment: mountEquipment,
    relationshipType: "flying-mounted",
    carrierProfile: {
      maximumLoad: finite(profile.carryingCapacity),
      allowedRelationshipTypes: ["flying-mounted"],
      authority: "flyingMountProfile",
    },
  });
  const maximumGroundLoad = Math.max(0, finite(profile.carryingCapacity));
  const maximumFlightLoad = Math.max(0, finite(profile.flightLoadProfile?.maximumFlightLoad ?? profile.carryingCapacity));
  const totalLoad = capacity.totalLoad;
  const loadRatio = maximumFlightLoad > 0 ? totalLoad / maximumFlightLoad : Infinity;
  let loadState = "impossible";
  if (loadRatio <= finite(profile.flightLoadProfile?.unloaded, 0.25)) loadState = "unloaded";
  else if (loadRatio <= finite(profile.flightLoadProfile?.normal, 0.7)) loadState = "normal";
  else if (loadRatio <= finite(profile.flightLoadProfile?.strained, 1)) loadState = "strained";
  else if (loadRatio <= finite(profile.flightLoadProfile?.overloaded, 1.25)) loadState = "overloaded";
  const equipmentCapacity = Math.max(0, finite(profile.equipmentCapacity));
  const equipmentAllowed = capacity.carrierEquipmentWeight <= equipmentCapacity;
  const allowed = capacity.allowed && equipmentAllowed && maximumFlightLoad > 0 && loadRatio <= 1 && !["overloaded", "impossible"].includes(loadState);
  return freeze({
    accepted: true,
    allowed,
    passengerWeight: capacity.passengerWeight,
    passengerEquipmentWeight: capacity.passengerEquipmentWeight,
    mountEquipmentWeight: capacity.carrierEquipmentWeight,
    totalLoad,
    maximumGroundLoad,
    maximumFlightLoad,
    equipmentCapacity,
    loadRatio,
    loadState,
    movementEffectSource: "classification-only-no-speed-scaling",
    reason: allowed
      ? ""
      : !equipmentAllowed
        ? "flying-mount-equipment-over-capacity"
        : loadState === "overloaded"
          ? "overloaded-flying-mount"
          : "impossible-flying-mount-load",
  });
}

export function establishCanonicalFlyingMountedLink({
  registry,
  mount,
  rider,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
  attachmentState = "saddled",
  harnessState = "secured",
  saddleState = "saddled",
  riderEquipment,
  mountEquipment,
} = {}) {
  const profile = validateFlyingMountProfile({ mount, rider });
  if (!profile.accepted) return profile;
  if (!RIDER_ATTACHMENT_STATES.includes(attachmentState) || attachmentState === "released") {
    return reject("invalid-rider-attachment", { mountId: idOf(mount), riderId: idOf(rider) }, "invalid-flying-mounted-link");
  }
  if (profile.profile.riderAttachmentRequired && !profile.profile.allowedAttachmentTypes.includes(attachmentState)) {
    return reject("rider-attachment-incompatible", { mountId: idOf(mount), riderId: idOf(rider) }, "invalid-flying-mounted-link");
  }
  const load = resolveFlyingMountLoad({ mount, rider, riderEquipment, mountEquipment });
  if (!load.allowed) return reject(load.reason, { mountId: idOf(mount), riderId: idOf(rider) }, load.reason, { load });
  const linked = establishCanonicalCarrierLink({
    registry: registry.carrierRegistry,
    carrier: mount,
    passenger: rider,
    relationshipType: "flying-mounted",
    controlType: profile.profile.controlProfile.defaultControlType,
    carrierProfile: {
      maximumLoad: load.maximumFlightLoad,
      allowedRelationshipTypes: ["flying-mounted"],
      authority: "flyingMountProfile",
    },
    riderEquipment,
    carrierEquipment: mountEquipment,
    generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn,
    actionOwnerId: idOf(rider),
    attachmentState,
    saddleState,
    harnessState,
  });
  if (!linked.accepted) return linked;
  const live = registry.carrierRegistry.links.get(linked.link.linkId);
  live.mountedFlightState = freeze({ ...live.mountedFlightState, loadState: load.loadState, attachmentState });
  return {
    ...linked,
    link: freeze({ ...live }),
    load,
    events: [
      ...linked.events,
      event("flying-mount-load-resolved", live.mountedFlightState, { load }),
      event("rider-attachment-state-changed", live.mountedFlightState, { previous: "released", attachmentState }),
    ],
  };
}

export function createCanonicalMountedFlightTurn(args = {}) {
  const created = createCanonicalMountedTurn(args);
  if (!created.accepted) return created;
  const link = args.registry.carrierRegistry.links.get(args.linkId);
  if (link?.relationshipType !== "flying-mounted") return reject("invalid-flying-mounted-link", created.mountedTurn, "invalid-flying-mounted-link");
  return {
    ...created,
    mountedFlightTurn: created.mountedTurn,
    events: [event("mounted-flight-turn-created", created.mountedTurn)],
  };
}

export function claimCanonicalMountedFlightAction(args = {}) {
  const actionContract = MOUNTED_FLIGHT_ACTION_CONTRACTS[args.actionKey];
  if (!actionContract) return reject("unknown-mounted-flight-action", args);
  const claimed = claimCanonicalMountedAction({ ...args, actionContract });
  if (!claimed.accepted) {
    return { ...claimed, events: (claimed.events || []).map((entry) => (
      entry.eventType === "stale-mounted-callback-rejected"
        ? { ...entry, eventType: "stale-mounted-flight-callback-rejected" }
        : entry
    )) };
  }
  const turn = args.registry.turns.get(args.mountedTurnId);
  const link = turn ? args.registry.carrierRegistry.links.get(turn.linkId) : null;
  if (link?.mountedFlightState) {
    link.mountedFlightState = freeze({
      ...link.mountedFlightState,
      currentActionOwner: claimed.claim.owner,
      coordinatedActionId: claimed.claim.owner === "coordinated" ? claimed.claim.actionToken : null,
    });
  }
  return {
    ...claimed,
    events: [event("mounted-flight-action-owner-claimed", claimed.claim, {
      owner: claimed.claim.owner,
      actionKey: claimed.claim.actionKey,
    })],
  };
}

export function completeCanonicalMountedFlightAction(args = {}) {
  const claim = args.registry?.actionClaims?.get(String(args.actionToken || ""));
  const completed = completeCanonicalMountedAction(args);
  if (!completed.accepted || !claim) return completed;
  const turnId = `${claim.generationId}:${claim.initiativeTurnId}:mounted-turn:${claim.pairId}`;
  const turn = args.registry.turns.get(turnId);
  const link = turn ? args.registry.carrierRegistry.links.get(turn.linkId) : null;
  if (link?.mountedFlightState) {
    link.mountedFlightState = freeze({
      ...link.mountedFlightState,
      currentActionOwner: null,
      coordinatedActionId: null,
    });
  }
  return completed;
}

const livePairForClaim = (registry, claim, rider, mount) => {
  const turn = registry?.turns?.get(`${claim?.generationId}:${claim?.initiativeTurnId}:mounted-turn:${claim?.pairId}`);
  return getCanonicalMountedPair({ registry, linkId: turn?.linkId, rider, mount });
};

const validateClaim = ({ registry, claim, rider, mount, allowedActionKeys, combatActive = true }) => {
  const live = registry?.actionClaims?.get(claim?.actionToken);
  if (!live || live.state !== "claimed" || live.executionKey !== claim?.executionKey || !allowedActionKeys.includes(live.actionKey) || combatActive === false) {
    return reject("stale-mounted-flight-callback", claim, "stale-mounted-flight-callback-rejected");
  }
  const pair = livePairForClaim(registry, live, rider, mount);
  if (!pair.accepted || pair.link.relationshipType !== "flying-mounted") return reject("invalid-flying-mounted-link", claim, "invalid-flying-mounted-link");
  if (pair.link.mountedFlightState?.state === "linked-falling" && !["emergency-aerial-separation"].includes(live.actionKey)) {
    return reject("action-after-linked-fall", claim, "action-after-linked-fall");
  }
  return { accepted: true, live, pair };
};

const transitionNameForAction = Object.freeze({
  "flying-mount-takeoff": "takeoff",
  "flying-mount-ascend": "ascend",
  "flying-mount-descend": "descend",
  "mounted-flight-move": "horizontal-flight",
  "flying-mount-land": "land",
});
const mountedStateForAction = Object.freeze({
  "flying-mount-takeoff": "airborne",
  "flying-mount-ascend": "ascending",
  "flying-mount-descend": "descending",
  "mounted-flight-move": "airborne",
  "flying-mount-land": "grounded-mounted",
});

export function executeCanonicalMountedFlightTransition({
  registry,
  claim,
  rider,
  mount,
  destination,
  movementRequired = 0,
  movementAvailable = Infinity,
  mountStaminaCost = 0,
  clearance = {},
  combatActive = true,
} = {}) {
  const validated = validateClaim({
    registry, claim, rider, mount, combatActive,
    allowedActionKeys: Object.keys(transitionNameForAction),
  });
  if (!validated.accepted) return validated;
  const { live, pair } = validated;
  const actionKey = live.actionKey;
  const profile = validateFlyingMountProfile({ mount, rider });
  if (!profile.accepted) return profile;
  if (!profile.profile.supportedMountedFlightActions.includes(actionKey)) return reject("unsupported-mounted-flight-action", live);
  const load = resolveFlyingMountLoad({ mount, rider });
  const requestEvents = [
    ...(actionKey === "flying-mount-takeoff" ? [event("flying-mount-takeoff-requested", live)] : []),
    ...(actionKey === "flying-mount-land" ? [event("flying-mount-landing-requested", live)] : []),
    event("flying-mount-load-resolved", live, { load }),
  ];
  if (!load.allowed) return {
    ...reject(load.reason, live, load.reason, { load }),
    events: [...requestEvents, event(load.reason, live, { load })],
  };
  if (actorTerminal(mount)) return { ...reject("flying-mount-incapacitated", live), events: requestEvents };
  if (mount.anatomyProfile?.wingsPresent !== true || mount.anatomyProfile?.wingsFunctional === false) {
    return { ...reject("flying-mount-flight-anatomy-impaired", live), events: requestEvents };
  }
  const attachmentState = pair.link.mountedFlightState?.attachmentState;
  if (!RIDER_ATTACHMENT_STATES.includes(attachmentState) || ["failing", "released"].includes(attachmentState)) {
    return { ...reject("rider-attachment-invalid", live), events: requestEvents };
  }
  if (actionKey === "flying-mount-takeoff" && getCanonicalAltitude(mount) > 0) return reject("duplicate-takeoff", live, "duplicate-takeoff");
  if (actionKey === "flying-mount-land" && getCanonicalAltitude(mount) <= 0) return reject("duplicate-landing", live, "duplicate-landing");
  const transition = resolveFlightTransition({
    actor: mount,
    currentFlightState: mount.flightState,
    requestedTransition: transitionNameForAction[actionKey],
    destination,
    actionToken: live.actionToken,
    initiativeTurnId: live.initiativeTurnId,
    generationId: live.generationId,
    movementSequence: live.actionSequence,
    authoritativeTurn: {
      generationId: live.generationId,
      initiativeTurnId: live.initiativeTurnId,
      actorId: idOf(mount),
      actionToken: live.actionToken,
    },
    registry: registry.flightRegistry,
    occupied: clearance.occupied === true,
    landingValid: clearance.landingValid !== false,
    takeoffBlocked: clearance.takeoffBlocked === true,
    ceilingHeightFeet: clearance.ceilingHeightFeet,
    obstacleHeightFeet: clearance.obstacleHeightFeet,
    movementRequired,
    movementAvailable,
    staminaCost: mountStaminaCost,
    staminaAvailable: mount.combatStamina?.current ?? mount.currentStamina ?? Infinity,
  });
  if (!transition.accepted) return { ...transition, events: [...requestEvents, ...(transition.events || [])] };
  const moved = commitCanonicalCarrierMovement({
    registry: registry.carrierRegistry,
    linkId: pair.link.linkId,
    carrier: transition.actor,
    passenger: rider,
    destination: transition.position,
    generationId: live.generationId,
    initiativeTurnId: live.initiativeTurnId,
    actionToken: live.actionToken,
    authoritativeTurn: {
      generationId: live.generationId,
      initiativeTurnId: live.initiativeTurnId,
      actorId: idOf(mount),
      actionToken: live.actionToken,
    },
  });
  if (!moved.accepted) return moved;
  const link = registry.carrierRegistry.links.get(pair.link.linkId);
  link.mountedFlightState = freeze({
    ...link.mountedFlightState,
    state: mountedStateForAction[actionKey],
    currentActionOwner: "mount",
    coordinatedActionId: live.actionToken,
    loadState: load.loadState,
  });
  const turn = registry.turns.get(`${live.generationId}:${live.initiativeTurnId}:mounted-turn:${live.pairId}`);
  turn.movementCommitted = true;
  turn.flightTransitionCommitted = true;
  registry.completedTransitionKeys.add(`${live.pairId}:${actionKey}:${live.actionToken}`);
  return {
    accepted: true,
    rider: moved.passenger,
    mount: moved.carrier,
    link: freeze({ ...link }),
    load,
    staminaSpent: transition.staminaSpent,
    events: [
      ...requestEvents,
      ...transition.events,
      ...moved.events,
      event("mounted-flight-position-committed", live, { position: positionOf(moved.carrier), state: link.mountedFlightState.state }),
      event("rider-altitude-derived", live, { altitudeFeet: positionOf(moved.passenger).altitudeFeet }),
      ...(actionKey === "flying-mount-takeoff" ? [event("flying-mount-takeoff-completed", live, { altitudeFeet: positionOf(moved.carrier).altitudeFeet })] : []),
      ...(actionKey === "flying-mount-land" ? [event("flying-mount-landing-completed", live)] : []),
    ],
  };
}

export function rejectCanonicalMountedRiderIndependentMovement({ registry, rider, requestedPosition } = {}) {
  const rejected = rejectIndependentPassengerMovement({ registry: registry.carrierRegistry, passenger: rider, requestedPosition });
  if (!rejected.accepted) rejected.events.push(event("rider-independent-movement", { riderId: idOf(rider) }, { requestedPosition }));
  return rejected;
}

export function changeCanonicalRiderAttachment({ registry, claim, rider, mount, attachmentState = "secured" } = {}) {
  const validated = validateClaim({ registry, claim, rider, mount, allowedActionKeys: ["secure-seat"] });
  if (!validated.accepted) return validated;
  if (!RIDER_ATTACHMENT_STATES.includes(attachmentState) || attachmentState === "released") return reject("invalid-rider-attachment", claim);
  const link = registry.carrierRegistry.links.get(validated.pair.link.linkId);
  const previous = link.mountedFlightState.attachmentState;
  link.mountedFlightState = freeze({ ...link.mountedFlightState, attachmentState, riderSeatState: "seated" });
  return { accepted: true, rider, mount, link: freeze({ ...link }), events: [event("rider-attachment-state-changed", claim, { previous, attachmentState })] };
}

export function resolveCanonicalAerialTargetGeometry({
  attacker,
  target,
  deliveryType,
  reachFeet,
  normalRangeFeet,
  longRangeFeet,
  horizontalDistanceFeet,
} = {}) {
  const horizontal = Math.max(0, finite(horizontalDistanceFeet, Math.hypot(positionOf(attacker).x - positionOf(target).x, positionOf(attacker).y - positionOf(target).y)));
  const vertical = Math.abs(positionOf(attacker).altitudeFeet - positionOf(target).altitudeFeet);
  const distance = Math.hypot(horizontal, vertical);
  const ranged = ["projectile", "ranged", "thrown"].includes(String(deliveryType || "").toLowerCase());
  const maximum = ranged ? Math.max(0, finite(longRangeFeet ?? normalRangeFeet)) : Math.max(0, finite(reachFeet, 5));
  const accepted = distance <= maximum;
  return {
    accepted,
    reason: accepted ? "" : "aerial-target-out-of-geometry",
    horizontalDistanceFeet: horizontal,
    verticalDistanceFeet: vertical,
    distanceFeet: distance,
    maximumDistanceFeet: maximum,
    rangeBand: ranged && distance > finite(normalRangeFeet, maximum) ? "long" : "normal",
    events: [event("aerial-target-geometry-resolved", { riderId: idOf(attacker) }, {
      targetId: idOf(target), accepted, horizontalDistanceFeet: horizontal,
      verticalDistanceFeet: vertical, distanceFeet: distance, maximumDistanceFeet: maximum,
    })],
  };
}

const ownsAttack = (actor, attack) => (actor?.weaponProfiles || actor?.attacks || []).some((candidate) => (
  candidate === attack
  || (candidate?.profileKey && candidate.profileKey === attack?.profileKey)
  || (candidate?.attackKey && candidate.attackKey === attack?.attackKey)
  || (candidate?.id && candidate.id === attack?.id)
));

export function executeCanonicalAerialRiderAttack({
  registry,
  claim,
  rider,
  mount,
  target,
  weapon,
  horizontalDistanceFeet,
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ attacker, target: currentTarget }) => ({ attacker, target: currentTarget, damage: 0 }),
  consumeAmmunition = ({ actor }) => ({ accepted: true, actor, spent: 0 }),
  combatActive = true,
} = {}) {
  const validated = validateClaim({
    registry, claim, rider, mount, combatActive,
    allowedActionKeys: ["mounted-aerial-rider-ranged-attack", "mounted-aerial-rider-melee-attack"],
  });
  if (!validated.accepted) return validated;
  if (actorTerminal(rider) || !ownsAttack(rider, weapon) || isCanonicalNaturalAttack(weapon)) return reject("aerial-rider-weapon-rejected", claim);
  const ranged = claim.actionKey === "mounted-aerial-rider-ranged-attack";
  if (!mount.flyingMountProfile?.supportedRiderActions?.includes(claim.actionKey)) return reject("unsupported-aerial-rider-action", claim);
  const geometry = resolveCanonicalAerialTargetGeometry({
    attacker: rider,
    target,
    deliveryType: ranged ? (weapon.deliveryType || "projectile") : (weapon.deliveryType || "melee"),
    reachFeet: weapon.reachFeet ?? weapon.reach,
    normalRangeFeet: weapon.normalRangeFeet ?? weapon.rangeProfile?.normal,
    longRangeFeet: weapon.longRangeFeet ?? weapon.rangeProfile?.long,
    horizontalDistanceFeet,
  });
  if (!geometry.accepted) return { ...geometry, events: [event("aerial-rider-attack-entered", claim, { targetId: idOf(target), attackId: weapon.profileKey || weapon.id }), ...geometry.events] };
  let ammunition = { accepted: true, actor: rider, spent: 0 };
  if (ranged) {
    ammunition = consumeAmmunition({ actor: rider, weapon, amount: 1, actionToken: claim.actionToken });
    if (ammunition?.accepted !== true) return reject(ammunition?.reason || "aerial-rider-ammunition-rejected", claim);
  }
  const authorization = authorizeImpact({
    attacker: ammunition.actor || rider,
    target,
    weapon,
    actionToken: claim.actionToken,
    executionKey: claim.executionKey,
    source: "mounted-aerial-rider-attack",
    geometry,
  });
  if (authorization?.accepted !== true) return reject(authorization?.reason || "aerial-rider-impact-rejected", claim);
  const impact = resolveImpact({ authorization, attacker: ammunition.actor || rider, target, weapon, actionToken: claim.actionToken, executionKey: claim.executionKey, source: "mounted-aerial-rider-attack" });
  return {
    accepted: true,
    rider: impact?.attacker || ammunition.actor || rider,
    mount,
    target: impact?.target || target,
    geometry,
    ammunition,
    impact,
    events: [event("aerial-rider-attack-entered", claim, { targetId: idOf(target), attackId: weapon.profileKey || weapon.id }), ...geometry.events],
  };
}

export function executeCanonicalFlyingMountNaturalAttack({
  registry,
  claim,
  rider,
  mount,
  target,
  attack,
  horizontalDistanceFeet,
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ attacker, target: currentTarget }) => ({ attacker, target: currentTarget, damage: 0 }),
  combatActive = true,
} = {}) {
  const validated = validateClaim({ registry, claim, rider, mount, combatActive, allowedActionKeys: ["flying-mount-natural-attack"] });
  if (!validated.accepted) return validated;
  if (!ownsAttack(mount, attack) || !isCanonicalNaturalAttack(attack)) return reject("flying-mount-natural-attack-rejected", claim);
  if (!mount.flyingMountProfile?.supportedMountActions?.includes(claim.actionKey)) return reject("unsupported-flying-mount-action", claim);
  const geometry = resolveCanonicalAerialTargetGeometry({
    attacker: mount, target, deliveryType: attack.deliveryType || "natural-melee",
    reachFeet: attack.reachFeet ?? attack.reach, horizontalDistanceFeet,
  });
  if (!geometry.accepted) return { ...geometry, events: [event("flying-mount-natural-attack-entered", claim, { targetId: idOf(target), attackId: attack.attackKey || attack.profileKey }), ...geometry.events] };
  const authorization = authorizeImpact({ attacker: mount, target, weapon: attack, actionToken: claim.actionToken, executionKey: claim.executionKey, source: "flying-mount-natural-attack", geometry });
  if (authorization?.accepted !== true) return reject(authorization?.reason || "flying-mount-impact-rejected", claim);
  const impact = resolveImpact({ authorization, attacker: mount, target, weapon: attack, actionToken: claim.actionToken, executionKey: claim.executionKey, source: "flying-mount-natural-attack" });
  return { accepted: true, rider, mount: impact?.attacker || mount, target: impact?.target || target, geometry, impact, events: [event("flying-mount-natural-attack-entered", claim, { targetId: idOf(target), attackId: attack.attackKey || attack.profileKey }), ...geometry.events] };
}

export function resolveCanonicalIntelligentMountCommand({
  registry,
  claim,
  rider,
  mount,
  command,
  commandLegal = true,
  survivalRisk = "routine",
  resolveExistingControl = () => ({ outcome: "accepted", rollMade: false }),
} = {}) {
  const validated = validateClaim({ registry, claim, rider, mount, allowedActionKeys: ["command-intelligent-mount", "recover-mounted-flight-control"] });
  if (!validated.accepted) return validated;
  if (actorTerminal(rider)) return reject("rider-cannot-command", claim);
  const profile = mount.flyingMountProfile?.controlProfile;
  if (!profile || validated.pair.link.controlType !== "independent-intelligent-mount") return reject("intelligent-mount-control-profile-required", claim);
  const requested = event("intelligent-mount-command-requested", claim, { command, commandLegal, survivalRisk });
  if (!commandLegal || survivalRisk === "suicidal") {
    return { accepted: true, outcome: "refused", rollMade: false, rider, mount, events: [requested, event("intelligent-mount-command-resolved", claim, { command, outcome: "refused", rollMade: false })] };
  }
  const routine = survivalRisk === "routine" && profile.mayRefuseCommands !== true;
  const resolution = routine ? { outcome: "accepted", rollMade: false } : resolveExistingControl({ rider, mount, command, survivalRisk });
  const outcome = resolution?.outcome || "refused";
  return { accepted: true, outcome, rollMade: resolution?.rollMade === true, rider, mount, events: [requested, event("intelligent-mount-command-resolved", claim, { command, outcome, rollMade: resolution?.rollMade === true })] };
}

export function executeCanonicalAerialSeparation({
  registry,
  claim,
  rider,
  mount,
  landingPosition,
  authorizeImpact,
  resolveImpact,
  combatActive = true,
} = {}) {
  const validated = validateClaim({
    registry, claim, rider, mount, combatActive,
    allowedActionKeys: ["release-from-flying-mount", "emergency-aerial-separation"],
  });
  if (!validated.accepted) return validated;
  const altitude = getCanonicalAltitude(mount);
  const emergency = claim.actionKey === "emergency-aerial-separation";
  if (!emergency && altitude > 0) return reject("unsafe-aerial-dismount", claim);
  const separationId = `${claim.actionToken}:aerial-separation`;
  if (registry.completedSeparationIds.has(separationId)) return reject("duplicate-aerial-separation", claim, "duplicate-aerial-separation");
  const release = releaseCanonicalCarrierLink({
    registry: registry.carrierRegistry,
    linkId: validated.pair.link.linkId,
    carrier: mount,
    passenger: rider,
    generationId: claim.generationId,
    initiativeTurnId: claim.initiativeTurnId,
    actionToken: claim.actionToken,
    cause: emergency ? "emergency-aerial-separation" : "flying-mount-release",
    landingPosition,
    emergency,
    authoritativeTurn: {
      generationId: claim.generationId,
      initiativeTurnId: claim.initiativeTurnId,
      actorId: idOf(rider),
      actionToken: claim.actionToken,
    },
    actionOwnerId: idOf(rider),
  });
  if (!release.accepted) return release;
  const fall = resolveReleasedPassengerFall({
    registry: registry.carrierRegistry,
    release,
    actor: release.passenger,
    generationId: claim.generationId,
    initiativeTurnId: claim.initiativeTurnId,
    actionToken: claim.actionToken,
    authorizeImpact,
    resolveImpact,
  });
  if (!fall.accepted) return fall;
  registry.completedSeparationIds.add(separationId);
  return {
    accepted: true,
    rider: fall.actor,
    mount: release.carrier,
    release,
    fall,
    events: [
      event("aerial-separation-requested", claim, { emergency }),
      ...release.events,
      ...fall.events,
      event("aerial-separation-completed", claim, { emergency }),
    ],
  };
}

export function resolveCanonicalLinkedMountedFall({
  registry,
  rider,
  mount,
  linkId,
  generationId,
  initiativeTurnId,
  actionToken,
  landingPosition,
  authorizeRiderImpact = () => ({ accepted: true }),
  authorizeMountImpact = () => ({ accepted: true }),
  resolveRiderImpact = ({ actor }) => ({ actor, damage: 0 }),
  resolveMountImpact = ({ actor }) => ({ actor, damage: 0 }),
  combatActive = true,
} = {}) {
  const pair = getCanonicalMountedPair({ registry, linkId, rider, mount });
  const linkedFallId = `${generationId}:${initiativeTurnId}:${actionToken}:linked-fall:${pair.pairId || linkId}`;
  if (registry.completedLinkedFallIds.has(linkedFallId) || registry.linkedFalls.has(linkedFallId)) return reject("duplicate-linked-fall", { ...pair, generationId, initiativeTurnId, actionToken }, "duplicate-linked-fall");
  if (
    !pair.accepted
    || pair.link.relationshipType !== "flying-mounted"
    || pair.link.generationId !== generationId
    || pair.link.initiativeTurnId !== initiativeTurnId
    || combatActive === false
  ) return reject("stale-linked-fall-callback", { ...pair, generationId, initiativeTurnId, actionToken }, "stale-linked-fall-callback-rejected");
  if (!actorTerminal(mount) || getCanonicalAltitude(mount) <= 0) return reject("linked-fall-not-required", { ...pair, generationId, initiativeTurnId, actionToken });
  const record = {
    linkedFallId, pairId: pair.pairId, riderId: idOf(rider), mountId: idOf(mount),
    generationId, initiativeTurnId, actionToken, attachmentState: pair.link.mountedFlightState?.attachmentState,
    state: "claimed", impactCount: 0,
  };
  registry.linkedFalls.set(linkedFallId, record);
  const link = registry.carrierRegistry.links.get(linkId);
  link.mountedFlightState = freeze({ ...link.mountedFlightState, state: "linked-falling", controlState: "out-of-control" });
  record.state = "started";
  const riderClaim = claimCanonicalFall({
    registry: registry.linkedFallRegistry, actor: rider, sourceActorId: idOf(mount),
    sourceRelationshipId: linkId, cause: "linked-mounted-flight-fall",
    startingPosition: positionOf(rider), landingPosition, generationId, initiativeTurnId,
    actionToken, fallId: `${linkedFallId}:rider`,
  });
  const mountClaim = claimCanonicalFall({
    registry: registry.linkedFallRegistry, actor: mount, sourceActorId: idOf(rider),
    sourceRelationshipId: linkId, cause: "linked-mounted-flight-fall",
    startingPosition: positionOf(mount), landingPosition, generationId, initiativeTurnId,
    actionToken, fallId: `${linkedFallId}:mount`,
  });
  if (!riderClaim.accepted || !mountClaim.accepted) return reject("linked-fall-claim-rejected", record);
  const riderFall = resolveCanonicalFall({
    registry: registry.linkedFallRegistry, fallId: riderClaim.fallId, actor: rider,
    generationId, initiativeTurnId, actionToken, authorizeImpact: authorizeRiderImpact,
    resolveImpact: resolveRiderImpact,
  });
  const mountFall = resolveCanonicalFall({
    registry: registry.linkedFallRegistry, fallId: mountClaim.fallId, actor: mount,
    generationId, initiativeTurnId, actionToken, authorizeImpact: authorizeMountImpact,
    resolveImpact: resolveMountImpact,
  });
  if (!riderFall.accepted || !mountFall.accepted) return reject("linked-fall-impact-rejected", record);
  record.state = "completed";
  record.impactCount = 2;
  registry.completedLinkedFallIds.add(linkedFallId);
  registry.carrierRegistry.activeByCarrier.delete(idOf(mount));
  registry.carrierRegistry.activeByPassenger.delete(idOf(rider));
  registry.carrierRegistry.releasedLinkIds.add(linkId);
  link.state = "released";
  link.mountedFlightState = freeze({ ...link.mountedFlightState, state: "released", attachmentState: "released" });
  const mountedTurnId = registry.activeTurnByPair.get(pair.pairId);
  const mountedTurn = registry.turns.get(mountedTurnId);
  if (mountedTurn && mountedTurn.state === "active") {
    mountedTurn.state = "completed-linked-fall";
    mountedTurn.currentActionOwner = null;
    mountedTurn.coordinatedActionToken = null;
    mountedTurn.completionCount += 1;
    mountedTurn.handoffCount += 1;
    registry.activeTurnByPair.delete(pair.pairId);
    registry.completedTurnIds.add(mountedTurn.mountedTurnId);
  }
  return {
    accepted: true,
    rider: riderFall.actor,
    mount: mountFall.actor,
    riderFall,
    mountFall,
    linkedFall: freeze(record),
    link: freeze({ ...link }),
    events: [
      event("linked-fall-requested", record),
      event("linked-fall-started", record),
      ...riderClaim.events, ...mountClaim.events,
      event("linked-fall-impact-authorized", record, { impactCount: 2 }),
      ...riderFall.events, ...mountFall.events,
      event("linked-fall-completed", record, { impactCount: 2 }),
    ],
  };
}

export function createCanonicalMountedFlightContinuation({ registry, mountedTurnId, actionToken, nextOwner, rider, mount, targetId, attackId } = {}) {
  const pair = livePairForClaim(registry, registry.actionClaims.get(actionToken), rider, mount);
  if (!pair.accepted) return pair;
  const created = createCanonicalMountedContinuation({
    registry, mountedTurnId, actionToken, nextOwner, targetId, attackId,
    position: positionOf(mount),
  });
  if (!created.accepted) return created;
  const receipt = freeze({
    ...created.receipt,
    executionKey: created.receipt.continuationId,
    altitudeFeet: getCanonicalAltitude(mount),
    flightState: pair.link.mountedFlightState?.state,
    attachmentState: pair.link.mountedFlightState?.attachmentState,
    loadState: pair.link.mountedFlightState?.loadState,
  });
  registry.continuations.set(receipt.continuationId, receipt);
  return { accepted: true, receipt, events: [event("mounted-flight-continuation-created", receipt)] };
}

export function consumeCanonicalMountedFlightContinuation(args = {}) {
  const consumed = consumeCanonicalMountedContinuation(args);
  if (!consumed.accepted) return { ...consumed, events: [event("mounted-flight-continuation-rejected", args.receipt, { reason: consumed.reason })] };
  return { ...consumed, events: [event("mounted-flight-continuation-consumed", consumed.receipt)] };
}

export function resolveMountedFlightOutcome({ rider, mount, pendingOwnership = false } = {}) {
  return {
    finalizationDeferred: pendingOwnership,
    rider: { actorId: idOf(rider), remainsInWorld: true, surrendered: rider?.surrenderState?.state === "accepted" || rider?.surrendered === true },
    mount: { actorId: idOf(mount), remainsInWorld: true, surrendered: false, humanoidSurrenderPanel: isHumanoidSurrenderAllowedForActor(mount) },
  };
}

export function finalizeCanonicalMountedFlightEncounter({
  registry,
  pairId,
  outcome,
  pendingOwnership = false,
} = {}) {
  if (pendingOwnership) {
    return {
      accepted: false,
      deferred: true,
      reason: "mounted-flight-survival-ownership-pending",
      events: [event("mounted-flight-finalization-deferred", { pairId }, { outcome })],
    };
  }
  if (!pairId || registry?.finalizedPairIds?.has(pairId)) {
    return reject("duplicate-finalizer", { pairId }, "duplicate-finalizer");
  }
  registry.finalizedPairIds.add(pairId);
  const mountedTurnId = registry.activeTurnByPair.get(pairId);
  const mountedTurn = registry.turns.get(mountedTurnId);
  if (mountedTurn) {
    mountedTurn.state = "completed-outcome";
    mountedTurn.currentActionOwner = null;
    mountedTurn.coordinatedActionToken = null;
    mountedTurn.completionCount += 1;
    registry.activeTurnByPair.delete(pairId);
    registry.completedTurnIds.add(mountedTurn.mountedTurnId);
  }
  return {
    accepted: true,
    outcome,
    events: [event("combat-over", { pairId }, { outcome })],
  };
}

export function filterCanonicalMountedFlightAIActions({
  actions = [],
  pair,
  rider,
  mount,
  target = null,
  combatActive = true,
} = {}) {
  if (!pair?.accepted || pair.link.relationshipType !== "flying-mounted" || combatActive === false || actorTerminal(mount)) return [];
  const state = pair.link.mountedFlightState?.state;
  const attachment = pair.link.mountedFlightState?.attachmentState;
  const load = resolveFlyingMountLoad({ mount, rider });
  return actions.filter((action) => {
    const key = action.key || action.id || action.type;
    const actionContract = MOUNTED_FLIGHT_ACTION_CONTRACTS[key];
    if (!actionContract?.aiAvailable || !actionContract.legalMountStates.includes(state)) return false;
    if (!load.allowed && !["flying-mount-descend", "flying-mount-land", "emergency-aerial-separation"].includes(key)) return false;
    if (actionContract.owner === "rider" && actorTerminal(rider)) return false;
    if (!actionContract.attachmentRequirements.includes(attachment) && key !== "secure-seat") return false;
    if (actionContract.targetRequirements && (!target || (action.targetId && String(action.targetId) !== String(idOf(target))))) return false;
    if (key.includes("rider-") && action.weapon && !ownsAttack(rider, action.weapon)) return false;
    if (key === "flying-mount-natural-attack" && (!action.attack || !ownsAttack(mount, action.attack))) return false;
    return true;
  });
}

export function getCanonicalMountedFlightPresentation({ pair, mountedTurn = null } = {}) {
  if (!pair?.accepted || pair.link.relationshipType !== "flying-mounted") return { visible: false, reason: "invalid-flying-mounted-link" };
  const altitudeFeet = getCanonicalAltitude(pair.mount);
  const flight = pair.link.mountedFlightState;
  return freeze({
    visible: true,
    relationshipGlyph: "R",
    altitudeIndicator: `${altitudeFeet} ft`,
    primaryTokenActorId: idOf(pair.mount),
    attachedMarkerActorId: idOf(pair.rider),
    riderTargetable: true,
    mountTargetable: true,
    position: positionOf(pair.mount),
    riderPosition: deriveCanonicalPassengerPosition({ link: pair.link, carrier: pair.mount }).position,
    tooltip: `${pair.rider.name} riding ${pair.mount.name}; altitude ${altitudeFeet} ft; attachment ${flight.attachmentState}; control ${flight.controlState}; rider HP ${finite(pair.rider.currentHP ?? pair.rider.hp)}, stamina ${finite(pair.rider.combatStamina?.current ?? pair.rider.currentStamina)}; mount HP ${finite(pair.mount.currentHP ?? pair.mount.hp)}, stamina ${finite(pair.mount.combatStamina?.current ?? pair.mount.currentStamina)}.`,
    ariaLabel: `${pair.rider.name}, rider, mounted on ${pair.mount.name}, flying mount, altitude ${altitudeFeet} feet, attachment ${flight.attachmentState}, control ${flight.controlState}, current action ${mountedTurn?.currentActionOwner || "none"}`,
  });
}

export function validateCanonicalMountedFlightState({ registry, actors = [], rendererWrite = false } = {}) {
  const diagnostics = [];
  const actorsById = new Map(actors.map((actor) => [idOf(actor), actor]));
  for (const link of registry?.carrierRegistry?.links?.values?.() || []) {
    if (link.relationshipType !== "flying-mounted" || ["released", "broken"].includes(link.state)) continue;
    const rider = actorsById.get(link.passengerId);
    const mount = actorsById.get(link.carrierId);
    const record = { ...link, pairId: link.mountedFlightState?.pairId, riderId: link.passengerId, mountId: link.carrierId };
    if (!rider || !mount) diagnostics.push(event("invalid-flying-mounted-link", record));
    if (mount?.flyingMountProfile?.mayServeAsFlyingMount !== true) diagnostics.push(event("flying-mount-profile-missing", record));
    if (rider?.hpState && rider.hpState === mount?.hpState) diagnostics.push(event("mount-rider-hp-merge", record));
    if (rider?.combatStamina && rider.combatStamina === mount?.combatStamina) diagnostics.push(event("mount-rider-stamina-merge", record));
    const derived = rider && mount ? deriveCanonicalPassengerPosition({ link, carrier: mount }) : null;
    if (derived?.accepted && positionOf(rider).altitudeFeet !== derived.position.altitudeFeet) diagnostics.push(event("rider-altitude-divergence", record));
    if (mount && getCanonicalAltitude(mount) > 0 && mount.flightState?.mode === "grounded") diagnostics.push(event("mount-grounded-with-positive-altitude", record));
    if (rendererWrite) diagnostics.push(event("renderer-writing-mounted-altitude", record));
    if (rider?.combinedBody?.mode === "MOUNTED" || mount?.combinedBody?.mode === "MOUNTED") diagnostics.push(event("mounted-actor-using-old-combinedBody-authority", record));
  }
  for (const receipt of registry?.continuations?.values?.() || []) {
    if (receipt.state === "fired") diagnostics.push(event("unresolved-mounted-flight-continuation", receipt));
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

export default {
  MOUNTED_FLIGHT_ACTION_CONTRACTS,
  MOUNTED_FLIGHT_STATES,
  RIDER_ATTACHMENT_STATES,
  changeCanonicalRiderAttachment,
  claimCanonicalMountedFlightAction,
  completeCanonicalMountedFlightAction,
  consumeCanonicalMountedFlightContinuation,
  createCanonicalMountedFlightContinuation,
  createCanonicalMountedFlightRegistry,
  createCanonicalMountedFlightTurn,
  establishCanonicalFlyingMountedLink,
  executeCanonicalAerialRiderAttack,
  executeCanonicalAerialSeparation,
  executeCanonicalFlyingMountNaturalAttack,
  executeCanonicalMountedFlightTransition,
  finalizeCanonicalMountedFlightEncounter,
  filterCanonicalMountedFlightAIActions,
  getCanonicalMountedFlightPresentation,
  rejectCanonicalMountedRiderIndependentMovement,
  resolveCanonicalAerialTargetGeometry,
  resolveCanonicalIntelligentMountCommand,
  resolveCanonicalLinkedMountedFall,
  resolveFlyingMountLoad,
  resolveMountedFlightOutcome,
  validateCanonicalMountedFlightState,
  validateFlyingMountProfile,
};
