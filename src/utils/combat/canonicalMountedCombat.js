import {
  commitCanonicalCarrierMovement,
  deriveCanonicalPassengerPosition,
  executeCanonicalDismountAction,
  rejectIndependentPassengerMovement,
  releaseCanonicalCarrierLink,
  resolveReleasedPassengerFall,
} from "./canonicalCarrierLink.js";
import {
  isCanonicalNaturalAttack,
  isHumanoidSurrenderAllowedForActor,
} from "./canonicalNaturalAttacks.js";

const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const point = (actor = {}) => Object.freeze({
  x: finite(actor?.position?.x ?? actor?.x, 0),
  y: finite(actor?.position?.y ?? actor?.y, 0),
  altitudeFeet: Math.max(0, finite(actor?.position?.altitudeFeet ?? actor?.altitudeFeet ?? actor?.altitude, 0)),
});
const terminal = (actor = {}) => Boolean(
  actor.dead
  || actor.isDead
  || actor.unconscious
  || actor.isUnconscious
  || actor.captured
  || actor.isCaptured
  || actor.immobilized
  || actor.canAct === false,
);
const freeze = (value) => Object.freeze({ ...value });
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
    actionToken: record.actionToken ?? record.coordinatedActionToken ?? null,
    ...data,
  },
});
const reject = (reason, record, eventType = "stale-mounted-callback-rejected", data = {}) => ({
  accepted: false,
  reason,
  events: [event(eventType, record, { reason, ...data })],
});

export const MOUNTED_ACTION_CONTRACTS = Object.freeze({
  mount: freeze({ key: "mount", label: "Mount", category: "Mounted", executor: "executeCanonicalMountAction", owner: "rider", actionCost: 1, staminaOwner: null, rollRequired: false, turnEnding: true, prerequisites: ["legal-ground-mount", "not-attached"], legalRiderStates: ["active"], legalMountStates: ["active"], playerVisible: true, aiAvailable: true }),
  dismount: freeze({ key: "dismount", label: "Dismount", category: "Mounted", executor: "executeCanonicalDismountAction", owner: "rider", actionCost: 1, staminaOwner: null, rollRequired: false, turnEnding: true, prerequisites: ["attached", "legal-landing-position"], legalRiderStates: ["mounted"], legalMountStates: ["active", "out-of-control"], playerVisible: true, aiAvailable: true }),
  "emergency-dismount": freeze({ key: "emergency-dismount", label: "Emergency Dismount", category: "Mounted", executor: "executeCanonicalDismountAction", owner: "rider", actionCost: 1, staminaOwner: "rider", rollRequired: false, turnEnding: true, prerequisites: ["attached", "legal-landing-position"], legalRiderStates: ["mounted", "losing-seat"], legalMountStates: ["active", "out-of-control", "incapacitated"], playerVisible: true, aiAvailable: false }),
  "control-mount": freeze({ key: "control-mount", label: "Control Mount", category: "Mounted Control", executor: "resolveCanonicalMountControl", owner: "rider", actionCost: 1, staminaOwner: "rider", rollRequired: "pressure-only", turnEnding: false, prerequisites: ["attached", "conscious-rider"], legalRiderStates: ["mounted"], legalMountStates: ["active", "out-of-control"], playerVisible: true, aiAvailable: true }),
  "mounted-walk": freeze({ key: "mounted-walk", label: "Mounted Walk", category: "Mounted Movement", executor: "executeCanonicalMountedMovement", owner: "mount", actionCost: 1, staminaOwner: "mount", rollRequired: false, turnEnding: false, prerequisites: ["attached", "controlled", "legal-path"], legalRiderStates: ["mounted"], legalMountStates: ["active"], playerVisible: true, aiAvailable: true }),
  "mounted-run": freeze({ key: "mounted-run", label: "Mounted Run", category: "Mounted Movement", executor: "executeCanonicalMountedMovement", owner: "mount", actionCost: 1, staminaOwner: "mount", rollRequired: false, turnEnding: false, prerequisites: ["attached", "controlled", "legal-path"], legalRiderStates: ["mounted"], legalMountStates: ["active"], playerVisible: true, aiAvailable: true }),
  "mounted-charge": freeze({ key: "mounted-charge", label: "Mounted Charge", category: "Mounted Attack", executor: "executeCanonicalMountedCharge", owner: "coordinated", actionCost: 1, riderActionCost: 1, mountActionCost: 1, staminaOwner: "rider-and-mount", rollRequired: true, turnEnding: true, prerequisites: ["attached", "controlled", "straight-path", "equipped-mounted-weapon", "legal-target"], legalRiderStates: ["mounted"], legalMountStates: ["active"], playerVisible: true, aiAvailable: true }),
  "mounted-rider-strike": freeze({ key: "mounted-rider-strike", label: "Mounted Rider Strike", category: "Mounted Attack", executor: "executeCanonicalMountedRiderAttack", owner: "rider", actionCost: 1, staminaOwner: "rider", rollRequired: true, turnEnding: false, prerequisites: ["attached", "equipped-melee-weapon", "legal-target-geometry"], legalRiderStates: ["mounted"], legalMountStates: ["active", "out-of-control"], playerVisible: true, aiAvailable: true }),
  "mounted-rider-ranged-attack": freeze({ key: "mounted-rider-ranged-attack", label: "Mounted Rider Ranged Attack", category: "Mounted Attack", executor: "executeCanonicalMountedRiderAttack", owner: "rider", actionCost: 1, staminaOwner: "rider", rollRequired: true, turnEnding: false, prerequisites: ["attached", "equipped-ranged-weapon", "legal-target-geometry"], legalRiderStates: ["mounted"], legalMountStates: ["active"], playerVisible: true, aiAvailable: true }),
  "mount-natural-attack": freeze({ key: "mount-natural-attack", label: "Mount Natural Attack", category: "Mounted Attack", executor: "executeCanonicalMountNaturalAttack", owner: "mount", actionCost: 1, staminaOwner: "mount", rollRequired: true, turnEnding: false, prerequisites: ["attached", "canonical-natural-attack", "legal-target-geometry"], legalRiderStates: ["mounted"], legalMountStates: ["active"], playerVisible: true, aiAvailable: true }),
  "brace-against-charge": freeze({ key: "brace-against-charge", label: "Brace Against Charge", category: "Defense", executor: "prepareCanonicalBraceAgainstCharge", owner: "rider", actionCost: 1, staminaOwner: "rider", rollRequired: false, turnEnding: true, prerequisites: ["grounded", "appropriate-equipped-weapon", "not-grappling"], legalRiderStates: ["dismounted"], legalMountStates: ["none"], playerVisible: true, aiAvailable: true }),
  "recover-mounted-control": freeze({ key: "recover-mounted-control", label: "Recover Mounted Control", category: "Mounted Control", executor: "resolveCanonicalMountControl", owner: "rider", actionCost: 1, staminaOwner: "rider", rollRequired: true, turnEnding: false, prerequisites: ["attached", "out-of-control", "conscious-rider"], legalRiderStates: ["mounted"], legalMountStates: ["out-of-control"], playerVisible: true, aiAvailable: true }),
});

