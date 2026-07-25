import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { shopItems } from "../../data/shopItems.js";
import {
  createCanonicalCarrierRegistry,
  executeCanonicalMountAction,
} from "./canonicalCarrierLink.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import {
  claimCanonicalMountedAction,
  completeCanonicalMountedAction,
  createCanonicalMountedCombatRegistry,
  createCanonicalMountedContinuation,
  createCanonicalMountedTurn,
  executeCanonicalForcedDismount,
  executeCanonicalMountedCharge,
  executeCanonicalMountedMovement,
  getCanonicalMountedPair,
  prepareCanonicalBraceAgainstCharge,
  resolveCanonicalMountedTarget,
  validateCanonicalMountedState,
} from "./canonicalMountedCombat.js";

const actor = (actorKey, id, team, position, extra = {}) => normalizeReferenceCombatActor({
  ...structuredClone(getCanonicalCombatActorDefinition(actorKey)),
  id,
  team,
  side: team,
  battleSide: team,
  position,
  x: position.x,
  y: position.y,
  remainingActions: 2,
  ...extra,
}, { source: "phase3c3b-browser-importable-scenario" }).normalizedActor;

const owner = (generationId, initiativeTurnId, actorId, actionToken = `${initiativeTurnId}:action:mount`) => ({
  generationId,
  initiativeTurnId,
  actionToken,
  actorId,
});

const spend = ({ actor: currentActor, amount = 0 }) => {
  const previous = Number(currentActor.combatStamina?.current ?? currentActor.currentStamina ?? 0);
  const applied = Math.min(previous, Math.max(0, Number(amount) || 0));
  const next = previous - applied;
  return {
    accepted: applied === Math.max(0, Number(amount) || 0),
    actor: {
      ...currentActor,
      currentStamina: next,
      combatStamina: { ...currentActor.combatStamina, current: next },
    },
    previous,
    requested: amount,
    applied,
    next,
  };
};

export function createPhase3C3BMountedFixture(suffix) {
  const generationId = `phase3c3b:${suffix}`;
  const carrierRegistry = createCanonicalCarrierRegistry();
  const registry = createCanonicalMountedCombatRegistry({ carrierRegistry });
  const knight = actor("knight", `party:knight:${suffix}`, "party", { x: 2, y: 2, altitudeFeet: 0 });
  const warhorse = actor("warhorse", `party:warhorse:${suffix}`, "party", { x: 2, y: 2, altitudeFeet: 0 });
  const initiativeTurnId = `${generationId}:round:1:mounted-pair`;
  const mountOwner = owner(generationId, initiativeTurnId, knight.id);
  const mounted = executeCanonicalMountAction({
    registry: carrierRegistry,
    rider: knight,
    mount: warhorse,
    ...mountOwner,
    authoritativeTurn: mountOwner,
  });
  const rider = { ...knight, carrierLink: mounted.link, position: { x: 2, y: 2, altitudeFeet: 0 } };
  const mount = { ...warhorse, carrierLink: mounted.link };
  const turn = createCanonicalMountedTurn({
    registry,
    linkId: mounted.link.linkId,
    rider,
    mount,
    generationId,
    initiativeTurnId,
    authoritativeTurn: { generationId, initiativeTurnId, actorId: rider.id },
  });
  const pair = getCanonicalMountedPair({ registry, linkId: mounted.link.linkId, rider, mount });
  return { generationId, initiativeTurnId, registry, carrierRegistry, knight: rider, warhorse: mount, mounted, turn, pair };
}

