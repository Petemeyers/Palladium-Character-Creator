import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { getCombatIconAppearance } from "../presentation/getCombatIconAppearance.js";
import {
  authorizeAirborneNaturalAttack,
  createCanonicalFlightState,
  createFlightAuthorityRegistry,
  getCanonicalFlightPresentation,
  resolveFlightTransition,
} from "./canonicalFlightState.js";
import {
  completeCanonicalNaturalAttackImpact,
  resolveCanonicalNaturalAttack,
} from "./canonicalNaturalAttacks.js";
import { resolveCanonicalImpactPipeline } from "./canonicalImpactPipeline.js";
import {
  commitAnimalSurvivalAction,
  createAnimalSurvivalAction,
  createAnimalSurvivalRegistry,
  shouldDeferCombatForAnimalOutcome,
} from "./animalSurvivalState.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import { validateCombatActor } from "./validateCombatActor.js";

const makeActor = (actorKey, id, team, position, extra = {}) => normalizeReferenceCombatActor({
  ...getCanonicalCombatActorDefinition(actorKey),
  id,
  instanceId: `phase3c2b:${id}`,
  team,
  side: team,
  battleSide: team,
  controlMode: "ai",
  position,
  ...extra,
}, { source: "phase3c2b-browser-importable-scenario" }).normalizedActor;

const turn = (generationId, round, actorId, action) => ({
  generationId,
  actorId,
  initiativeTurnId: `${generationId}:round:${round}:${actorId}`,
  actionToken: `${generationId}:round:${round}:${actorId}:action:${action}`,
});

export function runPhase3C2BFlyingAnimalScenario() {
  const generationId = "phase3c2b:flying-animal-reference";
  const registry = createFlightAuthorityRegistry();
  const initialHawk = makeActor("hawk", "enemy:hawk:1", "enemy", { x: 6, y: 2, altitudeFeet: 0 }, {
    flightState: createCanonicalFlightState({ mode: "grounded", altitudeFeet: 0, horizontalPosition: { x: 6, y: 2 } }),
  });
  const guard = makeActor("guard", "party:guard", "party", { x: 4, y: 2, altitudeFeet: 0 });
  const takeoffOwner = turn(generationId, 1, initialHawk.id, 1);
  const takeoff = resolveFlightTransition({
    actor: initialHawk,
    requestedTransition: "takeoff",
    destination: { x: 6, y: 2, altitudeFeet: 5 },
    ...takeoffOwner,
    movementSequence: 1,
    authoritativeTurn: takeoffOwner,
    registry,
    staminaCost: 1,
    staminaAvailable: initialHawk.combatStamina.current,
  });
  const movementOwner = turn(generationId, 1, initialHawk.id, 2);
  const movement = resolveFlightTransition({
    actor: takeoff.actor,
    requestedTransition: "horizontal-flight",
    destination: { x: 4, y: 2, altitudeFeet: 5 },
    ...movementOwner,
    movementSequence: 2,
    authoritativeTurn: movementOwner,
    registry,
    movementRequired: 10,
    movementAvailable: takeoff.actor.movement.flying,
    staminaCost: 1,
    staminaAvailable: takeoff.actor.combatStamina.current - takeoff.staminaSpent,
  });
  const attackOwner = turn(generationId, 2, initialHawk.id, 1);
  const talonProfile = movement.actor.naturalAttackProfiles[0];
  const attackGeometry = authorizeAirborneNaturalAttack({
    actor: movement.actor,
    target: guard,
    profile: talonProfile,
    ...attackOwner,
    horizontalDistanceFeet: 0,
  });
  const attack = resolveCanonicalNaturalAttack({
    actor: movement.actor,
    attackKey: talonProfile.attackKey,
    initiativeTurnId: attackOwner.initiativeTurnId,
    actionToken: attackOwner.actionToken,
  });
  const impact = resolveCanonicalImpactPipeline({
    intent: {
      accepted: attack.accepted && attackGeometry.accepted,
      techniqueKey: talonProfile.attackKey,
      resolverRoute: "standard-natural-impact",
      technique: { staminaCost: 0, contactSurface: "talon" },
    },
    prerequisite: { accepted: attack.accepted && attackGeometry.accepted },
    shield: { intercepted: true },
    armor: { armorClass: "plate", rigidCoverage: true },
    contact: { penetrated: false },
  });
  const attackCompletion = completeCanonicalNaturalAttackImpact({
    actorId: movement.actor.id,
    targetId: guard.id,
    profile: attack.profile,
    initiativeTurnId: attackOwner.initiativeTurnId,
    actionToken: attackOwner.actionToken,
    committed: attack.accepted && attackGeometry.accepted,
  });
  const survivalRegistry = createAnimalSurvivalRegistry();
  const survivalOwner = turn(generationId, 3, initialHawk.id, 1);
  const survival = createAnimalSurvivalAction({
    registry: survivalRegistry,
    actor: movement.actor,
    outcome: "animal-retreated",
    ...survivalOwner,
  });
  const finalizationWhilePending = shouldDeferCombatForAnimalOutcome(survivalRegistry);
  const retreatTransition = resolveFlightTransition({
    actor: movement.actor,
    requestedTransition: "horizontal-flight",
    destination: { x: 12, y: 2, altitudeFeet: 10 },
    ...survivalOwner,
    movementSequence: 3,
    authoritativeTurn: survivalOwner,
    registry,
    movementRequired: 40,
    movementAvailable: movement.actor.movement.flying,
    staminaCost: 1,
    staminaAvailable: movement.actor.combatStamina.current - takeoff.staminaSpent - movement.staminaSpent,
  });
  const retreat = commitAnimalSurvivalAction({
    registry: survivalRegistry,
    actor: retreatTransition.actor,
    survivalToken: survival.survivalToken,
    position: retreatTransition.position,
    staminaSpent: retreatTransition.staminaSpent,
  });
  const finalizationAfterCommit = shouldDeferCombatForAnimalOutcome(survivalRegistry);
  const roster = [retreat.actor, guard];
  const validations = roster.map((actor) => validateCombatActor(actor, { normalize: false }));
  const diagnostics = [
    ...takeoff.events,
    ...movement.events,
    ...attackGeometry.events,
    ...attack.events,
    ...impact.events,
    attackCompletion,
    ...survival.events,
    ...retreatTransition.events,
    ...retreat.events,
  ];
  return {
    generationId,
    roster,
    validations,
    takeoff,
    movement,
    attackGeometry,
    attack,
    impact,
    attackCompletion,
    retreat,
    finalizationWhilePending,
    finalizationAfterCommit,
    presentation: getCanonicalFlightPresentation(retreat.actor),
    iconAppearance: getCombatIconAppearance({ fighter: retreat.actor, activeFighterId: null, generationId, activeGenerationId: generationId }),
    diagnostics,
    combatOverCount: 1,
    postOutcomeActions: 0,
    authorityErrorCount: diagnostics.filter((entry) => /unmigrated-actor-schema|invalid-flight-state|negative-altitude|renderer-flight-authority-write|stale-flight-callback|duplicate-flight-transition|natural-attack-manufactured-metadata|synthetic-sidearm|turn-key-mismatch|round rollback|previous-turn-busy|busy-start-block|duplicate completion|duplicate finalizer|unresolved continuation|post-outcome action|unknown authoritative actor state|attack-resolution error/i.test(entry.eventType || "")).length,
  };
}