export function createCanonicalMountedCombatRegistry({ carrierRegistry } = {}) {
  return {
    carrierRegistry,
    turns: new Map(),
    activeTurnByPair: new Map(),
    actionClaims: new Map(),
    completedActionTokens: new Set(),
    completedTurnIds: new Set(),
    continuations: new Map(),
    consumedContinuationIds: new Set(),
    canceledContinuationIds: new Set(),
    braces: new Map(),
    forcedDismounts: new Map(),
    completedForcedDismountIds: new Set(),
  };
}

export function getCanonicalMountedPair({ registry, linkId, rider, mount } = {}) {
  const link = registry?.carrierRegistry?.links?.get(String(linkId || ""));
  if (!link || link.relationshipType !== "mounted" || ["released", "broken"].includes(link.state)) {
    return reject("invalid-mounted-link", { riderId: idOf(rider), mountId: idOf(mount) }, "invalid-mounted-link");
  }
  if (
    link.passengerId !== idOf(rider)
    || link.carrierId !== idOf(mount)
    || registry.carrierRegistry.activeByPassenger.get(link.passengerId) !== link.linkId
    || registry.carrierRegistry.activeByCarrier.get(link.carrierId) !== link.linkId
  ) return reject("invalid-mounted-link", { ...link, riderId: idOf(rider), mountId: idOf(mount) }, "invalid-mounted-link");
  if (mount?.mountProfile?.mayServeAsMount !== true) return reject("mounted-link-without-mount-profile", link, "invalid-mounted-link");
  if (rider?.riderProfile?.mayRide !== true) return reject("mounted-link-without-rider-profile", link, "invalid-mounted-link");
  const pairId = link.mountedState?.pairId || link.linkId;
  return { accepted: true, pairId, link, rider, mount };
}

export function createCanonicalMountedTurn({
  registry,
  linkId,
  rider,
  mount,
  generationId,
  initiativeTurnId,
  authoritativeTurn = {},
} = {}) {
  const pair = getCanonicalMountedPair({ registry, linkId, rider, mount });
  if (!pair.accepted) return pair;
  if (
    !generationId
    || !initiativeTurnId
    || authoritativeTurn.generationId !== generationId
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || ![idOf(rider), idOf(mount)].includes(authoritativeTurn.actorId)
  ) return reject("stale-mounted-turn", { ...pair, generationId, initiativeTurnId }, "stale-mounted-callback-rejected");
  if (registry.activeTurnByPair.has(pair.pairId)) return reject("duplicate-mounted-turn", { ...pair, generationId, initiativeTurnId }, "duplicate-mounted-turn");
  const mountedTurnId = `${generationId}:${initiativeTurnId}:mounted-turn:${pair.pairId}`;
  if (registry.turns.has(mountedTurnId) || registry.completedTurnIds.has(mountedTurnId)) {
    return reject("duplicate-mounted-turn", { ...pair, generationId, initiativeTurnId }, "duplicate-mounted-turn");
  }
  const turn = {
    mountedTurnId,
    pairId: pair.pairId,
    linkId: pair.link.linkId,
    generationId,
    initiativeTurnId,
    riderId: idOf(rider),
    mountId: idOf(mount),
    riderActionsRemaining: Math.max(0, finite(rider.remainingActions ?? rider.actionsPerRound, 0)),
    mountActionsRemaining: Math.max(0, finite(mount.remainingActions ?? mount.actionsPerRound, 0)),
    currentActionOwner: null,
    movementCommitted: false,
    coordinatedActionToken: null,
    actionSequence: 0,
    completionCount: 0,
    handoffCount: 0,
    state: "active",
  };
  registry.turns.set(mountedTurnId, turn);
  registry.activeTurnByPair.set(pair.pairId, mountedTurnId);
  pair.link.mountedState = freeze({
    pairId: pair.pairId,
    riderId: turn.riderId,
    mountId: turn.mountId,
    initiativeTurnId,
    generationId,
    state: "mounted",
    controlState: pair.link.controlType === "rider-controlled" ? "controlled" : "independent",
    saddleState: pair.link.saddleState,
    reinsState: pair.link.reinsState || "none",
    riderSeatState: "seated",
    currentActionOwner: null,
    coordinatedActionId: null,
  });
  return {
    accepted: true,
    mountedTurn: freeze(turn),
    events: [event("mounted-turn-created", turn)],
  };
}

const liveTurn = (registry, mountedTurnId) => registry?.turns?.get(String(mountedTurnId || ""));