export function runPhase3C3BMountAndMoveScenario() {
  const fixture = createPhase3C3BMountedFixture("mount-and-move");
  const claim = claimCanonicalMountedAction({
    registry: fixture.registry,
    mountedTurnId: fixture.turn.mountedTurn.mountedTurnId,
    actionKey: "mounted-walk",
    owner: "mount",
    generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId,
  });
  const movement = executeCanonicalMountedMovement({
    registry: fixture.registry,
    claim: claim.claim,
    rider: fixture.knight,
    mount: fixture.warhorse,
    destination: { x: 12, y: 2, altitudeFeet: 0 },
    movementMode: "walk",
    mountStaminaCost: 1,
    spendStamina: spend,
  });
  const completion = completeCanonicalMountedAction({ registry: fixture.registry, actionToken: claim.claim.actionToken });
  const rider = { ...movement.rider, carrierLink: movement.link };
  const mount = { ...movement.mount, carrierLink: movement.link };
  const pair = getCanonicalMountedPair({ registry: fixture.registry, linkId: movement.link.linkId, rider, mount });
  const diagnostics = [...fixture.mounted.events, ...fixture.turn.events, ...claim.events, ...movement.events, ...completion.events];
  return { route: "/combat", ...fixture, rider, mount, pair, claim, movement, completion, diagnostics };
}

export function runPhase3C3BChargeAndBraceScenario() {
  const fixture = createPhase3C3BMountedFixture("charge-and-brace");
  const spearman = actor("spearman", "enemy:spearman:brace", "enemy", { x: 22, y: 2, altitudeFeet: 0 });
  const spear = spearman.weaponProfiles[0];
  const brace = prepareCanonicalBraceAgainstCharge({
    registry: fixture.registry,
    defender: spearman,
    actionToken: `${fixture.initiativeTurnId}:brace`,
    generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId,
    weapon: spear,
    grounded: true,
  });
  const lanceItem = shopItems.find((item) => item.name === "Lance");
  const lanceIdentity = Object.freeze({
    ...lanceItem,
    profileKey: `shop-item:${lanceItem.id}:lance`,
    deliveryType: "extended-melee",
    source: "shopItems",
  });
  const rider = { ...fixture.knight, weaponProfiles: [...fixture.knight.weaponProfiles, lanceIdentity] };
  const pair = getCanonicalMountedPair({ registry: fixture.registry, linkId: fixture.mounted.link.linkId, rider, mount: fixture.warhorse });
  const claim = claimCanonicalMountedAction({
    registry: fixture.registry,
    mountedTurnId: fixture.turn.mountedTurn.mountedTurnId,
    actionKey: "mounted-charge",
    owner: "coordinated",
    generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId,
    targetId: spearman.id,
    attackId: lanceIdentity.profileKey,
  });
  const order = [];
  const charge = executeCanonicalMountedCharge({
    registry: fixture.registry,
    claim: claim.claim,
    rider,
    mount: fixture.warhorse,
    target: spearman,
    weapon: lanceIdentity,
    pair,
    destination: { x: 17, y: 2, altitudeFeet: 0 },
    path: { straightLine: true, obstructed: false, straightLineFeet: 15, momentum: 15 },
    terrain: { mountPassable: true, occupiedByHostile: false },
    mountStaminaCost: 1,
    riderStaminaCost: 1,
    spendStamina: spend,
    resolveBrace: ({ preparedBrace }) => {
      order.push("brace");
      return { accepted: true, interrupted: false, preparedBrace, events: [] };
    },
    authorizeImpact: () => {
      order.push("authorized");
      return { accepted: true };
    },
    resolveImpact: ({ attacker, target }) => {
      order.push("impact");
      return { attacker, target, damage: 0, pipeline: "canonical-impact-pipeline" };
    },
  });
  const completion = completeCanonicalMountedAction({ registry: fixture.registry, actionToken: claim.claim.actionToken });
  const diagnostics = [...fixture.mounted.events, ...fixture.turn.events, ...brace.events, ...claim.events, ...(charge.events || []), ...completion.events];
  return { route: "/combat", ...fixture, rider, pair, spearman, lanceIdentity, brace, claim, charge, completion, order, diagnostics };
}

