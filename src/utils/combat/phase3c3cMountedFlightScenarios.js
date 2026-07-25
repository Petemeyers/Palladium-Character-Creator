import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import { createCanonicalCarrierRegistry } from "./canonicalCarrierLink.js";
import {
  claimCanonicalMountedFlightAction,
  completeCanonicalMountedFlightAction,
  createCanonicalMountedFlightRegistry,
  createCanonicalMountedFlightTurn,
  establishCanonicalFlyingMountedLink,
  executeCanonicalAerialRiderAttack,
  executeCanonicalFlyingMountNaturalAttack,
  executeCanonicalMountedFlightTransition,
  finalizeCanonicalMountedFlightEncounter,
  resolveCanonicalAerialTargetGeometry,
  resolveCanonicalIntelligentMountCommand,
  resolveCanonicalLinkedMountedFall,
  validateCanonicalMountedFlightState,
} from "./canonicalMountedFlight.js";

const clone = (value) => structuredClone(value);

const actor = (actorKey, id, team, position, extra = {}) => normalizeReferenceCombatActor({
  ...clone(getCanonicalCombatActorDefinition(actorKey)),
  id,
  team,
  side: team,
  battleSide: team,
  position,
  x: position.x,
  y: position.y,
  remainingActions: 4,
  ...extra,
}, { source: "phase3c3c-browser-importable-scenario" }).normalizedActor;

export const INTERNAL_FLYING_MOUNT_FIXTURE_KEY = "__phase3c3c_internal_flying_mount__";

export function createInternalFlyingMountFixture(id, position = { x: 2, y: 2, altitudeFeet: 0 }) {
  const naturalAttack = Object.freeze({
    id: "internal-flight-fixture-talons",
    profileKey: "internal-flight-fixture-talons",
    attackKey: "internal-flight-fixture-talons",
    name: "Fixture Talons",
    deliveryType: "natural",
    naturalWeapon: true,
    isNaturalAttack: true,
    reachFeet: 5,
    anatomySource: "talons",
    testOnly: true,
  });
  return {
    id,
    actorKey: INTERNAL_FLYING_MOUNT_FIXTURE_KEY,
    name: "Internal Aerial Test Mount",
    source: "internal-deterministic-fixture",
    internalFixture: true,
    selectable: false,
    playable: false,
    team: "party",
    side: "party",
    category: "animal",
    creatureType: "animal",
    species: "internal-aerial-test-animal",
    size: "large",
    weight: 700,
    currentHP: 60,
    hp: 60,
    maxHP: 60,
    currentStamina: 20,
    combatStamina: { current: 20, maximum: 20 },
    remainingActions: 6,
    actionsPerRound: 6,
    position: { ...position },
    x: position.x,
    y: position.y,
    altitude: position.altitudeFeet,
    altitudeFeet: position.altitudeFeet,
    flightState: Object.freeze({
      mode: position.altitudeFeet > 0 ? "airborne" : "grounded",
      altitudeFeet: position.altitudeFeet,
      altitudeBand: position.altitudeFeet > 10 ? "medium" : position.altitudeFeet > 0 ? "low" : "ground",
      horizontalPosition: Object.freeze({ x: position.x, y: position.y }),
      verticalVelocity: 0,
      supportState: position.altitudeFeet > 0 ? "unsupported" : "ground",
      transitionState: "idle",
    }),
    movementModes: ["ground", "flying"],
    movement: { ground: 30, flying: 80 },
    flightProfile: {
      kind: "biological",
      takeoffAltitudeFeet: 10,
      maximumAltitudeFeet: 200,
    },
    anatomyProfile: {
      wingsPresent: true,
      wingsFunctional: true,
      talonsPresent: true,
    },
    flyingMountProfile: {
      mayServeAsFlyingMount: true,
      permittedRiderSizes: ["small", "medium"],
      maximumRiders: 1,
      riderAttachmentRequired: true,
      allowedAttachmentTypes: ["secured", "saddled", "harnessed", "bareback", "loose"],
      carryingCapacity: 500,
      equipmentCapacity: 100,
      controlProfile: {
        intelligenceClass: "sapient",
        defaultControlType: "independent-intelligent-mount",
        trainingClass: "internal-fixture-trained",
        mayRefuseCommands: false,
        mayActIndependently: true,
        mayPanic: true,
        requiresRidingSkill: true,
      },
      flightLoadProfile: {
        unloaded: 0.25,
        normal: 0.7,
        strained: 1,
        overloaded: 1.25,
        impossible: Infinity,
        maximumFlightLoad: 500,
      },
      supportedMountedFlightActions: [
        "flying-mount-takeoff", "flying-mount-ascend", "flying-mount-descend",
        "mounted-flight-move", "flying-mount-land",
      ],
      supportedRiderActions: [
        "secure-seat", "release-from-flying-mount", "emergency-aerial-separation",
        "mounted-aerial-rider-ranged-attack", "mounted-aerial-rider-melee-attack",
        "command-intelligent-mount", "recover-mounted-flight-control",
      ],
      supportedMountActions: ["flying-mount-natural-attack"],
      supportedCoordinatedActions: [],
      takeoffProfile: { clearanceRequired: true },
      landingProfile: { clearLandingRequired: true },
      linkedFallProfile: { separateImpactAuthority: true },
    },
    carrierProfile: {
      maximumLoad: 500,
      allowedRelationshipTypes: ["flying-mounted"],
      authority: "internal-flying-mount-fixture",
    },
    equipment: [{ id: "internal-flight-harness", name: "Test Flight Harness", weight: 20, testOnly: true }],
    weaponProfiles: [naturalAttack],
    naturalAttackProfiles: [naturalAttack],
    armorProfile: { profileKey: "internal-mount-hide", name: "Fixture Hide", testOnly: true },
  };
}