export function claimCanonicalMountedAction({
  registry,
  mountedTurnId,
  actionKey,
  owner,
  generationId,
  initiativeTurnId,
  targetId = null,
  attackId = null,
  combatActive = true,
} = {}) {
  const turn = liveTurn(registry, mountedTurnId);
  const contract = MOUNTED_ACTION_CONTRACTS[actionKey];
  if (!turn || !contract || turn.state !== "active" || combatActive === false) return reject("stale-mounted-callback", turn, "stale-mounted-callback-rejected");
  if (turn.generationId !== generationId || turn.initiativeTurnId !== initiativeTurnId) return reject("stale-mounted-callback", turn, "stale-mounted-callback-rejected");
  if (owner !== contract.owner || turn.currentActionOwner) return reject("mounted-action-owner-unavailable", turn, "mounted-action-owner-rejected");
  if (owner === "rider" && turn.riderActionsRemaining < contract.actionCost) return reject("rider-actions-exhausted", turn, "mounted-action-owner-rejected");
  if (owner === "mount" && turn.mountActionsRemaining < contract.actionCost) return reject("mount-actions-exhausted", turn, "mounted-action-owner-rejected");
  if (owner === "coordinated" && (
    turn.riderActionsRemaining < (contract.riderActionCost || contract.actionCost)
    || turn.mountActionsRemaining < (contract.mountActionCost || contract.actionCost)
  )) return reject("coordinated-actions-exhausted", turn, "mounted-action-owner-rejected");
  const actionSequence = turn.actionSequence + 1;
  const actionToken = `${turn.mountedTurnId}:action:${actionSequence}:${actionKey}`;
  if (registry.actionClaims.has(actionToken) || registry.completedActionTokens.has(actionToken)) return reject("duplicate-mounted-action", turn, "mounted-action-owner-rejected");
  const claim = {
    actionToken,
    executionKey: actionToken,
    actionKey,
    owner,
    actionSequence,
    pairId: turn.pairId,
    riderId: turn.riderId,
    mountId: turn.mountId,
    generationId,
    initiativeTurnId,
    targetId,
    attackId,
    state: "claimed",
    completionCount: 0,
  };
  turn.actionSequence = actionSequence;
  turn.currentActionOwner = owner;
  turn.coordinatedActionToken = owner === "coordinated" ? actionToken : null;
  registry.actionClaims.set(actionToken, claim);
  return { accepted: true, claim: freeze(claim), mountedTurn: freeze(turn), events: [event("mounted-action-owner-claimed", claim, { owner, actionKey })] };
}

export function completeCanonicalMountedAction({ registry, actionToken, status = "completed", combatActive = true } = {}) {
  const claim = registry?.actionClaims?.get(String(actionToken || ""));
  if (!claim || claim.state !== "claimed" || registry.completedActionTokens.has(String(actionToken || ""))) {
    return reject("duplicate-completion", claim, "duplicate-completion");
  }
  const turn = liveTurn(registry, `${claim.generationId}:${claim.initiativeTurnId}:mounted-turn:${claim.pairId}`);
  if (!turn || turn.currentActionOwner !== claim.owner) return reject("stale-mounted-callback", claim, "stale-mounted-callback-rejected");
  const contract = MOUNTED_ACTION_CONTRACTS[claim.actionKey];
  if (claim.owner === "rider") turn.riderActionsRemaining -= contract.actionCost;
  if (claim.owner === "mount") turn.mountActionsRemaining -= contract.actionCost;
  if (claim.owner === "coordinated") {
    turn.riderActionsRemaining -= contract.riderActionCost || contract.actionCost;
    turn.mountActionsRemaining -= contract.mountActionCost || contract.actionCost;
  }
  turn.riderActionsRemaining = Math.max(0, turn.riderActionsRemaining);
  turn.mountActionsRemaining = Math.max(0, turn.mountActionsRemaining);
  turn.currentActionOwner = null;
  turn.coordinatedActionToken = null;
  claim.state = status;
  claim.completionCount += 1;
  registry.completedActionTokens.add(claim.actionToken);
  const shouldHandoff = combatActive === false
    || contract.turnEnding
    || (turn.riderActionsRemaining <= 0 && turn.mountActionsRemaining <= 0);
  if (shouldHandoff && turn.state === "active") {
    turn.state = combatActive === false ? "canceled-outcome" : "completed";
    turn.completionCount += 1;
    turn.handoffCount += combatActive === false ? 0 : 1;
    registry.activeTurnByPair.delete(turn.pairId);
    registry.completedTurnIds.add(turn.mountedTurnId);
  }
  return {
    accepted: true,
    claim: freeze(claim),
    mountedTurn: freeze(turn),
    handoff: shouldHandoff && combatActive !== false,
    events: [event("mounted-action-owner-released", claim, { owner: claim.owner, status, handoff: shouldHandoff && combatActive !== false })],
  };
}

const terrainRejection = (terrain = {}) => {
  if (terrain.occupiedByHostile === true) return "occupied-mounted-destination";
  if (terrain.mountPassable === false) return "impossible-mounted-terrain";
  if (terrain.ladder === true || terrain.stairsTooNarrow === true || terrain.narrowPassage === true || terrain.doorwayTooNarrow === true) return "impossible-mounted-terrain";
  if (terrain.indoorClearance === false || terrain.bridgeSupportsLargeMount === false || terrain.steepSlopeImpassable === true) return "impossible-mounted-terrain";
  return "";
};

export function executeCanonicalMountedMovement({
  registry,
  claim,
  rider,
  mount,
  destination,
  terrain = {},
  movementMode = "walk",
  mountStaminaCost = 0,
  spendStamina = ({ actor }) => ({ accepted: true, actor }),
  combatActive = true,
} = {}) {
  const authoritativeClaim = registry?.actionClaims?.get(claim?.actionToken);
  const expectedKey = movementMode === "run" ? "mounted-run" : "mounted-walk";
  if (!authoritativeClaim || authoritativeClaim !== registry.actionClaims.get(claim.actionToken) || authoritativeClaim.actionKey !== expectedKey || authoritativeClaim.state !== "claimed" || combatActive === false) {
    return reject("stale-mounted-callback", claim, "stale-mounted-callback-rejected");
  }
  const pair = getCanonicalMountedPair({ registry, linkId: liveTurn(registry, `${claim.generationId}:${claim.initiativeTurnId}:mounted-turn:${claim.pairId}`)?.linkId, rider, mount });
  if (!pair.accepted) return pair;
  if (terminal(rider)) return reject("rider-cannot-command-movement", claim, "mounted-movement-rejected");
  const terrainReason = terrainRejection(terrain);
  if (terrainReason) return reject(terrainReason, claim, terrainReason === "occupied-mounted-destination" ? "mounted-movement-rejected" : "mounted-terrain-authority-unknown");
  const distance = Math.hypot(finite(destination?.x) - point(mount).x, finite(destination?.y) - point(mount).y);
  const maximum = movementMode === "run"
    ? finite(mount.movement?.runDistance ?? mount.movement?.burst, finite(mount.movement?.ground, 0))
    : finite(mount.movement?.ground ?? mount.derivedStats?.movement, 0);
  if (distance > maximum) return reject("mounted-movement-beyond-profile", claim, "mounted-movement-rejected");
  const stamina = spendStamina({ actor: mount, amount: mountStaminaCost, actorId: idOf(mount), pairId: claim.pairId, initiativeTurnId: claim.initiativeTurnId, coordinatedToken: claim.actionToken, reason: `mounted-${movementMode}` });
  if (stamina?.accepted !== true) return reject(stamina?.reason || "mount-stamina-rejected", claim, "mounted-movement-rejected");
  const moved = commitCanonicalCarrierMovement({
    registry: registry.carrierRegistry,
    linkId: pair.link.linkId,
    carrier: stamina.actor || mount,
    passenger: rider,
    destination,
    generationId: claim.generationId,
    initiativeTurnId: claim.initiativeTurnId,
    actionToken: claim.actionToken,
    authoritativeTurn: {
      generationId: claim.generationId,
      initiativeTurnId: claim.initiativeTurnId,
      actorId: idOf(mount),
      actionToken: claim.actionToken,
    },
  });
  if (!moved.accepted) return moved;
  const turn = liveTurn(registry, `${claim.generationId}:${claim.initiativeTurnId}:mounted-turn:${claim.pairId}`);
  turn.movementCommitted = true;
  pair.link.mountedState = freeze({ ...pair.link.mountedState, state: "moving", currentActionOwner: "mount", coordinatedActionId: claim.actionToken });
  return {
    accepted: true,
    rider: moved.passenger,
    mount: moved.carrier,
    link: moved.link,
    stamina,
    events: [
      event("mounted-movement-requested", claim, { movementMode, destination: point({ position: destination }) }),
      ...moved.events,
      event("rider-position-derived", claim, { position: point(moved.passenger) }),
      event("mounted-movement-committed", claim, { movementMode, position: point(moved.carrier) }),
    ],
  };
}

