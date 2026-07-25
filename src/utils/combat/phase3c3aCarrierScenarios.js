import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { buildCombatActionCatalog } from "../combatActionCatalog.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import {
  commitCanonicalCarrierMovement,
  createCanonicalCarrierRegistry,
  establishCanonicalCarrierLink,
  establishPreyControl,
  executeCanonicalDismountAction,
  executeCanonicalMountAction,
  registerCanonicalCarrierSchedule,
  rejectIndependentPassengerMovement,
  releaseCanonicalCarrierLink,
  resolvePreyStruggle,
  resolveReleasedPassengerFall,
  validateCanonicalCarrierRelationships,
  validateCanonicalCarrierSchedule,
} from "./canonicalCarrierLink.js";

const actor = (actorKey, id, position, extra = {}) => normalizeReferenceCombatActor({
  ...structuredClone(getCanonicalCombatActorDefinition(actorKey)),
  id,
  instanceId: `phase3c3a:${id}`,
  position,
  x: position.x,
  y: position.y,
  ...extra,
}, { source: "phase3c3a-browser-importable-scenario" }).normalizedActor;

const owner = (generationId, round, actorId, sequence) => ({
  generationId,
  initiativeTurnId: `${generationId}:round:${round}:${actorId}`,
  actionToken: `${generationId}:round:${round}:${actorId}:action:${sequence}`,
  actorId,
});

const tinyPrey = () => ({
  id: "fixture:tiny-prey",
  instanceId: "phase3c3a:fixture:tiny-prey",
  actorKey: "fixture-tiny-prey",
  name: "Tiny Prey",
  species: "field-rodent",
  creatureType: "animal",
  size: "tiny",
  weight: 4,
  equipment: [],
  currentHP: 3,
  maxHP: 3,
  currentStamina: 4,
  position: { x: 2, y: 2, altitudeFeet: 0 },
  quarryProfile: { eligible: true, source: "internal-deterministic-fixture" },
  naturalAttackProfiles: [],
});

export function runPhase3C3AHawkPreyScenario() {
  const generationId = "phase3c3a:hawk-prey";
  const registry = createCanonicalCarrierRegistry();
  const hawk = actor("hawk", "enemy:hawk:carrier", { x: 2, y: 2, altitudeFeet: 5 });
  const prey = tinyPrey();
  const controlOwner = owner(generationId, 1, hawk.id, 1);
  const control = establishPreyControl({
    carrier: hawk,
    passenger: prey,
    controlResult: { accepted: true, carrierId: hawk.id, passengerId: prey.id },
    ...controlOwner,
  });
  const linked = establishCanonicalCarrierLink({
    registry,
    carrier: hawk,
    passenger: prey,
    relationshipType: "prey-carry",
    controlType: "restrained-prey",
    controlRecord: control.controlRecord,
    ...controlOwner,
    authoritativeTurn: controlOwner,
    restraintState: "controlled",
  });
  const movementOwner = owner(generationId, 1, hawk.id, 2);
  const movement = commitCanonicalCarrierMovement({
    registry,
    linkId: linked.link.linkId,
    carrier: hawk,
    passenger: prey,
    destination: { x: 8, y: 3, altitudeFeet: 30 },
    ...movementOwner,
    authoritativeTurn: movementOwner,
  });
  const struggle = resolvePreyStruggle({
    registry,
    linkId: linked.link.linkId,
    opposedResult: { escaped: false, source: "deterministic-existing-grapple-opposition" },
    actionToken: `${movementOwner.actionToken}:struggle`,
  });
  const releaseOwner = owner(generationId, 2, hawk.id, 1);
  const released = releaseCanonicalCarrierLink({
    registry,
    linkId: linked.link.linkId,
    carrier: movement.carrier,
    passenger: movement.passenger,
    ...releaseOwner,
    cause: "controlled-release",
    landingPosition: { x: 8, y: 3, altitudeFeet: 0 },
    authoritativeTurn: releaseOwner,
  });
  const hpBeforeFall = released.passenger.currentHP;
  const fall = resolveReleasedPassengerFall({
    registry,
    release: released,
    actor: released.passenger,
    ...releaseOwner,
    authorizeImpact: () => ({ accepted: true }),
    resolveImpact: ({ actor: fallingActor }) => ({ actor: fallingActor, damage: 0 }),
  });
  const duplicateFall = resolveReleasedPassengerFall({
    registry,
    release: released,
    actor: released.passenger,
    ...releaseOwner,
  });
  const diagnostics = [
    ...control.events,
    ...linked.events,
    ...movement.events,
    ...struggle.events,
    ...released.events,
    ...fall.events,
  ];
  return {
    route: "/combat",
    generationId,
    registry,
    hawk: movement.carrier,
    prey: fall.actor,
    control,
    linked,
    movement,
    struggle,
    released,
    fall,
    duplicateFall,
    hpBeforeFall,
    diagnostics,
    validation: validateCanonicalCarrierRelationships({
      registry,
      actors: [movement.carrier, fall.actor],
    }),
  };
}