const owner = (generationId, initiativeTurnId, actorId, actionToken) => ({
  generationId, initiativeTurnId, actorId, actionToken,
});

export function createPhase3C3CMountedFlightFixture(suffix, { riderKey = "knight", airborne = false } = {}) {
  const generationId = `phase3c3c:${suffix}`;
  const initiativeTurnId = `${generationId}:round:1:mounted-flight`;
  const altitudeFeet = airborne ? 20 : 0;
  const carrierRegistry = createCanonicalCarrierRegistry();
  const registry = createCanonicalMountedFlightRegistry({ carrierRegistry });
  const baseRider = actor(riderKey, `party:${riderKey}:${suffix}`, "party", { x: 2, y: 2, altitudeFeet }, {
    remainingActions: 6,
  });
  const knightProfile = clone(getCanonicalCombatActorDefinition("knight").riderProfile);
  const rider = { ...baseRider, riderProfile: baseRider.riderProfile || knightProfile, weight: 180 };
  const mount = createInternalFlyingMountFixture(`party:internal-flying-mount:${suffix}`, { x: 2, y: 2, altitudeFeet });
  const mountActionToken = `${initiativeTurnId}:attach`;
  const attachmentOwner = owner(generationId, initiativeTurnId, rider.id, mountActionToken);
  const mounted = establishCanonicalFlyingMountedLink({
    registry, mount, rider, generationId, initiativeTurnId, actionToken: mountActionToken,
    authoritativeTurn: attachmentOwner, attachmentState: "saddled",
    riderEquipment: rider.equipment, mountEquipment: mount.equipment,
  });
  const linkedRider = { ...rider, carrierLink: mounted.link, position: { x: 2, y: 2, altitudeFeet }, altitudeFeet };
  const linkedMount = { ...mount, carrierLink: mounted.link };
  const turn = createCanonicalMountedFlightTurn({
    registry, linkId: mounted.link.linkId, rider: linkedRider, mount: linkedMount,
    generationId, initiativeTurnId,
    authoritativeTurn: { generationId, initiativeTurnId, actorId: linkedRider.id },
  });
  return { generationId, initiativeTurnId, registry, carrierRegistry, rider: linkedRider, mount: linkedMount, mounted, turn };
}

const performFlightAction = ({ fixture, rider, mount, actionKey, owner: actionOwner, destination, mountStaminaCost = 0, movementRequired = 0 }) => {
  const claim = claimCanonicalMountedFlightAction({
    registry: fixture.registry,
    mountedTurnId: fixture.turn.mountedFlightTurn.mountedTurnId,
    actionKey,
    owner: actionOwner,
    generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId,
  });
  const execution = executeCanonicalMountedFlightTransition({
    registry: fixture.registry, claim: claim.claim, rider, mount, destination,
    mountStaminaCost, movementRequired, movementAvailable: 100,
  });
  const completion = completeCanonicalMountedFlightAction({ registry: fixture.registry, actionToken: claim.claim.actionToken });
  return { claim, execution, completion, rider: execution.rider, mount: execution.mount };
};