export function rejectMountedRiderIndependentMovement({ registry, rider, requestedPosition } = {}) {
  const result = rejectIndependentPassengerMovement({ registry: registry?.carrierRegistry, passenger: rider, requestedPosition });
  return result.accepted ? result : {
    ...result,
    reason: "rider-independent-movement",
    events: [...(result.events || []), event("rider-independent-movement", { riderId: idOf(rider) }, { requestedPosition })],
  };
}

export function resolveCanonicalMountedTarget({
  pair,
  attacker,
  target,
  targetKind = "actor",
  deliveryType = "melee",
  reachFeet = 5,
} = {}) {
  const targetId = idOf(target);
  if (!pair?.accepted || !targetId) return reject("target-identity-ambiguous", pair, "mounted-target-rejected");
  const isRider = targetId === idOf(pair.rider);
  const isMount = targetId === idOf(pair.mount);
  if (targetKind === "pair") return { accepted: true, targetKind: "pair", targetIds: [idOf(pair.rider), idOf(pair.mount)], events: [event("mounted-target-resolved", { ...pair, riderId: idOf(pair.rider), mountId: idOf(pair.mount) }, { targetId, targetKind: "pair" })] };
  if (!isRider && !isMount) return { accepted: true, targetKind: "actor", target, events: [event("mounted-target-resolved", { ...pair, riderId: idOf(pair.rider), mountId: idOf(pair.mount) }, { targetId, targetKind: "actor" })] };
  const distance = Math.hypot(point(attacker).x - point(target).x, point(attacker).y - point(target).y);
  const projectile = ["projectile", "ranged", "thrown"].includes(String(deliveryType));
  if (!projectile && isRider && distance > finite(reachFeet, 5)) return reject("impossible-rider-geometry", { ...pair, riderId: idOf(pair.rider), mountId: idOf(pair.mount) }, "mounted-target-rejected", { targetId });
  return {
    accepted: true,
    targetKind: isRider ? "rider" : "mount",
    target,
    armorAuthority: isRider ? "rider" : "mount",
    events: [event("mounted-target-resolved", { ...pair, riderId: idOf(pair.rider), mountId: idOf(pair.mount) }, { targetId, targetKind: isRider ? "rider" : "mount" })],
  };
}

const ownsProfile = (actor, profile) => {
  const profileId = profile?.profileKey || profile?.weaponId || profile?.attackKey || profile?.id;
  return [...(actor?.weaponProfiles || []), ...(actor?.naturalAttackProfiles || []), ...(actor?.attacks || [])]
    .some((candidate) => (candidate?.profileKey || candidate?.weaponId || candidate?.attackKey || candidate?.id) === profileId);
};

export function executeCanonicalMountedRiderAttack({
  registry,
  claim,
  rider,
  mount,
  target,
  weapon,
  pair,
  riderStaminaCost = 0,
  spendStamina = ({ actor }) => ({ accepted: true, actor }),
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ attacker, target: currentTarget }) => ({ attacker, target: currentTarget, damage: 0 }),
  combatActive = true,
} = {}) {
  const liveClaim = registry?.actionClaims?.get(claim?.actionToken);
  if (!liveClaim || liveClaim.state !== "claimed" || liveClaim.owner !== "rider" || combatActive === false) return reject("stale-mounted-callback", claim);
  if (idOf(rider) !== claim.riderId || idOf(mount) !== claim.mountId || !ownsProfile(rider, weapon) || isCanonicalNaturalAttack(weapon)) return reject("rider-weapon-identity-rejected", claim, "mounted-rider-attack-rejected");
  const targetResolution = resolveCanonicalMountedTarget({ pair, attacker: rider, target, deliveryType: weapon.deliveryType || weapon.kind, reachFeet: weapon.reachFeet || weapon.reach });
  if (!targetResolution.accepted) return targetResolution;
  const stamina = spendStamina({ actor: rider, amount: riderStaminaCost, actorId: idOf(rider), pairId: claim.pairId, initiativeTurnId: claim.initiativeTurnId, coordinatedToken: claim.actionToken, reason: "mounted-rider-attack" });
  if (stamina?.accepted !== true) return reject(stamina?.reason || "rider-stamina-rejected", claim, "mounted-rider-attack-rejected");
  const authorization = authorizeImpact({ actionToken: claim.actionToken, executionKey: claim.executionKey, attacker: stamina.actor || rider, target, weapon, source: "mounted-rider-attack" });
  if (authorization?.accepted !== true) return reject(authorization?.reason || "mounted-impact-rejected", claim, "mounted-rider-attack-rejected");
  const impact = resolveImpact({ authorization, attacker: stamina.actor || rider, target, weapon, actionToken: claim.actionToken, executionKey: claim.executionKey, source: "mounted-rider-attack" });
  return { accepted: true, rider: impact?.attacker || stamina.actor || rider, mount, target: impact?.target || target, weapon, impact, stamina, events: [event("mounted-rider-attack-entered", claim, { targetId: idOf(target), attackId: weapon.profileKey || weapon.id }), ...(targetResolution.events || [])] };
}

