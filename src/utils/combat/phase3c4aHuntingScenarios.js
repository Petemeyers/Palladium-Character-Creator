import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import {
  beginCanonicalHuntingPursuit,
  claimCanonicalHuntingAction,
  commitCanonicalHuntingOutcome,
  completeCanonicalCompanionTask,
  completeCanonicalHuntingAction,
  createCanonicalCarcassState,
  createCanonicalHarvestBoundary,
  createCanonicalHuntingEncounter,
  createCanonicalHuntingEnvironment,
  createCanonicalHuntingRegistry,
  establishCanonicalCompanionLink,
  executeCanonicalHuntingShot,
  filterCanonicalWildlifeAIActions,
  issueCanonicalCompanionCommand,
  recoverCanonicalCarcass,
  resolveAnimalThreatAssessment,
  resolveCanonicalStalk,
  resolveCanonicalTracking,
  resolveWildlifeDetection,
  selectCanonicalAnimalIntent,
  selectCanonicalDefensiveAnimalResponse,
  transitionCanonicalHuntingPhase,
  updateCanonicalHuntingPursuit,
  validateCanonicalHuntingState,
  validateCanonicalWildlifeQuarry,
} from "./canonicalHuntingEncounter.js";

const clone = (value) => structuredClone(value);
const turn = (actorId, generationId, initiativeTurnId, actionToken) => ({
  actorId, generationId, initiativeTurnId, actionToken,
});
const collect = (events, result) => {
  events.push(...(result?.events || []));
  return result;
};
const actor = (actorKey, id, team, position, extra = {}) => normalizeReferenceCombatActor({
  ...clone(getCanonicalCombatActorDefinition(actorKey)),
  id, team, side: team, battleSide: team,
  position: { ...position }, x: position.x, y: position.y,
  remainingActions: 8,
  ...extra,
}, { source: "phase3c4a-browser-importable-scenario" }).normalizedActor;

export const INTERNAL_TINY_QUARRY_FIXTURE_KEY = "__phase3c4a_internal_tiny_quarry__";

export function createInternalTinyQuarryFixture(id = "tiny-quarry", position = { x: 20, y: 20 }) {
  return {
    id,
    actorKey: INTERNAL_TINY_QUARRY_FIXTURE_KEY,
    name: "Internal Tiny Quarry",
    source: "internal-deterministic-fixture",
    internalFixture: true,
    selectable: false,
    playable: false,
    team: "neutral",
    side: "neutral",
    creatureType: "animal",
    category: "animal",
    species: "internal-tiny-quarry",
    size: "tiny",
    tags: ["animal", "tiny-prey"],
    currentHP: 2,
    maxHP: 2,
    currentStamina: 4,
    combatStamina: { current: 4, maximum: 4 },
    position: { ...position },
    x: position.x,
    y: position.y,
    wildlifeBehaviorProfile: {
      defaultMotivations: ["forage", "hide", "escape"],
      threatAssessmentProfile: { defaultHunterClassification: "avoid" },
      escapeProfile: { stopPursuitWhenEscapeOpens: true },
    },
    perceptionProfile: {
      sight: "ordinary", lowLightSight: "ordinary", hearing: "strong", scent: "ordinary",
      motionSensitivity: "strong", awarenessDistance: "class-based",
      identificationDistance: "class-based", scentWindDependency: true,
      hearingObstructionDependency: true,
    },
    quarryProfile: { enabled: false },
  };
}

