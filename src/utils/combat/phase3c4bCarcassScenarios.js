import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import {
  claimCanonicalCarcassProcessingAction,
  completeCanonicalCarcassProcessingAction,
  completeCanonicalFieldDressing,
  createCanonicalCarcassProcessingRegistry,
  createCanonicalProcessingCarcass,
  establishCanonicalCarcassClaim,
  finalizeCanonicalCarcassProcessing,
  locateCanonicalCarcass,
  recoverCanonicalEmbeddedProjectile,
  recoverProcessingCarcass,
  requestHarvestInventoryTransfer,
  requestRecoveredProjectileInventoryTransfer,
  resolveCarcassHarvestEligibility,
  resolveHarvestYield,
  startCanonicalSpoilageBoundary,
  validateCanonicalCarcassProcessingState,
  CANONICAL_HARVEST_PROFILES,
} from "./canonicalCarcassProcessing.js";
import {
  commitCanonicalHuntingOutcome,
  createCanonicalHuntingEncounter,
  createCanonicalHuntingRegistry,
} from "./canonicalHuntingEncounter.js";
import { runQuarryEscapeScenario } from "./phase3c4aHuntingScenarios.js";

const clone = (value) => structuredClone(value);
const collect = (events, result) => {
  events.push(...(result?.events || []));
  return result;
};
const turn = (actorId, generationId, initiativeTurnId, actionToken) => ({
  actorId, generationId, initiativeTurnId, actionToken,
});
const actor = (actorKey, id, team, position, extra = {}) => normalizeReferenceCombatActor({
  ...clone(getCanonicalCombatActorDefinition(actorKey)),
  id, team, side: team, battleSide: team,
  position: { ...position }, x: position.x, y: position.y,
  remainingActions: 8,
  ...extra,
}, { source: "phase3c4b-browser-importable-scenario" }).normalizedActor;

const claimAction = ({ registry, carcass, processor, generationId, actionKey, sequence }) => {
  const initiativeTurnId = `processing-turn-${sequence}`;
  const actionToken = `processing:${sequence}`;
  return claimCanonicalCarcassProcessingAction({
    registry, carcass, processor, actionKey, generationId, initiativeTurnId, actionToken,
    authoritativeTurn: turn(processor.id, generationId, initiativeTurnId, actionToken),
  });
};

const createRecoveredClaimedCarcass = ({
  actorKey,
  sourceId,
  generationId,
  projectiles = [],
  contaminationTags = [],
  companionLink = null,
  mountLink = null,
}) => {
  const huntingRegistry = createCanonicalHuntingRegistry();
  const processingRegistry = createCanonicalCarcassProcessingRegistry();
  const events = [];
  const hunter = actor("longbowman", `${sourceId}-processor`, "party", { x: 0, y: 0 });
  const sourceActor = actor(actorKey, sourceId, "neutral", { x: 0, y: 0 }, {
    dead: true,
    currentHP: 0,
    deathEventId: `${generationId}:death:${sourceId}`,
  });
  const encounter = collect(events, createCanonicalHuntingEncounter({
    registry: huntingRegistry,
    generationId,
    hunterIds: [hunter.id],
    quarry: [sourceActor],
    initialPhase: "recovery",
  }));
  const huntingOutcome = collect(events, commitCanonicalHuntingOutcome({
    registry: huntingRegistry,
    encounterId: encounter.encounter.encounterId,
    outcome: "clean-kill",
    generationId,
    actionToken: `${generationId}:hunting-final`,
  }));
  const created = collect(events, createCanonicalProcessingCarcass({
    huntingRegistry,
    sourceActor,
    generationId,
    huntingEncounterId: encounter.encounter.encounterId,
    deathEventId: sourceActor.deathEventId,
    deathRound: 1,
    deathPosition: sourceActor.position,
    causeOfDeath: "canonical-impact",
    primaryInjuries: ["torso"],
    contaminationTags,
    embeddedProjectiles: projectiles,
  }));
  const eligibility = collect(events, resolveCarcassHarvestEligibility({
    carcass: created.carcass,
    sourceActor,
    companionLink,
    mountLink,
  }));
  collect(events, locateCanonicalCarcass({
    carcass: created.carcass,
    locatedPosition: sourceActor.position,
    locatorId: hunter.id,
  }));
  collect(events, recoverProcessingCarcass({
    carcass: created.carcass,
    processor: hunter,
    processorPosition: hunter.position,
    actionToken: `${generationId}:recover`,
  }));
  collect(events, establishCanonicalCarcassClaim({
    carcass: created.carcass,
    claimant: hunter,
    claimSource: "hunting-encounter-owner",
  }));
  return {
    huntingRegistry, processingRegistry, events, hunter, sourceActor,
    encounter: huntingOutcome.encounter, carcass: created.carcass, eligibility,
  };
};