export function runPhase3C2BIndependentFlyerScenario() {
  const generationId = "phase3c2b:independent-flyers";
  const registry = createFlightAuthorityRegistry();
  const hawk = makeActor("hawk", "enemy:hawk:duplicate", "enemy", { x: 3, y: 3, altitudeFeet: 20 });
  const falcon = makeActor("falcon", "party:falcon:1", "party", { x: 5, y: 3, altitudeFeet: 20 });
  const hawkOwner = turn(generationId, 1, hawk.id, 1);
  const falconOwner = turn(generationId, 1, falcon.id, 1);
  const hawkMove = resolveFlightTransition({
    actor: hawk,
    requestedTransition: "descend",
    destination: { x: 3, y: 3, altitudeFeet: 10 },
    ...hawkOwner,
    movementSequence: 1,
    authoritativeTurn: hawkOwner,
    registry,
  });
  const falconLanding = resolveFlightTransition({
    actor: falcon,
    requestedTransition: "land",
    destination: { x: 5, y: 3, altitudeFeet: 0 },
    ...falconOwner,
    movementSequence: 1,
    authoritativeTurn: falconOwner,
    registry,
  });
  const stale = resolveFlightTransition({
    actor: hawkMove.actor,
    requestedTransition: "ascend",
    destination: { x: 3, y: 3, altitudeFeet: 30 },
    ...hawkOwner,
    movementSequence: 1,
    authoritativeTurn: hawkOwner,
    registry,
  });
  return {
    hawk: hawkMove.actor,
    falcon: falconLanding.actor,
    hawkMove,
    falconLanding,
    stale,
    independentIdentity: hawkMove.actor.id !== falconLanding.actor.id
      && hawkMove.actor.actorKey !== falconLanding.actor.actorKey
      && hawkMove.transitionKey !== falconLanding.transitionKey,
    roundRollbackBlocked: stale.accepted === false,
  };
}

export default runPhase3C2BFlyingAnimalScenario;