export function executeCanonicalMountNaturalAttack({
  registry,
  claim,
  rider,
  mount,
  target,
  naturalAttack,
  pair,
  mountStaminaCost = 0,
  spendStamina = ({ actor }) => ({ accepted: true, actor }),
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ attacker, target: currentTarget }) => ({ attacker, target: currentTarget, damage: 0 }),
  combatActive = true,
} = {}) {
  const liveClaim = registry?.actionClaims?.get(claim?.actionToken);
  if (!liveClaim || liveClaim.state !== "claimed" || liveClaim.owner !== "mount" || combatActive === false) return reject("stale-mounted-callback", claim);
  if (idOf(mount) !== claim.mountId || !ownsProfile(mount, naturalAttack) || !isCanonicalNaturalAttack(naturalAttack)) return reject("mount-natural-attack-identity-rejected", claim, "mount-natural-attack-rejected");
  const targetResolution = resolveCanonicalMountedTarget({ pair, attacker: mount, target, deliveryType: naturalAttack.deliveryType || "natural", reachFeet: naturalAttack.reachFeet || naturalAttack.reach });
  if (!targetResolution.accepted) return targetResolution;
  const stamina = spendStamina({ actor: mount, amount: mountStaminaCost, actorId: idOf(mount), pairId: claim.pairId, initiativeTurnId: claim.initiativeTurnId, coordinatedToken: claim.actionToken, reason: "mount-natural-attack" });
  if (stamina?.accepted !== true) return reject(stamina?.reason || "mount-stamina-rejected", claim, "mount-natural-attack-rejected");
  const authorization = authorizeImpact({ actionToken: claim.actionToken, executionKey: claim.executionKey, attacker: stamina.actor || mount, target, weapon: naturalAttack, source: "mount-natural-attack" });
  if (authorization?.accepted !== true) return reject(authorization?.reason || "mount-impact-rejected", claim, "mount-natural-attack-rejected");
  const impact = resolveImpact({ authorization, attacker: stamina.actor || mount, target, weapon: naturalAttack, actionToken: claim.actionToken, executionKey: claim.executionKey, source: "mount-natural-attack" });
  return { accepted: true, rider, mount: impact?.attacker || stamina.actor || mount, target: impact?.target || target, naturalAttack, impact, stamina, events: [event("mount-natural-attack-entered", claim, { targetId: idOf(target), attackId: naturalAttack.profileKey || naturalAttack.attackKey }), ...(targetResolution.events || [])] };
}

export function prepareCanonicalBraceAgainstCharge({ registry, defender, actionToken, generationId, initiativeTurnId, weapon, grounded = true, grappling = false } = {}) {
  const defenderId = idOf(defender);
  const weaponName = String(weapon?.name || "").toLowerCase();
  const appropriate = /spear|pike|polearm|halberd/.test(weaponName);
  if (!defenderId || !actionToken || !generationId || !initiativeTurnId || !grounded || grappling || !appropriate || !ownsProfile(defender, weapon)) {
    return reject("brace-prerequisite-rejected", { riderId: defenderId, generationId, initiativeTurnId, actionToken }, "brace-preparation-rejected");
  }
  const braceId = `${generationId}:${initiativeTurnId}:${actionToken}:brace:${defenderId}`;
  const record = freeze({ braceId, defenderId, generationId, initiativeTurnId, actionToken, weaponId: weapon.profileKey || weapon.id, state: "prepared" });
  registry.braces.set(defenderId, record);
  return { accepted: true, brace: record, events: [event("brace-against-charge-prepared", { riderId: defenderId, generationId, initiativeTurnId, actionToken }, { braceId, weaponId: record.weaponId })] };
}

export function executeCanonicalMountedCharge({
  registry,
  claim,
  rider,
  mount,
  target,
  weapon,
  pair,
  destination,
  path = {},
  terrain = {},
  mountStaminaCost = 0,
  riderStaminaCost = 0,
  spendStamina = ({ actor }) => ({ accepted: true, actor }),
  resolveBrace = () => ({ accepted: true, interrupted: false }),
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ attacker, target: currentTarget }) => ({ attacker, target: currentTarget, damage: 0 }),
  combatActive = true,
} = {}) {
  const liveClaim = registry?.actionClaims?.get(claim?.actionToken);
  if (!liveClaim || liveClaim.state !== "claimed" || liveClaim.actionKey !== "mounted-charge" || liveClaim.owner !== "coordinated" || combatActive === false) return reject("stale-mounted-callback", claim);
  if (path.straightLine !== true || path.obstructed === true || terrainRejection(terrain)) return reject("invalid-mounted-charge", claim, "mounted-charge-rejected");
  if (!ownsProfile(rider, weapon) || isCanonicalNaturalAttack(weapon)) return reject("mounted-charge-weapon-rejected", claim, "mounted-charge-rejected");
  const mountSpend = spendStamina({ actor: mount, amount: mountStaminaCost, actorId: idOf(mount), pairId: claim.pairId, initiativeTurnId: claim.initiativeTurnId, coordinatedToken: claim.actionToken, reason: "mounted-charge-movement" });
  if (mountSpend?.accepted !== true) return reject(mountSpend?.reason || "mount-stamina-rejected", claim, "mounted-charge-rejected");
  const moved = commitCanonicalCarrierMovement({
    registry: registry.carrierRegistry,
    linkId: pair.link.linkId,
    carrier: mountSpend.actor || mount,
    passenger: rider,
    destination,
    generationId: claim.generationId,
    initiativeTurnId: claim.initiativeTurnId,
    actionToken: claim.actionToken,
    authoritativeTurn: { generationId: claim.generationId, initiativeTurnId: claim.initiativeTurnId, actorId: idOf(mount), actionToken: claim.actionToken },
  });
  if (!moved.accepted) return moved;
  const riderSpend = spendStamina({ actor: moved.passenger, amount: riderStaminaCost, actorId: idOf(rider), pairId: claim.pairId, initiativeTurnId: claim.initiativeTurnId, coordinatedToken: claim.actionToken, reason: "mounted-charge-rider-attack" });
  if (riderSpend?.accepted !== true) return reject(riderSpend?.reason || "rider-stamina-rejected", claim, "mounted-charge-rejected");
  const brace = resolveBrace({ defender: target, attacker: riderSpend.actor || moved.passenger, mount: moved.carrier, weapon, path, actionToken: claim.actionToken, preparedBrace: registry.braces.get(idOf(target)) || null });
  if (brace?.accepted !== true || brace?.interrupted === true) {
    return { accepted: brace?.accepted === true, interrupted: true, rider: riderSpend.actor || moved.passenger, mount: moved.carrier, target, brace, events: [event("mounted-charge-requested", claim, { targetId: idOf(target) }), event("mounted-charge-path-validated", claim, { targetId: idOf(target) }), ...(brace?.events || [])] };
  }
  const authorization = authorizeImpact({ actionToken: claim.actionToken, executionKey: claim.executionKey, attacker: riderSpend.actor || moved.passenger, target, weapon, mount: moved.carrier, movement: path, source: "mounted-charge" });
  if (authorization?.accepted !== true) return reject(authorization?.reason || "mounted-impact-rejected", claim, "mounted-charge-rejected");
  const impact = resolveImpact({ authorization, attacker: riderSpend.actor || moved.passenger, target, weapon, mount: moved.carrier, movement: path, actionToken: claim.actionToken, executionKey: claim.executionKey, source: "mounted-charge" });
  const turn = liveTurn(registry, `${claim.generationId}:${claim.initiativeTurnId}:mounted-turn:${claim.pairId}`);
  turn.movementCommitted = true;
  pair.link.mountedState = freeze({ ...pair.link.mountedState, state: "charging", currentActionOwner: "coordinated", coordinatedActionId: claim.actionToken });
  return {
    accepted: true,
    rider: impact?.attacker || riderSpend.actor || moved.passenger,
    mount: moved.carrier,
    target: impact?.target || target,
    impact,
    brace,
    events: [
      event("mounted-charge-requested", claim, { targetId: idOf(target) }),
      event("mounted-charge-path-validated", claim, { targetId: idOf(target) }),
      event("mounted-movement-requested", claim, { movementMode: "charge", destination: point({ position: destination }) }),
      ...moved.events,
      event("rider-position-derived", claim, { position: point(moved.passenger) }),
      event("mounted-movement-committed", claim, { movementMode: "charge", position: point(moved.carrier) }),
      ...(brace?.events || []),
      event("mounted-rider-attack-entered", claim, { targetId: idOf(target), attackId: weapon.profileKey || weapon.id }),
      event("mounted-charge-committed", claim, { targetId: idOf(target) }),
    ],
  };
}