export function runLongbowmanBoarHuntScenario() {
  const registry = createCanonicalHuntingRegistry();
  const events = [];
  const generationId = "phase3c4a-longbow-boar";
  let hunter = actor("longbowman", "hunter-longbowman", "party", { x: 0, y: 0 });
  let boar = actor("boar", "quarry-boar", "neutral", { x: 60, y: 0 });
  const environmentSnapshot = createCanonicalHuntingEnvironment({
    windDirection: "crosswind", visualCover: "partial", groundCover: "woodland",
  });
  collect(events, selectCanonicalAnimalIntent({
    registry, actor: boar, generationId, motivation: "forage", awareness: "unaware",
    escapeGoal: { x: 100, y: 0 }, selectedAtRound: 1, selectedAtTurn: 1,
  }));
  const created = collect(events, createCanonicalHuntingEncounter({
    registry, generationId, hunterIds: [hunter.id], quarry: [boar],
    environmentSnapshot, initialPhase: "sign-found",
  }));
  const encounterId = created.encounter.encounterId;
  collect(events, transitionCanonicalHuntingPhase({
    registry, encounterId, fromPhase: "sign-found", toPhase: "tracking",
    generationId, initiativeTurnId: "hunt-turn-1", actionToken: "hunt:1",
  }));
  const trackClaim = collect(events, claimCanonicalHuntingAction({
    registry, encounterId, hunter, actionKey: "examine-tracks", targetId: boar.id,
    generationId, initiativeTurnId: "hunt-turn-2", actionToken: "hunt:2",
    authoritativeTurn: turn(hunter.id, generationId, "hunt-turn-2", "hunt:2"),
  }));
  collect(events, resolveCanonicalTracking({
    registry, claim: trackClaim.claim, tracker: hunter, quarry: boar, result: "tracks-found",
    trackEvidence: { speciesEstimate: "boar", direction: "east", freshness: "fresh", confidence: "strong", lastKnownPosition: boar.position },
  }));
  collect(events, completeCanonicalHuntingAction({ registry, claim: trackClaim.claim }));
  collect(events, transitionCanonicalHuntingPhase({
    registry, encounterId, fromPhase: "tracking", toPhase: "stalking",
    generationId, initiativeTurnId: "hunt-turn-3", actionToken: "hunt:3",
  }));
  const detection = collect(events, resolveWildlifeDetection({
    registry, observer: boar, subject: hunter, observerPosition: boar.position,
    subjectPosition: hunter.position, terrain: environmentSnapshot, cover: "partial",
    lighting: "ordinary", wind: { direction: "crosswind", scentConditions: "ordinary" },
    movementMode: "walking", noise: "heavy-armor-noise", currentAwareness: "unaware",
    generationId, initiativeTurnId: "boar-turn-1", actionToken: "boar:1",
    authoritativeTurn: turn(boar.id, generationId, "boar-turn-1", "boar:1"),
  }));
  const stalkClaim = collect(events, claimCanonicalHuntingAction({
    registry, encounterId, hunter, actionKey: "stalk", targetId: boar.id,
    generationId, initiativeTurnId: "hunt-turn-4", actionToken: "hunt:4",
    authoritativeTurn: turn(hunter.id, generationId, "hunt-turn-4", "hunt:4"),
  }));
  const stalk = collect(events, resolveCanonicalStalk({
    registry, claim: stalkClaim.claim, hunter, quarry: boar, destination: { x: 20, y: 0 },
    equipmentNoise: "light", detectionResult: detection,
    commitMovement: ({ actor: mover, destination, source }) => ({
      accepted: true,
      actor: { ...mover, position: { ...destination }, x: destination.x, y: destination.y },
      events: [{ eventType: "canonical-movement-committed", actorId: mover.id, data: { source } }],
    }),
  }));
  hunter = stalk.hunter;
  collect(events, completeCanonicalHuntingAction({ registry, claim: stalkClaim.claim }));
  collect(events, transitionCanonicalHuntingPhase({
    registry, encounterId, fromPhase: "stalking", toPhase: "contact",
    generationId, initiativeTurnId: "hunt-turn-5", actionToken: "hunt:5",
  }));
  const shotClaim = collect(events, claimCanonicalHuntingAction({
    registry, encounterId, hunter, actionKey: "take-hunting-shot", targetId: boar.id,
    generationId, initiativeTurnId: "hunt-turn-6", actionToken: "hunt:6",
    authoritativeTurn: turn(hunter.id, generationId, "hunt-turn-6", "hunt:6"),
  }));
  const weapon = hunter.weaponProfiles.find((entry) => entry.weaponFamily === "longbow");
  const shot = collect(events, executeCanonicalHuntingShot({
    registry, claim: shotClaim.claim, hunter, quarry: boar, weapon, distanceFeet: 40,
    authorizeImpact: () => ({ accepted: true, eventType: "injury-authorized" }),
    resolveImpact: ({ attacker, target }) => ({
      attacker, target: {
        ...target, currentHP: target.currentHP - 3,
        conditions: [...(target.conditions || []), { type: "BLEEDING", source: "longbow" }],
      },
      damage: 3, hitLocation: "torso", armorAuthority: "natural-hide", bleeding: true,
    }),
  }));
  hunter = shot.hunter;
  boar = shot.quarry;
  collect(events, completeCanonicalHuntingAction({ registry, claim: shotClaim.claim }));
  const pursuit = collect(events, beginCanonicalHuntingPursuit({
    registry, encounterId, quarry: boar, pursuers: [hunter], generationId,
    initiativeTurnId: "hunt-turn-7", actionToken: "hunt:7",
    lastKnownPosition: boar.position, bloodEvidence: true,
    quarryInjuryState: { bleeding: true, currentHP: boar.currentHP },
  }));
  collect(events, updateCanonicalHuntingPursuit({
    registry, pursuitId: pursuit.pursuitState.pursuitId, generationId,
    initiativeTurnId: "hunt-turn-8", actionToken: "hunt:8", updateSequence: 1,
    lastKnownPosition: { x: 80, y: 0 }, trailConfidence: "strong",
    recovered: true, quarryInjuryState: pursuit.pursuitState.quarryInjuryState,
  }));
  boar = { ...boar, dead: true, currentHP: 0, position: { x: 80, y: 0 } };
  const carcass = collect(events, createCanonicalCarcassState({
    registry, sourceActor: boar, generationId, deathLocation: boar.position,
    causeOfDeath: "canonical-ranged-impact", primaryInjuries: ["torso-injury"],
    projectileIds: ["arrow:hunt:6"],
  }));
  collect(events, recoverCanonicalCarcass({
    registry, carcassId: carcass.carcassState.carcassId,
    claimantId: hunter.id, recoveryPosition: boar.position,
  }));
  collect(events, createCanonicalHarvestBoundary({
    registry, carcassId: carcass.carcassState.carcassId,
    claimantId: hunter.id, sourceActor: boar,
  }));
  const outcome = collect(events, commitCanonicalHuntingOutcome({
    registry, encounterId, outcome: "clean-kill", generationId, actionToken: "hunt:final",
  }));
  return {
    key: "longbowman-boar", registry, events, hunter, boar, shot, pursuit,
    encounter: outcome.encounter, diagnostics: validateCanonicalHuntingState({ registry, actors: [hunter, boar] }).diagnostics,
  };
}