export function runPhase3C3CTakeoffMovementLandingScenario() {
  const fixture = createPhase3C3CMountedFlightFixture("takeoff-move-land");
  const takeoff = performFlightAction({
    fixture, rider: fixture.rider, mount: fixture.mount,
    actionKey: "flying-mount-takeoff", owner: "mount",
    destination: { x: 2, y: 2, altitudeFeet: 10 }, mountStaminaCost: 1,
  });
  const movement = performFlightAction({
    fixture, rider: takeoff.rider, mount: takeoff.mount,
    actionKey: "mounted-flight-move", owner: "mount",
    destination: { x: 22, y: 2, altitudeFeet: 10 }, movementRequired: 20, mountStaminaCost: 1,
  });
  const descend = performFlightAction({
    fixture, rider: movement.rider, mount: movement.mount,
    actionKey: "flying-mount-descend", owner: "mount",
    destination: { x: 22, y: 2, altitudeFeet: 5 }, mountStaminaCost: 0,
  });
  const landing = performFlightAction({
    fixture, rider: descend.rider, mount: descend.mount,
    actionKey: "flying-mount-land", owner: "mount",
    destination: { x: 22, y: 2, altitudeFeet: 0 }, mountStaminaCost: 0,
  });
  const diagnostics = [
    ...fixture.mounted.events, ...fixture.turn.events,
    ...takeoff.claim.events, ...takeoff.execution.events, ...takeoff.completion.events,
    ...movement.claim.events, ...movement.execution.events, ...movement.completion.events,
    ...descend.claim.events, ...descend.execution.events, ...descend.completion.events,
    ...landing.claim.events, ...landing.execution.events, ...landing.completion.events,
  ];
  return { route: "/combat", ...fixture, takeoff, movement, descend, landing, rider: landing.rider, mount: landing.mount, diagnostics };
}

export function runPhase3C3CAerialRiderRangedScenario() {
  const fixture = createPhase3C3CMountedFlightFixture("rider-ranged", { riderKey: "longbowman", airborne: true });
  const target = actor("goblin-warrior", "enemy:goblin:phase3c3c", "enemy", { x: 42, y: 2, altitudeFeet: 0 });
  const weapon = fixture.rider.weaponProfiles.find((profile) => profile.deliveryType === "projectile");
  const claim = claimCanonicalMountedFlightAction({
    registry: fixture.registry, mountedTurnId: fixture.turn.mountedFlightTurn.mountedTurnId,
    actionKey: "mounted-aerial-rider-ranged-attack", owner: "rider",
    generationId: fixture.generationId, initiativeTurnId: fixture.initiativeTurnId,
    targetId: target.id, attackId: weapon.profileKey,
  });
  const attack = executeCanonicalAerialRiderAttack({
    registry: fixture.registry, claim: claim.claim, rider: fixture.rider, mount: fixture.mount,
    target, weapon, horizontalDistanceFeet: 40,
    consumeAmmunition: ({ actor: current }) => ({ accepted: true, actor: { ...current, fixtureAmmoSpent: (current.fixtureAmmoSpent || 0) + 1 }, spent: 1 }),
    authorizeImpact: () => ({ accepted: true }),
    resolveImpact: ({ attacker, target: currentTarget }) => ({ attacker, target: currentTarget, damage: 0, pipeline: "canonical-impact-pipeline" }),
  });
  const completion = completeCanonicalMountedFlightAction({ registry: fixture.registry, actionToken: claim.claim.actionToken });
  const diagnostics = [...fixture.mounted.events, ...fixture.turn.events, ...claim.events, ...attack.events, ...completion.events];
  return { route: "/combat", ...fixture, target, weapon, claim, attack, completion, diagnostics };
}

export function runPhase3C3CTargetingScenario() {
  const fixture = createPhase3C3CMountedFlightFixture("targeting", { airborne: true });
  const archer = actor("archer", "enemy:archer:phase3c3c", "enemy", { x: 32, y: 2, altitudeFeet: 0 });
  const projectile = archer.weaponProfiles.find((profile) => profile.deliveryType === "projectile");
  const riderTarget = resolveCanonicalAerialTargetGeometry({ attacker: archer, target: fixture.rider, deliveryType: "projectile", normalRangeFeet: projectile.normalRangeFeet, longRangeFeet: projectile.longRangeFeet, horizontalDistanceFeet: 30 });
  const mountTarget = resolveCanonicalAerialTargetGeometry({ attacker: archer, target: fixture.mount, deliveryType: "projectile", normalRangeFeet: projectile.normalRangeFeet, longRangeFeet: projectile.longRangeFeet, horizontalDistanceFeet: 30 });
  return { route: "/combat", ...fixture, archer, projectile, riderTarget, mountTarget, diagnostics: [...fixture.mounted.events, ...fixture.turn.events, ...riderTarget.events, ...mountTarget.events] };
}