export function runPhase3C3BTargetingScenario() {
  const fixture = createPhase3C3BMountedFixture("targeting");
  const archer = actor("archer", "enemy:archer:targeting", "enemy", { x: 40, y: 2, altitudeFeet: 0 });
  const projectile = archer.weaponProfiles.find((profile) => profile.deliveryType === "projectile");
  const riderTarget = resolveCanonicalMountedTarget({ pair: fixture.pair, attacker: archer, target: fixture.knight, deliveryType: projectile.deliveryType, reachFeet: projectile.normalRangeFeet });
  const mountTarget = resolveCanonicalMountedTarget({ pair: fixture.pair, attacker: archer, target: fixture.warhorse, deliveryType: projectile.deliveryType, reachFeet: projectile.normalRangeFeet });
  return {
    route: "/combat",
    ...fixture,
    archer,
    projectile,
    riderTarget,
    mountTarget,
    riderArmor: fixture.knight.armorProfile,
    mountArmor: fixture.warhorse.armorProfile,
    diagnostics: [...fixture.mounted.events, ...fixture.turn.events, ...riderTarget.events, ...mountTarget.events],
  };
}

export function runPhase3C3BForcedDismountScenario() {
  const fixture = createPhase3C3BMountedFixture("forced-dismount");
  const mount = { ...fixture.warhorse, currentHP: 0, hp: 0, unconscious: true };
  const actionToken = `${fixture.initiativeTurnId}:forced-dismount`;
  const forced = executeCanonicalForcedDismount({
    registry: fixture.registry,
    linkId: fixture.mounted.link.linkId,
    rider: fixture.knight,
    mount,
    generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId,
    actionToken,
    cause: "mount-incapacitated",
    landingPosition: { x: 3, y: 2, altitudeFeet: 0 },
    authorizeImpact: () => ({ accepted: true }),
    resolveImpact: ({ actor: fallingActor }) => ({ actor: fallingActor, damage: 0 }),
  });
  const duplicate = executeCanonicalForcedDismount({
    registry: fixture.registry,
    linkId: fixture.mounted.link.linkId,
    rider: fixture.knight,
    mount,
    generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId,
    actionToken,
    cause: "mount-incapacitated",
    landingPosition: { x: 3, y: 2, altitudeFeet: 0 },
  });
  return { route: "/combat", ...fixture, mount, forced, duplicate, diagnostics: [...fixture.mounted.events, ...fixture.turn.events, ...(forced.events || [])] };
}

export function runPhase3C3BMountedBrowserScenarios() {
  const mountAndMove = runPhase3C3BMountAndMoveScenario();
  const chargeAndBrace = runPhase3C3BChargeAndBraceScenario();
  const targeting = runPhase3C3BTargetingScenario();
  const forcedDismount = runPhase3C3BForcedDismountScenario();
  const diagnostics = [...mountAndMove.diagnostics, ...chargeAndBrace.diagnostics, ...targeting.diagnostics, ...forcedDismount.diagnostics];
  const forbidden = new Set([
    "invalid-mounted-link", "duplicate-mounted-turn", "rider-independent-movement",
    "rider-position-divergence", "mount-rider-hp-merge", "mount-rider-stamina-merge",
    "rider-weapon-on-mount", "mount-natural-attack-on-rider", "free-mount-attack",
    "invalid-mounted-charge", "charge-without-movement", "duplicate-forced-dismount",
    "stale-forced-dismount", "stale-mounted-callback", "unresolved-mounted-continuation",
    "turn-key-mismatch", "round-rollback", "previous-turn-busy", "busy-start-block",
    "duplicate-completion", "duplicate-finalizer", "post-outcome-movement",
    "post-outcome-attack", "unknown-authoritative-actor", "attack-resolution-error",
  ]);
  const validation = validateCanonicalMountedState({
    registry: mountAndMove.registry,
    actors: [mountAndMove.rider, mountAndMove.mount],
  });
  return {
    route: "/combat",
    mountAndMove,
    chargeAndBrace,
    targeting,
    forcedDismount,
    validation,
    authorityErrorCount: diagnostics.filter((entry) => forbidden.has(entry.eventType)).length,
    combatOverCount: 1,
    diagnostics,
  };
}

export default runPhase3C3BMountedBrowserScenarios;