const fieldDress = (fixture, sequence = 1) => {
  const { processingRegistry: registry, carcass, hunter, sourceActor } = fixture;
  const claim = collect(fixture.events, claimAction({
    registry, carcass, processor: hunter, generationId: fixture.encounter.generationId,
    actionKey: "field-dress-carcass", sequence,
  }));
  const tool = hunter.weaponProfiles.find((weapon) => /knife|dagger/i.test(weapon.name || weapon.displayName));
  const result = collect(fixture.events, completeCanonicalFieldDressing({
    registry, claim: claim.claim, carcass, processor: hunter, tools: [tool],
    skillContext: { experienced: true },
  }));
  collect(fixture.events, completeCanonicalCarcassProcessingAction({ registry, claim: claim.claim }));
  return { claim, result, tool, sourceActor };
};

const harvest = (fixture, actionKey, sequence) => {
  const { processingRegistry: registry, carcass, hunter } = fixture;
  const claim = collect(fixture.events, claimAction({
    registry, carcass, processor: hunter, generationId: fixture.encounter.generationId,
    actionKey, sequence,
  }));
  const result = collect(fixture.events, resolveHarvestYield({
    registry, claim: claim.claim, carcass,
    harvestProfile: CANONICAL_HARVEST_PROFILES[fixture.sourceActor.actorKey],
    processor: hunter,
    tools: hunter.weaponProfiles,
  }));
  collect(fixture.events, completeCanonicalCarcassProcessingAction({ registry, claim: claim.claim }));
  return { claim, result };
};

export function runRecoveredBoarProcessingScenario() {
  const fixture = createRecoveredClaimedCarcass({
    actorKey: "boar",
    sourceId: "processed-boar",
    generationId: "phase3c4b-boar",
    projectiles: [{
      projectileId: "arrow:boar:1", ammunitionItemKey: "ammunition.arrow",
      sourceActorId: "processed-boar-processor", sourceWeaponId: "weapon.longbow",
      hitLocation: "torso", embedded: true, missed: false, damaged: "unknown",
    }],
  });
  const dressing = fieldDress(fixture, 1);
  const meat = harvest(fixture, "harvest-meat", 2);
  const hide = harvest(fixture, "recover-hide", 3);
  const tusks = harvest(fixture, "recover-tusks", 4);
  const transfer = collect(fixture.events, requestHarvestInventoryTransfer({
    registry: fixture.processingRegistry,
    processor: fixture.hunter,
    recipient: fixture.hunter,
    carcass: fixture.carcass,
    resources: [
      { resourceKey: "meat", quantity: meat.result.resourceResults[0].quantity },
      { resourceKey: "hide", quantity: hide.result.resourceResults[0].quantity },
      { resourceKey: "tusk", quantity: tusks.result.resourceResults[0].quantity },
    ],
    capacity: 12,
    actionToken: "processing:transfer:boar",
    generationId: fixture.encounter.generationId,
  }));
  const spoilage = collect(fixture.events, startCanonicalSpoilageBoundary({
    carcass: fixture.carcass,
    startedAt: 1000,
    environmentClass: "temperate-unknown",
  }));
  const finalization = collect(fixture.events, finalizeCanonicalCarcassProcessing({
    registry: fixture.processingRegistry,
    carcass: fixture.carcass,
    outcome: "partial-transfer-completed",
    actionToken: "processing:final:boar",
  }));
  return {
    key: "recovered-boar",
    ...fixture,
    dressing, meat, hide, tusks, transfer, spoilage, finalization,
    diagnostics: validateCanonicalCarcassProcessingState({
      carcasses: [fixture.carcass], sourceActors: [fixture.sourceActor],
    }).diagnostics,
  };
}

export function runEscapedBoarNoCarcassScenario() {
  const hunting = runQuarryEscapeScenario();
  return {
    key: "escaped-boar",
    hunting,
    encounter: hunting.encounter,
    events: hunting.events,
    carcass: null,
    diagnostics: hunting.diagnostics,
  };
}