export function runPhase3C3AKnightWarhorseScenario() {
  const generationId = "phase3c3a:knight-warhorse";
  const registry = createCanonicalCarrierRegistry();
  const knight = actor("knight", "party:knight:rider", { x: 3, y: 3, altitudeFeet: 0 });
  const warhorse = actor("warhorse", "party:warhorse:mount", { x: 3, y: 3, altitudeFeet: 0 });
  const mountOwner = owner(generationId, 1, knight.id, 1);
  const beforeCatalog = buildCombatActionCatalog({
    actor: knight,
    currentTurnEntry: { remainingActions: 2 },
    selectedTarget: warhorse,
  });
  const mounted = executeCanonicalMountAction({
    registry,
    rider: knight,
    mount: warhorse,
    ...mountOwner,
    authoritativeTurn: mountOwner,
  });
  const movementOwner = owner(generationId, 1, warhorse.id, 2);
  const movement = commitCanonicalCarrierMovement({
    registry,
    linkId: mounted.link.linkId,
    carrier: warhorse,
    passenger: knight,
    destination: { x: 9, y: 4, altitudeFeet: 0 },
    ...movementOwner,
    authoritativeTurn: movementOwner,
  });
  const riderMove = rejectIndependentPassengerMovement({
    registry,
    passenger: movement.passenger,
    requestedPosition: { x: 10, y: 4, altitudeFeet: 0 },
  });
  const duringCatalog = buildCombatActionCatalog({
    actor: movement.passenger,
    currentTurnEntry: { remainingActions: 1 },
    carrierContext: { activeLink: movement.link },
  });
  const dismountOwner = owner(generationId, 2, movement.passenger.id, 1);
  const dismounted = executeCanonicalDismountAction({
    registry,
    linkId: mounted.link.linkId,
    rider: movement.passenger,
    mount: movement.carrier,
    ...dismountOwner,
    destination: { x: 9, y: 5, altitudeFeet: 0 },
    authoritativeTurn: dismountOwner,
  });
  const diagnostics = [
    ...mounted.events,
    ...movement.events,
    ...riderMove.events,
    ...dismounted.events,
  ];
  return {
    route: "/combat",
    generationId,
    registry,
    knight: dismounted.passenger,
    warhorse: dismounted.carrier,
    mounted,
    movement,
    riderMove,
    dismounted,
    beforeCatalog,
    duringCatalog,
    diagnostics,
    separateIdentity: knight.id !== warhorse.id
      && knight.actorKey !== warhorse.actorKey
      && knight.combatStamina !== warhorse.combatStamina,
  };
}

export function runPhase3C3AStaleCallbackScenario() {
  const generationId = "phase3c3a:stale";
  const registry = createCanonicalCarrierRegistry();
  const hawk = actor("hawk", "enemy:hawk:stale", { x: 1, y: 1, altitudeFeet: 10 });
  const prey = tinyPrey();
  const controlOwner = owner(generationId, 1, hawk.id, 1);
  const control = establishPreyControl({
    carrier: hawk,
    passenger: prey,
    controlResult: { accepted: true, carrierId: hawk.id, passengerId: prey.id },
    ...controlOwner,
  });
  const linked = establishCanonicalCarrierLink({
    registry,
    carrier: hawk,
    passenger: prey,
    relationshipType: "prey-carry",
    controlType: "restrained-prey",
    controlRecord: control.controlRecord,
    ...controlOwner,
    authoritativeTurn: controlOwner,
  });
  const schedule = registerCanonicalCarrierSchedule({
    registry,
    scheduleId: "phase3c3a:stale:callback",
    scheduleKind: "carrier-movement",
    ownerId: linked.link.linkId,
    ...controlOwner,
  });
  const stale = validateCanonicalCarrierSchedule({
    registry,
    scheduleId: schedule.schedule.scheduleId,
    generationId: `${generationId}:new`,
    initiativeTurnId: controlOwner.initiativeTurnId,
    actionToken: controlOwner.actionToken,
  });
  const staleMovement = commitCanonicalCarrierMovement({
    registry,
    linkId: linked.link.linkId,
    carrier: hawk,
    passenger: prey,
    destination: { x: 99, y: 99, altitudeFeet: 99 },
    generationId: `${generationId}:new`,
    initiativeTurnId: controlOwner.initiativeTurnId,
    actionToken: controlOwner.actionToken,
  });
  return {
    route: "/combat",
    registry,
    linked,
    schedule,
    stale,
    staleMovement,
    hawk,
    prey,
    diagnostics: [...stale.events, ...staleMovement.events],
  };
}

export function runPhase3C3ABrowserScenarios() {
  const hawkPrey = runPhase3C3AHawkPreyScenario();
  const knightWarhorse = runPhase3C3AKnightWarhorseScenario();
  const stale = runPhase3C3AStaleCallbackScenario();
  const diagnostics = [
    ...hawkPrey.diagnostics,
    ...knightWarhorse.diagnostics,
  ];
  const forbiddenPattern = /invalid-carrier-link|duplicate-carrier-link|passenger-position-divergence|passenger-independent-movement(?!-rejected)|stale-carrier-callback(?!-rejected)|duplicate-release|dropped-target-without-fall|duplicate-fall(?!-rejected)|stale-fall-callback(?!-rejected)|mount-rider-hp-merge|rider-independent-movement(?!-rejected)|turn-key-mismatch|round rollback|previous-turn-busy|busy-start-block|duplicate completion|duplicate finalizer|unresolved continuation|post-outcome movement|post-outcome attack|unknown authoritative actor|attack-resolution error/i;
  return {
    route: "/combat",
    hawkPrey,
    knightWarhorse,
    stale,
    authorityErrorCount: diagnostics.filter((entry) => forbiddenPattern.test(entry.eventType || "")).length,
    expectedNegativeDiagnostics: stale.diagnostics.map((entry) => entry.eventType),
  };
}

export default runPhase3C3ABrowserScenarios;