export function runTrainedHawkHuntScenario() {
  const registry = createCanonicalHuntingRegistry();
  const events = [];
  const generationId = "phase3c4a-hawk";
  const handler = actor("longbowman", "hawk-handler", "party", { x: 0, y: 0 });
  const hawk = actor("hawk", "trained-hawk", "party", { x: 0, y: 0 });
  const quarry = createInternalTinyQuarryFixture("hawk-quarry", { x: 30, y: 10 });
  collect(events, selectCanonicalAnimalIntent({
    registry, actor: hawk, generationId, motivation: "follow-command", awareness: "alerted",
    handlerId: handler.id, currentCommand: "release-raptor", selectedAtRound: 1, selectedAtTurn: 1,
  }));
  const created = collect(events, createCanonicalHuntingEncounter({
    registry, generationId, hunterIds: [handler.id], companionIds: [hawk.id],
    quarry: [quarry], initialPhase: "contact",
  }));
  const link = collect(events, establishCanonicalCompanionLink({
    registry, companion: hawk, handler, companionType: "hunting-raptor",
    generationId, initiativeTurnId: "handler-turn-1", actionToken: "handler:1",
    authoritativeTurn: turn(handler.id, generationId, "handler-turn-1", "handler:1"),
  }));
  const quarryValidation = validateCanonicalWildlifeQuarry({ predator: hawk, candidate: quarry });
  const commandResults = [];
  const runCommand = (commandKey, sequence, options = {}) => {
    const commandToken = `handler:${sequence}`;
    const issued = collect(events, issueCanonicalCompanionCommand({
      registry, companionLinkId: link.companionLink.linkId, companion: hawk, handler,
      commandKey, commandToken, generationId, initiativeTurnId: `handler-turn-${sequence}`,
      quarry: options.quarry || null, quarryState: options.quarryState || null,
      companionState: options.companionState || "available", pressure: options.pressure || false,
      resolveExistingControl: options.resolveExistingControl,
    }));
    if (!issued.accepted || issued.outcome !== "accepted") return issued;
    const completed = collect(events, completeCanonicalCompanionTask({
      registry, task: issued.task, companion: hawk, generationId,
      initiativeTurnId: `hawk-turn-${sequence}`, commandToken,
      movementResult: options.movementResult || null,
      controlRecord: options.controlRecord || null,
      releaseQuarry: options.releaseQuarry || null,
    }));
    commandResults.push({ issued, completed });
    return completed;
  };
  runCommand("release-raptor", 2);
  runCommand("search-from-above", 3, { companionState: "airborne" });
  runCommand("pursue-quarry", 4, { companionState: "searching", quarry, quarryState: "located" });
  runCommand("hold-quarry", 5, {
    companionState: "holding", quarry, quarryState: "controlled",
    controlRecord: { state: "established" },
  });
  const returned = runCommand("return-to-glove", 6, {
    companionState: "returning",
    movementResult: {
      accepted: true,
      actor: { ...hawk, position: { x: 0, y: 0, altitudeFeet: 0 } },
      events: [{ eventType: "canonical-movement-committed", actorId: hawk.id, data: { source: "companion-return" } }],
    },
  });
  const outcome = collect(events, commitCanonicalHuntingOutcome({
    registry, encounterId: created.encounter.encounterId, outcome: "quarry-captured",
    generationId, actionToken: "hawk:final",
  }));
  return {
    key: "trained-hawk", registry, events, handler, hawk, quarry, link,
    quarryValidation, commandResults, returned, encounter: outcome.encounter,
    diagnostics: validateCanonicalHuntingState({ registry, actors: [handler, hawk, quarry] }).diagnostics,
  };
}