export function resolveCanonicalMountControl({
  registry,
  claim,
  rider,
  mount,
  pressure = false,
  command = "hold",
  resolveExistingMorale = () => ({ outcome: "obey" }),
} = {}) {
  const liveClaim = registry?.actionClaims?.get(claim?.actionToken);
  if (!liveClaim || liveClaim.state !== "claimed" || liveClaim.owner !== "rider") return reject("stale-mounted-callback", claim);
  if (terminal(rider)) return reject("rider-cannot-control-mount", claim, "mount-control-rejected");
  const requestEvent = event("mount-control-check-requested", claim, { pressure, command, rollRequired: pressure });
  const resolution = pressure
    ? resolveExistingMorale({ actor: mount, rider, command, horsemanship: rider.riderProfile?.horsemanshipProfile, source: "mounted-control-pressure" })
    : { outcome: "obey", rollMade: false };
  const outcome = resolution?.outcome || "hesitate";
  const lost = ["hesitate", "refuse", "rear", "bolt", "flee", "defend-itself"].includes(outcome);
  const pair = getCanonicalMountedPair({ registry, linkId: liveTurn(registry, `${claim.generationId}:${claim.initiativeTurnId}:mounted-turn:${claim.pairId}`)?.linkId, rider, mount });
  if (pair.accepted) pair.link.mountedState = freeze({ ...pair.link.mountedState, controlState: lost ? "out-of-control" : "controlled", state: lost ? "out-of-control" : "mounted" });
  return { accepted: true, outcome, rollMade: resolution?.rollMade === true, rider, mount, events: [requestEvent, event("mount-control-resolved", claim, { pressure, command, outcome }), ...(lost ? [event("mounted-link-control-lost", claim, { outcome })] : [])] };
}

export function executeCanonicalForcedDismount({
  registry,
  linkId,
  rider,
  mount,
  generationId,
  initiativeTurnId,
  actionToken,
  cause,
  landingPosition,
  occupied = false,
  authorizeImpact,
  resolveImpact,
} = {}) {
  const historicalLink = registry?.carrierRegistry?.links?.get(String(linkId || ""));
  const historicalPairId = historicalLink?.mountedState?.pairId || historicalLink?.linkId || linkId;
  const forcedDismountId = `${generationId}:${initiativeTurnId}:${actionToken}:forced-dismount:${historicalPairId}`;
  if (registry?.forcedDismounts?.has(forcedDismountId) || registry?.completedForcedDismountIds?.has(forcedDismountId)) {
    return reject("duplicate-forced-dismount", {
      pairId: historicalPairId,
      riderId: idOf(rider),
      mountId: idOf(mount),
      generationId,
      initiativeTurnId,
      actionToken,
    }, "duplicate-forced-dismount");
  }
  const pair = getCanonicalMountedPair({ registry, linkId, rider, mount });
  if (!pair.accepted) return pair;
  if (!landingPosition || occupied) return reject(occupied ? "occupied-dismount-destination" : "forced-dismount-landing-required", { ...pair, generationId, initiativeTurnId, actionToken }, "forced-dismount-rejected");
  const record = { forcedDismountId, pairId: pair.pairId, riderId: idOf(rider), mountId: idOf(mount), generationId, initiativeTurnId, actionToken, cause, state: "claimed" };
  registry.forcedDismounts.set(forcedDismountId, record);
  const turnId = registry.activeTurnByPair.get(pair.pairId);
  const turn = liveTurn(registry, turnId);
  if (turn) turn.state = "forced-dismount";
  const release = releaseCanonicalCarrierLink({
    registry: registry.carrierRegistry,
    linkId,
    carrier: mount,
    passenger: rider,
    generationId,
    initiativeTurnId,
    actionToken,
    cause,
    landingPosition,
    occupied: false,
    emergency: true,
    authoritativeTurn: { generationId, initiativeTurnId, actorId: idOf(mount), actionToken },
    actionOwnerId: idOf(mount),
  });
  if (!release.accepted) {
    record.state = "rejected";
    return { ...release, events: [event("forced-dismount-requested", record), ...release.events] };
  }
  const fall = resolveReleasedPassengerFall({ registry: registry.carrierRegistry, release, actor: release.passenger, generationId, initiativeTurnId, actionToken, authorizeImpact, resolveImpact });
  if (!fall.accepted) return fall;
  record.state = "completed";
  registry.completedForcedDismountIds.add(forcedDismountId);
  if (turn) {
    turn.state = "completed-forced-dismount";
    turn.currentActionOwner = null;
    turn.coordinatedActionToken = null;
    turn.completionCount += 1;
    turn.handoffCount += 1;
    registry.activeTurnByPair.delete(pair.pairId);
    registry.completedTurnIds.add(turn.mountedTurnId);
  }
  return {
    accepted: true,
    rider: { ...fall.actor, prone: true, positionState: "ground" },
    mount: release.carrier,
    release,
    fall,
    forcedDismount: freeze(record),
    events: [event("forced-dismount-requested", record), event("forced-dismount-started", record), ...release.events, ...fall.events, event("forced-dismount-completed", record)],
  };
}