export function runBearCapacityScenario() {
  const fixture = createRecoveredClaimedCarcass({
    actorKey: "bear",
    sourceId: "processed-bear",
    generationId: "phase3c4b-bear",
  });
  const dressing = fieldDress(fixture, 1);
  const meat = harvest(fixture, "harvest-meat", 2);
  const transfer = collect(fixture.events, requestHarvestInventoryTransfer({
    registry: fixture.processingRegistry,
    processor: fixture.hunter,
    recipient: fixture.hunter,
    carcass: fixture.carcass,
    resources: [{ resourceKey: "meat", quantity: meat.result.resourceResults[0].quantity }],
    capacity: 5,
    actionToken: "processing:transfer:bear",
    generationId: fixture.encounter.generationId,
  }));
  const finalization = collect(fixture.events, finalizeCanonicalCarcassProcessing({
    registry: fixture.processingRegistry,
    carcass: fixture.carcass,
    outcome: "capacity-limited",
    actionToken: "processing:final:bear",
  }));
  return {
    key: "bear-capacity",
    ...fixture,
    dressing, meat, transfer, finalization,
    diagnostics: validateCanonicalCarcassProcessingState({
      carcasses: [fixture.carcass], sourceActors: [fixture.sourceActor],
    }).diagnostics,
  };
}

export function runEmbeddedArrowRecoveryScenario() {
  const fixture = createRecoveredClaimedCarcass({
    actorKey: "boar",
    sourceId: "arrow-boar",
    generationId: "phase3c4b-arrow",
    projectiles: [{
      projectileId: "arrow:embedded:1", ammunitionItemKey: "ammunition.arrow",
      sourceActorId: "arrow-boar-processor", sourceWeaponId: "weapon.longbow",
      hitLocation: "torso", embedded: true, missed: false, damaged: "unknown",
    }, {
      projectileId: "arrow:missed:1", ammunitionItemKey: "ammunition.arrow",
      sourceActorId: "arrow-boar-processor", sourceWeaponId: "weapon.longbow",
      missed: true, landingPosition: { x: 5, y: 5 },
    }],
  });
  const recovered = collect(fixture.events, recoverCanonicalEmbeddedProjectile({
    registry: fixture.processingRegistry,
    carcass: fixture.carcass,
    projectileId: "arrow:embedded:1",
    processor: fixture.hunter,
    actionToken: "processing:arrow:recover",
    condition: "damaged",
  }));
  const transfer = collect(fixture.events, requestRecoveredProjectileInventoryTransfer({
    registry: fixture.processingRegistry,
    carcass: fixture.carcass,
    projectileId: "arrow:embedded:1",
    recipient: fixture.hunter,
    capacity: 10,
    actionToken: "processing:arrow:transfer",
    generationId: fixture.encounter.generationId,
  }));
  const finalization = collect(fixture.events, finalizeCanonicalCarcassProcessing({
    registry: fixture.processingRegistry,
    carcass: fixture.carcass,
    outcome: "projectile-recovered",
    actionToken: "processing:final:arrow",
  }));
  return {
    key: "embedded-arrow",
    ...fixture,
    recovered, transfer, finalization,
    diagnostics: validateCanonicalCarcassProcessingState({
      carcasses: [fixture.carcass], sourceActors: [fixture.sourceActor],
    }).diagnostics,
  };
}

export function runProtectedCompanionCarcassScenario() {
  const fixture = createRecoveredClaimedCarcass({
    actorKey: "hawk",
    sourceId: "protected-hawk",
    generationId: "phase3c4b-protected",
    companionLink: { linkId: "handler:hawk", state: "active" },
  });
  const finalization = collect(fixture.events, finalizeCanonicalCarcassProcessing({
    registry: fixture.processingRegistry,
    carcass: fixture.carcass,
    outcome: "protected-no-processing",
    actionToken: "processing:final:protected",
  }));
  return {
    key: "protected-companion",
    ...fixture,
    finalization,
    diagnostics: validateCanonicalCarcassProcessingState({
      carcasses: [fixture.carcass], sourceActors: [fixture.sourceActor],
    }).diagnostics,
  };
}

export function runPhase3C4BCarcassBrowserScenarios() {
  const scenarios = [
    runRecoveredBoarProcessingScenario(),
    runEscapedBoarNoCarcassScenario(),
    runBearCapacityScenario(),
    runEmbeddedArrowRecoveryScenario(),
    runProtectedCompanionCarcassScenario(),
  ];
  return {
    route: "/combat",
    scenarios,
    authorityDiagnostics: scenarios.flatMap((scenario) => scenario.diagnostics || []),
    processingCompletionCountByScenario: Object.fromEntries(scenarios.map((scenario) => [
      scenario.key,
      scenario.events.filter((entry) => entry.eventType === "carcass-processing-completed").length,
    ])),
  };
}