export function runNeutralWolfEncounterScenario() {
  const registry = createCanonicalHuntingRegistry();
  const events = [];
  const generationId = "phase3c4a-wolf";
  const hunter = actor("knight", "armored-hunter", "party", { x: 0, y: 0 });
  const ally = actor("guard", "armored-ally", "party", { x: 2, y: 0 });
  const wolf = actor("wolf", "neutral-wolf", "neutral", { x: 25, y: 0 });
  const intent = collect(events, selectCanonicalAnimalIntent({
    registry, actor: wolf, generationId, motivation: "travel", awareness: "suspicious",
    selectedAtRound: 1, selectedAtTurn: 1,
  }));
  const assessment = collect(events, resolveAnimalThreatAssessment({
    animal: wolf, candidate: hunter, animalIntent: intent.animalIntent, distance: 25,
    candidateSize: "medium", candidateArmor: hunter.equippedArmor,
    candidateGroup: [hunter, ally], escapeRoutes: [{ x: 40, y: 0 }],
  }));
  const actions = filterCanonicalWildlifeAIActions({
    actions: [{ key: "attack" }, { key: "escape" }, { key: "observe" }],
    actor: wolf, animalIntent: intent.animalIntent, threatAssessment: assessment,
    escapeRoutes: [{ x: 40, y: 0 }],
  });
  const created = collect(events, createCanonicalHuntingEncounter({
    registry, generationId, hunterIds: [hunter.id, ally.id], quarry: [wolf], initialPhase: "contact",
  }));
  const outcome = collect(events, commitCanonicalHuntingOutcome({
    registry, encounterId: created.encounter.encounterId, outcome: "hunt-abandoned",
    generationId, actionToken: "wolf:final",
  }));
  return {
    key: "neutral-wolf", registry, events, hunter, ally, wolf, intent, assessment, actions,
    encounter: outcome.encounter, diagnostics: validateCanonicalHuntingState({ registry, actors: [hunter, ally, wolf] }).diagnostics,
  };
}

export function runDefensiveBearEncounterScenario() {
  const registry = createCanonicalHuntingRegistry();
  const events = [];
  const generationId = "phase3c4a-bear";
  const hunter = actor("longbowman", "bear-hunter", "party", { x: 0, y: 0 });
  const bear = actor("bear", "defensive-bear", "neutral", { x: 10, y: 0 });
  const intent = collect(events, selectCanonicalAnimalIntent({
    registry, actor: bear, generationId, motivation: "protect-food", awareness: "located-threat",
    protectedTargetId: "bear-food", threatTargetId: hunter.id, selectedAtRound: 1, selectedAtTurn: 1,
  }));
  const assessment = collect(events, resolveAnimalThreatAssessment({
    animal: bear, candidate: hunter, animalIntent: intent.animalIntent, distance: 10,
    candidateSize: "medium", escapeRoutes: [{ x: 30, y: 0 }], protectedTargets: [hunter.id],
  }));
  const response = collect(events, selectCanonicalDefensiveAnimalResponse({
    animal: bear, animalIntent: intent.animalIntent, threatAssessment: assessment,
    escapeRoutes: [{ x: 30, y: 0 }], response: "threat-display",
  }));
  const created = collect(events, createCanonicalHuntingEncounter({
    registry, generationId, hunterIds: [hunter.id], quarry: [bear], initialPhase: "contact",
  }));
  const outcome = collect(events, commitCanonicalHuntingOutcome({
    registry, encounterId: created.encounter.encounterId, outcome: "hunter-driven-off",
    generationId, actionToken: "bear:final",
  }));
  return {
    key: "defensive-bear", registry, events, hunter, bear, intent, assessment, response,
    encounter: outcome.encounter, diagnostics: validateCanonicalHuntingState({ registry, actors: [hunter, bear] }).diagnostics,
  };
}