export function resolveMountedIncapacitation({
  registry,
  linkId,
  rider,
  mount,
  generationId,
  initiativeTurnId,
  actionToken,
  landingPosition,
  authorizeImpact,
  resolveImpact,
} = {}) {
  if (terminal(mount)) return executeCanonicalForcedDismount({ registry, linkId, rider, mount, generationId, initiativeTurnId, actionToken, cause: "mount-incapacitated", landingPosition, authorizeImpact, resolveImpact });
  if (terminal(rider)) {
    const pair = getCanonicalMountedPair({ registry, linkId, rider, mount });
    if (!pair.accepted) return pair;
    pair.link.mountedState = freeze({ ...pair.link.mountedState, state: "out-of-control", controlState: "out-of-control", riderSeatState: "incapacitated" });
    return { accepted: true, rider, mount, requiresForcedDismountDecision: true, events: [event("mounted-link-control-lost", { ...pair, riderId: idOf(rider), mountId: idOf(mount), generationId, initiativeTurnId, actionToken }, { reason: "rider-incapacitated" })] };
  }
  return { accepted: true, rider, mount, events: [] };
}

export function createCanonicalMountedContinuation({
  registry,
  mountedTurnId,
  actionToken,
  nextOwner,
  targetId = null,
  attackId = null,
  position,
} = {}) {
  const turn = liveTurn(registry, mountedTurnId);
  const claim = registry?.actionClaims?.get(actionToken);
  if (!turn || !claim || claim.state !== "completed" || turn.state !== "active" || turn.currentActionOwner) return reject("mounted-continuation-rejected", turn || claim, "mounted-continuation-rejected");
  const continuationId = `${claim.actionToken}:continuation:${claim.actionSequence + 1}:${nextOwner}`;
  const receipt = freeze({
    continuationId,
    executionKey: continuationId,
    pairId: turn.pairId,
    riderId: turn.riderId,
    mountId: turn.mountId,
    generationId: turn.generationId,
    initiativeTurnId: turn.initiativeTurnId,
    riderActionsRemaining: turn.riderActionsRemaining,
    mountActionsRemaining: turn.mountActionsRemaining,
    currentActionOwner: nextOwner,
    targetId,
    attackId,
    mountedState: "mounted",
    position: point({ position }),
    actionSequence: claim.actionSequence + 1,
    state: "fired",
  });
  registry.continuations.set(continuationId, receipt);
  return { accepted: true, receipt, events: [event("mounted-continuation-created", receipt)] };
}

export function consumeCanonicalMountedContinuation({
  registry,
  receipt,
  mountedTurnId,
  generationId,
  initiativeTurnId,
} = {}) {
  const authoritative = registry?.continuations?.get(receipt?.continuationId);
  const turn = liveTurn(registry, mountedTurnId);
  if (
    !authoritative
    || authoritative !== receipt
    || authoritative.state !== "fired"
    || registry.consumedContinuationIds.has(receipt?.continuationId)
    || !turn
    || turn.pairId !== receipt.pairId
    || turn.riderId !== receipt.riderId
    || turn.mountId !== receipt.mountId
    || turn.generationId !== generationId
    || turn.initiativeTurnId !== initiativeTurnId
    || turn.riderActionsRemaining !== receipt.riderActionsRemaining
    || turn.mountActionsRemaining !== receipt.mountActionsRemaining
  ) return reject("mounted-continuation-rejected", receipt, "mounted-continuation-rejected");
  const consumed = freeze({ ...receipt, state: "consumed" });
  registry.continuations.set(receipt.continuationId, consumed);
  registry.consumedContinuationIds.add(receipt.continuationId);
  return { accepted: true, receipt: consumed, events: [event("mounted-continuation-consumed", consumed)] };
}

export function cancelCanonicalMountedContinuations({ registry, pairId, reason = "relationship-released" } = {}) {
  const canceled = [];
  for (const [continuationId, receipt] of registry?.continuations || []) {
    if (receipt.pairId !== pairId || receipt.state !== "fired") continue;
    const next = freeze({ ...receipt, state: "canceled", cancellationReason: reason });
    registry.continuations.set(continuationId, next);
    registry.canceledContinuationIds.add(continuationId);
    canceled.push(next);
  }
  return canceled;
}

export function filterCanonicalMountedAIActions({ actions = [], rider, mount, pair, target, terrain = {}, combatActive = true } = {}) {
  if (!pair?.accepted || combatActive === false || terminal(mount)) return [];
  return actions.filter((action) => {
    const contract = MOUNTED_ACTION_CONTRACTS[action.key || action.id || action.type];
    if (!contract?.aiAvailable) return false;
    if (contract.owner === "rider" && terminal(rider)) return false;
    if (["mounted-walk", "mounted-run", "mounted-charge"].includes(contract.key) && terrainRejection(terrain)) return false;
    if (contract.key === "mounted-charge" && (!action.path?.straightLine || !action.weapon || !ownsProfile(rider, action.weapon))) return false;
    if (contract.key === "mount-natural-attack" && (!action.naturalAttack || !ownsProfile(mount, action.naturalAttack))) return false;
    if (contract.key.startsWith("mounted-rider-") && (!action.weapon || !ownsProfile(rider, action.weapon))) return false;
    return !target || action.targetId == null || String(action.targetId) === String(idOf(target));
  });
}