export function runPhase3C3CLinkedFallScenario() {
  const fixture = createPhase3C3CMountedFlightFixture("linked-fall", { airborne: true });
  const incapacitatedMount = { ...fixture.mount, currentHP: 0, hp: 0, unconscious: true };
  const actionToken = `${fixture.initiativeTurnId}:linked-fall`;
  const fall = resolveCanonicalLinkedMountedFall({
    registry: fixture.registry, rider: fixture.rider, mount: incapacitatedMount,
    linkId: fixture.mounted.link.linkId, generationId: fixture.generationId,
    initiativeTurnId: fixture.initiativeTurnId, actionToken,
    landingPosition: { x: 2, y: 2, altitudeFeet: 0 },
    authorizeRiderImpact: () => ({ accepted: true }),
    authorizeMountImpact: () => ({ accepted: true }),
    resolveRiderImpact: ({ actor: current }) => ({ actor: { ...current, currentHP: current.currentHP - 2 }, damage: 2 }),
    resolveMountImpact: ({ actor: current }) => ({ actor: { ...current, currentHP: current.currentHP - 3 }, damage: 3 }),
  });
  return { route: "/combat", ...fixture, incapacitatedMount, fall, diagnostics: [...fixture.mounted.events, ...fixture.turn.events, ...fall.events] };
}

export function runPhase3C3CIntelligentCommandScenario() {
  const fixture = createPhase3C3CMountedFlightFixture("intelligent-command");
  const safeClaim = claimCanonicalMountedFlightAction({
    registry: fixture.registry, mountedTurnId: fixture.turn.mountedFlightTurn.mountedTurnId,
    actionKey: "command-intelligent-mount", owner: "rider",
    generationId: fixture.generationId, initiativeTurnId: fixture.initiativeTurnId,
  });
  const accepted = resolveCanonicalIntelligentMountCommand({
    registry: fixture.registry, claim: safeClaim.claim, rider: fixture.rider, mount: fixture.mount,
    command: "take-off-when-clear", commandLegal: true, survivalRisk: "routine",
  });
  const safeCompletion = completeCanonicalMountedFlightAction({ registry: fixture.registry, actionToken: safeClaim.claim.actionToken });
  const impossibleClaim = claimCanonicalMountedFlightAction({
    registry: fixture.registry, mountedTurnId: fixture.turn.mountedFlightTurn.mountedTurnId,
    actionKey: "command-intelligent-mount", owner: "rider",
    generationId: fixture.generationId, initiativeTurnId: fixture.initiativeTurnId,
  });
  const refused = resolveCanonicalIntelligentMountCommand({
    registry: fixture.registry, claim: impossibleClaim.claim, rider: fixture.rider, mount: fixture.mount,
    command: "fly-through-solid-wall", commandLegal: false, survivalRisk: "suicidal",
  });
  const impossibleCompletion = completeCanonicalMountedFlightAction({ registry: fixture.registry, actionToken: impossibleClaim.claim.actionToken });
  const finalization = finalizeCanonicalMountedFlightEncounter({
    registry: fixture.registry,
    pairId: fixture.mounted.link.mountedFlightState.pairId,
    outcome: "fixture-complete",
  });
  const diagnostics = [
    ...fixture.mounted.events, ...fixture.turn.events,
    ...safeClaim.events, ...accepted.events, ...safeCompletion.events,
    ...impossibleClaim.events, ...refused.events, ...impossibleCompletion.events,
    ...finalization.events,
  ];
  const validation = validateCanonicalMountedFlightState({ registry: fixture.registry, actors: [fixture.rider, fixture.mount] });
  return { route: "/combat", ...fixture, safeClaim, accepted, safeCompletion, impossibleClaim, refused, impossibleCompletion, finalization, validation, diagnostics };
}

export function runAllPhase3C3CBrowserScenarios() {
  return {
    takeoffMovementLanding: runPhase3C3CTakeoffMovementLandingScenario(),
    aerialRiderRanged: runPhase3C3CAerialRiderRangedScenario(),
    targeting: runPhase3C3CTargetingScenario(),
    linkedFall: runPhase3C3CLinkedFallScenario(),
    intelligentCommand: runPhase3C3CIntelligentCommandScenario(),
  };
}

export default runAllPhase3C3CBrowserScenarios;