export function runQuarryEscapeScenario() {
  const registry = createCanonicalHuntingRegistry();
  const events = [];
  const generationId = "phase3c4a-escape";
  const hunter = actor("longbowman", "escape-hunter", "party", { x: 0, y: 0 });
  const boar = actor("boar", "escaping-boar", "neutral", { x: 40, y: 0 }, {
    currentHP: 5,
    conditions: [{ type: "BLEEDING", source: "prior-authoritative-impact" }],
  });
  collect(events, selectCanonicalAnimalIntent({
    registry, actor: boar, generationId, motivation: "escape", awareness: "located-threat",
    injuryPressure: 4, escapeGoal: { x: 100, y: 0 }, selectedAtRound: 1, selectedAtTurn: 1,
  }));
  const created = collect(events, createCanonicalHuntingEncounter({
    registry, generationId, hunterIds: [hunter.id], quarry: [boar], initialPhase: "engagement",
  }));
  const pursuit = collect(events, beginCanonicalHuntingPursuit({
    registry, encounterId: created.encounter.encounterId, quarry: boar, pursuers: [hunter],
    generationId, initiativeTurnId: "escape-turn-1", actionToken: "escape:1",
    lastKnownPosition: boar.position, bloodEvidence: true,
    quarryInjuryState: { bleeding: true, currentHP: boar.currentHP },
  }));
  collect(events, updateCanonicalHuntingPursuit({
    registry, pursuitId: pursuit.pursuitState.pursuitId, generationId,
    initiativeTurnId: "escape-turn-2", actionToken: "escape:2", updateSequence: 1,
    lostTrail: true, trailConfidence: "lost", quarryInjuryState: pursuit.pursuitState.quarryInjuryState,
  }));
  const outcome = collect(events, commitCanonicalHuntingOutcome({
    registry, encounterId: created.encounter.encounterId, outcome: "quarry-wounded-escaped",
    generationId, actionToken: "escape:final",
  }));
  const stalePursuit = updateCanonicalHuntingPursuit({
    registry, pursuitId: pursuit.pursuitState.pursuitId, generationId,
    initiativeTurnId: "escape-turn-3", actionToken: "escape:3", updateSequence: 2,
  });
  const postOutcomeAction = claimCanonicalHuntingAction({
    registry, encounterId: created.encounter.encounterId, hunter,
    actionKey: "take-hunting-shot", targetId: boar.id, generationId,
    initiativeTurnId: "escape-turn-4", actionToken: "escape:4",
    authoritativeTurn: turn(hunter.id, generationId, "escape-turn-4", "escape:4"),
  });
  return {
    key: "quarry-escape", registry, events, hunter, boar, pursuit, stalePursuit, postOutcomeAction,
    encounter: outcome.encounter, diagnostics: validateCanonicalHuntingState({ registry, actors: [hunter, boar] }).diagnostics,
  };
}

export function runPhase3C4ABrowserScenarios() {
  const scenarios = [
    runLongbowmanBoarHuntScenario(),
    runTrainedHawkHuntScenario(),
    runNeutralWolfEncounterScenario(),
    runDefensiveBearEncounterScenario(),
    runQuarryEscapeScenario(),
  ];
  return {
    route: "/combat",
    scenarios,
    authorityDiagnostics: scenarios.flatMap((scenario) => scenario.diagnostics),
    encounterOverCountByScenario: Object.fromEntries(scenarios.map((scenario) => [
      scenario.key,
      scenario.events.filter((entry) => entry.eventType === "encounter-over").length,
    ])),
  };
}