export function resolveMountedGrappleTarget({ pair, target, requestedInteraction = "grapple" } = {}) {
  if (!pair?.accepted || !idOf(target)) return reject("mounted-grapple-target-required", pair, "mounted-grapple-rejected");
  const targetKind = idOf(target) === idOf(pair.rider) ? "rider" : idOf(target) === idOf(pair.mount) ? "mount" : "other";
  return {
    accepted: true,
    targetKind,
    requestedInteraction,
    ordinaryStandingClinchAllowed: targetKind === "other",
    forcedDismountRequired: requestedInteraction === "pull-rider" || requestedInteraction === "unseat-rider",
    syntheticSidearmAllowed: false,
    events: [event("mounted-grapple-target-resolved", { ...pair, riderId: idOf(pair.rider), mountId: idOf(pair.mount) }, { targetId: idOf(target), targetKind, requestedInteraction })],
  };
}

export function resolveMountedOutcome({ rider, mount, riderOutcome = "continues", mountOutcome = "contested" } = {}) {
  return {
    rider: { actorId: idOf(rider), outcome: riderOutcome, remainsInWorld: true },
    mount: { actorId: idOf(mount), outcome: mountOutcome, remainsInWorld: true, humanoidSurrenderPanel: isHumanoidSurrenderAllowedForActor(mount) },
  };
}

export function getCanonicalMountedPresentation({ pair, mountedTurn = null } = {}) {
  if (!pair?.accepted) return { visible: false, reason: "invalid-mounted-link" };
  const rider = pair.rider;
  const mount = pair.mount;
  const controlState = pair.link.mountedState?.controlState || "controlled";
  return freeze({
    visible: true,
    relationshipGlyph: "rider-attached",
    primaryTokenActorId: idOf(mount),
    attachedMarkerActorId: idOf(rider),
    riderTargetable: true,
    mountTargetable: true,
    position: point(mount),
    riderPosition: deriveCanonicalPassengerPosition({ link: pair.link, carrier: mount }).position,
    tooltip: `${rider.name} riding ${mount.name}; control ${controlState}; rider HP ${finite(rider.currentHP ?? rider.hp)}, stamina ${finite(rider.combatStamina?.current ?? rider.currentStamina)}; mount HP ${finite(mount.currentHP ?? mount.hp)}, stamina ${finite(mount.combatStamina?.current ?? mount.currentStamina)}.`,
    ariaLabel: `${rider.name}, rider, mounted on ${mount.name}, mount, ${controlState}, current action ${mountedTurn?.currentActionOwner || "none"}`,
  });
}

export function validateCanonicalMountedState({ registry, actors = [], rendererWrite = false } = {}) {
  const diagnostics = [];
  const byId = new Map(actors.map((actor) => [idOf(actor), actor]));
  for (const link of registry?.carrierRegistry?.links?.values?.() || []) {
    if (link.relationshipType !== "mounted" || ["released", "broken"].includes(link.state)) continue;
    const rider = byId.get(link.passengerId);
    const mount = byId.get(link.carrierId);
    const record = { ...link, pairId: link.mountedState?.pairId || link.linkId, riderId: link.passengerId, mountId: link.carrierId };
    if (!rider || !mount || rider === mount) diagnostics.push(event("invalid-mounted-link", record, { reason: "missing-or-equal-actor" }));
    if (mount?.mountProfile?.mayServeAsMount !== true) diagnostics.push(event("invalid-mounted-link", record, { reason: "missing-mount-profile" }));
    if (rider?.riderProfile?.mayRide !== true) diagnostics.push(event("invalid-mounted-link", record, { reason: "missing-rider-profile" }));
    if (rider?.hpState && rider.hpState === mount?.hpState) diagnostics.push(event("mount-rider-hp-merge", record));
    if (rider?.combatStamina && rider.combatStamina === mount?.combatStamina) diagnostics.push(event("mount-rider-stamina-merge", record));
    if ((mount?.weaponProfiles || []).some((profile) => ownsProfile(rider, profile) && !isCanonicalNaturalAttack(profile))) diagnostics.push(event("rider-weapon-on-mount", record));
    if ((rider?.weaponProfiles || []).some((profile) => ownsProfile(mount, profile) && isCanonicalNaturalAttack(profile))) diagnostics.push(event("mount-natural-attack-on-rider", record));
    if (mount?.armorProfile?.profileKey === rider?.armorProfile?.profileKey && mount?.armorProfile?.profileKey) diagnostics.push(event("mount-rider-armor-merge", record));
    if (rider?.armorProfile?.barding === true) diagnostics.push(event("barding-applied-to-rider", record));
    if (mount?.equippedArmor?.profileKey === "armor.plate-harness") diagnostics.push(event("plate-harness-applied-to-mount", record));
    if (rider?.combinedBody?.mode === "MOUNTED" || mount?.combinedBody?.mode === "MOUNTED") diagnostics.push(event("mounted-actor-using-old-combinedBody-authority", record));
    if (rendererWrite) diagnostics.push(event("renderer-writing-mounted-position", record));
    const derived = rider && mount ? deriveCanonicalPassengerPosition({ link, carrier: mount }) : null;
    if (derived?.accepted && (point(rider).x !== derived.position.x || point(rider).y !== derived.position.y)) diagnostics.push(event("rider-position-divergence", record));
  }
  for (const receipt of registry?.continuations?.values?.() || []) {
    if (receipt.state === "fired") diagnostics.push(event("unresolved-mounted-continuation", receipt));
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

export default {
  MOUNTED_ACTION_CONTRACTS,
  cancelCanonicalMountedContinuations,
  claimCanonicalMountedAction,
  completeCanonicalMountedAction,
  consumeCanonicalMountedContinuation,
  createCanonicalMountedCombatRegistry,
  createCanonicalMountedContinuation,
  createCanonicalMountedTurn,
  executeCanonicalForcedDismount,
  executeCanonicalMountNaturalAttack,
  executeCanonicalMountedCharge,
  executeCanonicalMountedMovement,
  executeCanonicalMountedRiderAttack,
  filterCanonicalMountedAIActions,
  getCanonicalMountedPair,
  getCanonicalMountedPresentation,
  prepareCanonicalBraceAgainstCharge,
  rejectMountedRiderIndependentMovement,
  resolveCanonicalMountControl,
  resolveCanonicalMountedTarget,
  resolveMountedGrappleTarget,
  resolveMountedIncapacitation,
  resolveMountedOutcome,
  validateCanonicalMountedState,
};
