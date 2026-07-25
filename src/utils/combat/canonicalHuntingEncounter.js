import {
  claimCanonicalAmmunitionSpend,
  commitCanonicalAmmunitionSpend,
  validateCanonicalRangedAttack,
} from "./canonicalRangedCombat.js";

const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value) => String(value ?? "").trim().toLowerCase();
const freeze = (value) => Object.freeze({ ...value });
const point = (value = {}) => freeze({
  x: finite(value.position?.x ?? value.x),
  y: finite(value.position?.y ?? value.y),
  altitudeFeet: Math.max(0, finite(value.flightState?.altitudeFeet ?? value.position?.altitudeFeet ?? value.altitudeFeet ?? value.altitude)),
});
const terminal = (actor = {}) => Boolean(
  actor.dead || actor.isDead || actor.unconscious || actor.isUnconscious
  || actor.captured || actor.isCaptured || actor.canAct === false,
);
const event = (eventType, record = {}, data = {}) => ({
  eventType,
  actorId: data.actorId ?? record.actorId ?? record.hunterId ?? record.companionId ?? null,
  targetId: data.targetId ?? record.quarryId ?? record.subjectId ?? null,
  data: {
    encounterId: record.encounterId ?? null,
    generationId: record.generationId ?? null,
    initiativeTurnId: record.initiativeTurnId ?? null,
    actionToken: record.actionToken ?? record.commandToken ?? null,
    ...data,
  },
});
const playerEvent = (eventType, message) => ({ eventType, message });
const reject = (reason, record = {}, eventType = "stale-hunting-callback-rejected", data = {}) => ({
  accepted: false,
  reason,
  events: [event(eventType, record, { reason, ...data })],
});
const ordinal = Object.freeze({ none: 0, weak: 1, ordinary: 2, strong: 3, exceptional: 4 });
const sizeRank = Object.freeze({ tiny: 1, small: 2, medium: 3, large: 4, huge: 5, gargantuan: 6 });

export const ANIMAL_MOTIVATIONS = Object.freeze([
  "forage", "rest", "travel", "hunt", "pursue-quarry", "defend-territory",
  "protect-young", "protect-food", "observe", "hide", "escape", "defend-self",
  "follow-command", "hold-quarry", "return-to-handler",
]);
export const ANIMAL_AWARENESS_STATES = Object.freeze([
  "unaware", "suspicious", "alerted", "located-threat", "engaged",
]);
export const HUNTING_PHASES = Object.freeze([
  "search", "sign-found", "tracking", "stalking", "contact", "engagement",
  "pursuit", "recovery", "resolved",
]);
export const HUNTING_OUTCOMES = Object.freeze([
  "clean-kill", "quarry-recovered", "quarry-killed-lost",
  "quarry-wounded-escaped", "quarry-escaped", "quarry-captured",
  "hunt-abandoned", "hunter-driven-off",
]);

const actionContract = (key, label, phases, options = {}) => freeze({
  key,
  label,
  executor: options.executor,
  legalPhases: Object.freeze([...phases]),
  actionCost: options.actionCost ?? 1,
  staminaOwner: options.staminaOwner ?? null,
  tokenRequired: true,
  targetRequired: options.targetRequired === true,
  rollBehavior: options.rollBehavior || "caller-authoritative",
  completionBehavior: options.completionBehavior || "complete-action-then-phase-decision",
  playerVisible: options.playerVisible !== false,
  aiAvailable: options.aiAvailable !== false,
  deferred: options.deferred === true,
});

export const HUNTING_ACTION_CONTRACTS = Object.freeze({
  "search-for-sign": actionContract("search-for-sign", "Search for Sign", ["search"], { executor: "resolveCanonicalTracking" }),
  "examine-tracks": actionContract("examine-tracks", "Examine Tracks", ["sign-found", "tracking"], { executor: "resolveCanonicalTracking", targetRequired: true }),
  "follow-trail": actionContract("follow-trail", "Follow Trail", ["tracking", "pursuit"], { executor: "resolveCanonicalTracking", staminaOwner: "hunter", targetRequired: true }),
  stalk: actionContract("stalk", "Stalk", ["tracking", "stalking", "contact"], { executor: "resolveCanonicalStalk", staminaOwner: "hunter", targetRequired: true }),
  "wait-in-cover": actionContract("wait-in-cover", "Wait in Cover", ["stalking", "contact"], { executor: "resolveCanonicalStalk" }),
  "scan-terrain": actionContract("scan-terrain", "Scan Terrain", ["search", "sign-found", "tracking", "stalking"], { executor: "resolveWildlifeDetection" }),
  listen: actionContract("listen", "Listen", ["search", "sign-found", "tracking", "stalking"], { executor: "resolveWildlifeDetection" }),
  "take-hunting-shot": actionContract("take-hunting-shot", "Take Hunting Shot", ["contact", "engagement"], { executor: "executeCanonicalHuntingShot", staminaOwner: "hunter", targetRequired: true, rollBehavior: "canonical-ranged-authority" }),
  "begin-pursuit": actionContract("begin-pursuit", "Begin Pursuit", ["contact", "engagement", "pursuit"], { executor: "beginCanonicalHuntingPursuit", staminaOwner: "hunter", targetRequired: true }),
  "follow-blood-trail": actionContract("follow-blood-trail", "Follow Blood Trail", ["pursuit"], { executor: "updateCanonicalHuntingPursuit", staminaOwner: "hunter", targetRequired: true }),
  "abandon-hunt": actionContract("abandon-hunt", "Abandon Hunt", HUNTING_PHASES.filter((phase) => phase !== "resolved"), { executor: "commitCanonicalHuntingOutcome" }),
  "recover-quarry": actionContract("recover-quarry", "Recover Quarry", ["recovery"], { executor: "recoverCanonicalCarcass", targetRequired: true }),
  "field-dress-carcass": actionContract("field-dress-carcass", "Field Dress Carcass", ["recovery", "resolved"], { executor: "deferredHarvestBoundary", targetRequired: true, deferred: true, aiAvailable: false }),
  "issue-companion-command": actionContract("issue-companion-command", "Issue Companion Command", ["search", "sign-found", "tracking", "stalking", "contact", "engagement", "pursuit", "recovery"], { executor: "issueCanonicalCompanionCommand", targetRequired: true }),
});

const commandContract = (key, label, options = {}) => freeze({
  key,
  label,
  handlerActionCost: 1,
  companionActionEffect: options.companionActionEffect,
  commandRange: options.commandRange || "profile",
  communicationRequired: true,
  legalCompanionStates: Object.freeze(options.legalCompanionStates || ["available", "perched", "returning", "searching", "pursuing", "holding"]),
  legalQuarryStates: Object.freeze(options.legalQuarryStates || []),
  rollRequirement: options.rollRequirement || "pressure-only",
  completionBehavior: options.completionBehavior || "owned-companion-task",
  aiAvailable: options.aiAvailable !== false,
  playerVisible: options.playerVisible !== false,
});

export const COMPANION_COMMAND_CONTRACTS = Object.freeze({
  "release-raptor": commandContract("release-raptor", "Release Raptor", { companionActionEffect: "released", legalCompanionStates: ["available", "perched"] }),
  "search-from-above": commandContract("search-from-above", "Search from Above", { companionActionEffect: "searching", legalCompanionStates: ["released", "airborne", "perched"] }),
  circle: commandContract("circle", "Circle", { companionActionEffect: "circling", legalCompanionStates: ["released", "airborne", "searching"] }),
  "gain-altitude": commandContract("gain-altitude", "Gain Altitude", { companionActionEffect: "ascending", legalCompanionStates: ["released", "airborne", "searching", "circling"] }),
  "pursue-quarry": commandContract("pursue-quarry", "Pursue Quarry", { companionActionEffect: "pursuing", legalQuarryStates: ["located", "fleeing", "wounded"] }),
  "abort-pursuit": commandContract("abort-pursuit", "Abort Pursuit", { companionActionEffect: "returning", legalCompanionStates: ["pursuing", "searching", "circling"] }),
  "hold-quarry": commandContract("hold-quarry", "Hold Quarry", { companionActionEffect: "holding", legalQuarryStates: ["controlled", "captured"] }),
  "return-to-glove": commandContract("return-to-glove", "Return to Glove", { companionActionEffect: "returning" }),
  "return-to-lure": commandContract("return-to-lure", "Return to Lure", { companionActionEffect: "returning" }),
  perch: commandContract("perch", "Perch", { companionActionEffect: "perched", legalCompanionStates: ["returning", "airborne", "released"] }),
  "release-quarry": commandContract("release-quarry", "Release Quarry", { companionActionEffect: "released-quarry", legalCompanionStates: ["holding", "carrying"], legalQuarryStates: ["controlled", "captured", "carried"] }),
});

export function createCanonicalHuntingRegistry() {
  return {
    encounters: new Map(),
    activeEncounterByActor: new Map(),
    intents: new Map(),
    detections: new Map(),
    completedDetectionKeys: new Set(),
    actionClaims: new Map(),
    completedActionTokens: new Set(),
    phaseTransitionKeys: new Set(),
    pursuits: new Map(),
    completedPursuitIds: new Set(),
    companionLinks: new Map(),
    activeCompanionLinkByCompanion: new Map(),
    commands: new Map(),
    tasks: new Map(),
    completedCommandTokens: new Set(),
    carcasses: new Map(),
    harvests: new Map(),
    committedOutcomeIds: new Set(),
    finalizers: new Set(),
  };
}

export function createCanonicalHuntingEnvironment({
  lighting = "ordinary",
  windDirection = "unknown",
  windStrength = "calm",
  groundCover = "ordinary",
  visualCover = "partial",
  scentConditions = "ordinary",
  noiseConditions = "ordinary",
  terrainTags = [],
} = {}) {
  return freeze({
    lighting, windDirection, windStrength, groundCover, visualCover,
    scentConditions, noiseConditions,
    terrainTags: Object.freeze([...terrainTags]),
    authority: "hunting-environment-snapshot",
  });
}

export function selectCanonicalAnimalIntent({
  registry,
  actor,
  generationId,
  motivation,
  awareness,
  fearPressure = 0,
  aggressionPressure = 0,
  hungerPressure = 0,
  territorialPressure = 0,
  injuryPressure = 0,
  escapeGoal = null,
  protectedTargetId = null,
  quarryTargetId = null,
  threatTargetId = null,
  handlerId = null,
  currentCommand = null,
  selectedAtRound,
  selectedAtTurn,
  source = "wildlife-profile",
} = {}) {
  const actorId = idOf(actor);
  if (!actorId || actor?.creatureType !== "animal" || !actor.wildlifeBehaviorProfile) return reject("animal-intent-profile-required", { actorId, generationId }, "animal-intent-missing");
  if (!ANIMAL_MOTIVATIONS.includes(motivation) || !ANIMAL_AWARENESS_STATES.includes(awareness)) return reject("animal-intent-invalid", { actorId, generationId }, "animal-intent-missing");
  const permitted = actor.wildlifeBehaviorProfile.defaultMotivations || [];
  const contextual = ["pursue-quarry", "defend-territory", "protect-young", "protect-food", "defend-self", "follow-command", "hold-quarry", "return-to-handler"];
  if (!permitted.includes(motivation) && !contextual.includes(motivation)) return reject("animal-motivation-not-profiled", { actorId, generationId }, "animal-intent-missing");
  if (motivation === "follow-command" && (!handlerId || !currentCommand)) return reject("command-without-companion-link", { actorId, generationId }, "command-without-companion-link");
  const intent = freeze({
    actorId, generationId, motivation, awareness,
    fearPressure: finite(fearPressure), aggressionPressure: finite(aggressionPressure),
    hungerPressure: finite(hungerPressure), territorialPressure: finite(territorialPressure),
    injuryPressure: finite(injuryPressure), escapeGoal: escapeGoal ? freeze(escapeGoal) : null,
    protectedTargetId, quarryTargetId, threatTargetId, handlerId, currentCommand,
    selectedAtRound, selectedAtTurn, source, state: "active",
  });
  registry?.intents?.set(actorId, intent);
  return {
    accepted: true,
    animalIntent: intent,
    events: [
      event("animal-intent-selected", intent, { actorId, motivation, awareness }),
      event("animal-awareness-changed", intent, { actorId, awareness }),
    ],
    playerEvents: [playerEvent("wildlife-intent", `${actor.name} is ${motivation.replaceAll("-", " ")} and ${awareness.replaceAll("-", " ")}.`)],
  };
}

const senseCandidate = (sense, strength, accessible) => ({
  sense,
  strength: ordinal[text(strength)] ?? ordinal.ordinary,
  accessible,
});

export function resolveWildlifeDetection({
  registry,
  observer,
  subject,
  observerPosition,
  subjectPosition,
  terrain = {},
  cover = "partial",
  lighting = "ordinary",
  wind = {},
  movementMode = "still",
  noise = "ordinary",
  currentAwareness = "unaware",
  actionToken,
  initiativeTurnId,
  generationId,
  authoritativeTurn = {},
} = {}) {
  const observerId = idOf(observer);
  const subjectId = idOf(subject);
  const record = { actorId: observerId, subjectId, generationId, initiativeTurnId, actionToken };
  const detectionKey = `${generationId}:${initiativeTurnId}:${actionToken}:detection:${observerId}:${subjectId}`;
  if (
    !observerId || !subjectId || !actionToken || !initiativeTurnId || !generationId
    || authoritativeTurn.generationId !== generationId
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || authoritativeTurn.actionToken !== actionToken
    || authoritativeTurn.actorId !== observerId
  ) return reject("stale-detection-callback", record, "stale-detection-callback-rejected");
  if (registry?.detections?.has(detectionKey) || registry?.completedDetectionKeys?.has(detectionKey)) return reject("duplicate-detection", record, "stale-detection-callback-rejected");
  const profile = observer.perceptionProfile;
  if (!profile) return reject("perception-profile-missing", record, "wildlife-detection-rejected");
  const observerPoint = point(observerPosition || observer);
  const subjectPoint = point(subjectPosition || subject);
  const horizontal = Math.hypot(subjectPoint.x - observerPoint.x, subjectPoint.y - observerPoint.y);
  const vertical = Math.abs(subjectPoint.altitudeFeet - observerPoint.altitudeFeet);
  const distance = Math.hypot(horizontal, vertical);
  const visualCover = text(cover || terrain.visualCover);
  const visualAccess = !["total", "blocked", "opaque"].includes(visualCover)
    && !["none", "blackout"].includes(text(lighting));
  const scentAccess = !["blocked", "none"].includes(text(wind.scentAccess || wind.scentConditions || terrain.scentConditions))
    && (!profile.scentWindDependency || text(wind.direction || wind.windDirection) !== "away-blocked");
  const hearingAccess = !["silent", "none"].includes(text(noise))
    && (!profile.hearingObstructionDependency || !["total", "soundproof"].includes(text(terrain.hearingObstruction)));
  const senses = [
    senseCandidate("sight", profile.sight, visualAccess),
    senseCandidate("scent", profile.scent, scentAccess),
    senseCandidate("hearing", profile.hearing, hearingAccess),
  ].filter((entry) => entry.accessible).sort((a, b) => b.strength - a.strength);
  const dominant = senses[0] || { sense: "none", strength: 0 };
  const motionSignal = text(movementMode) !== "still" && text(movementMode) !== "hidden";
  const detected = dominant.strength >= ordinal.ordinary
    && (motionSignal || dominant.sense !== "sight" || currentAwareness !== "unaware" || text(cover) === "none");
  const identified = detected && dominant.strength >= ordinal.strong && visualCover !== "heavy";
  const awarenessResult = identified
    ? "threat-identified"
    : detected
      ? "threat-direction-known"
      : dominant.strength > 0
        ? "suspicious"
        : "remains-unaware";
  const result = freeze({
    detected, identified, awarenessResult, dominantSense: dominant.sense,
    distance, visibility: visualAccess ? visualCover || "open" : "blocked",
    scentAccess, hearingAccess, coverResult: visualCover || "partial",
    reason: detected ? `detected-by-${dominant.sense}` : "insufficient-sensory-access",
  });
  registry?.detections?.set(detectionKey, freeze({ detectionKey, ...record, result, state: "completed" }));
  registry?.completedDetectionKeys?.add(detectionKey);
  return {
    accepted: true,
    ...result,
    events: [
      event("wildlife-detection-requested", record, { observerId, subjectId }),
      event("wildlife-detection-resolved", record, { observerId, subjectId, ...result }),
    ],
  };
}

export function validateCanonicalWildlifeQuarry({ predator, candidate } = {}) {
  const profile = predator?.quarryProfile;
  const record = { actorId: idOf(predator), quarryId: idOf(candidate) };
  if (!profile?.enabled || !idOf(candidate)) return reject("invalid-quarry-target", record, "quarry-target-rejected");
  const armor = candidate.equippedArmor || candidate.wornArmor || candidate.armorProfile?.rigidCoverage;
  const humanoid = text(candidate.creatureType) === "humanoid";
  const candidateTags = new Set([...(candidate.tags || []), ...(candidate.ecologyTags || [])].map(text));
  const excluded = (profile.excludedQuarryTags || []).some((tag) => candidateTags.has(text(tag)));
  const candidateSize = sizeRank[text(candidate.size)] || sizeRank.medium;
  const maximum = sizeRank[text(profile.maximumEngageSize)] || 0;
  const accepted = !excluded
    && candidateSize <= maximum
    && !(armor && humanoid && profile.armoredHumanoidsAreQuarry !== true);
  return accepted
    ? { accepted: true, predator, candidate, profile, events: [event("quarry-target-accepted", record)] }
    : reject(
        armor && humanoid ? "hawk-armored-humanoid-quarry" : "invalid-quarry-target",
        record,
        "quarry-target-rejected",
      );
}

export function resolveAnimalThreatAssessment({
  animal,
  candidate,
  animalIntent,
  distance,
  candidateSize,
  candidateArmor,
  candidateGroup = [],
  injuries = [],
  escapeRoutes = [],
  protectedTargets = [],
} = {}) {
  const profile = animal?.wildlifeBehaviorProfile?.threatAssessmentProfile || {};
  const quarry = validateCanonicalWildlifeQuarry({ predator: animal, candidate });
  const protectedThreat = protectedTargets.some((targetId) => String(targetId) === String(idOf(candidate)))
    || ["protect-young", "protect-food", "defend-territory"].includes(animalIntent?.motivation);
  const cornered = escapeRoutes.length === 0;
  const armoredGroup = Boolean(candidateArmor) && candidateGroup.length > 1;
  let classification = "observe";
  let reason = "profile-observation";
  if (protectedThreat) {
    classification = "territorial-threat";
    reason = "protected-target-threatened";
  } else if (cornered && finite(distance, Infinity) <= 5) {
    classification = "immediate-threat";
    reason = "cornered-close-threat";
  } else if (quarry.accepted) {
    classification = "quarry";
    reason = "explicit-quarry-profile";
  } else if (armoredGroup && profile.avoidArmoredGroups) {
    classification = "avoid";
    reason = "prepared-armored-group";
  } else if (profile.armoredHumanoidsAreThreats && candidateArmor) {
    classification = "avoid";
    reason = "armored-humanoid-threat";
  } else if (escapeRoutes.length && (profile.defaultHunterClassification === "avoid" || injuries.length)) {
    classification = "avoid";
    reason = injuries.length ? "injured-with-escape" : "profile-prefers-escape";
  }
  const responseOptions = classification === "quarry"
    ? ["observe", "pursue-quarry"]
    : classification === "immediate-threat" || classification === "territorial-threat"
      ? ["threat-display", "defend-self", "create-escape-opening"]
      : classification === "avoid"
        ? ["observe", "escape", "hide"]
        : ["observe", "ignore"];
  return {
    accepted: true,
    classification,
    confidence: classification === "observe" ? "ordinary" : "strong",
    responseOptions,
    reason,
    events: [event("wildlife-threat-assessed", { actorId: idOf(animal) }, {
      actorId: idOf(animal), targetId: idOf(candidate), classification, reason,
      candidateSize, candidateArmor: Boolean(candidateArmor),
    })],
  };
}

export function selectCanonicalDefensiveAnimalResponse({
  animal,
  animalIntent,
  threatAssessment,
  escapeRoutes = [],
  response,
} = {}) {
  const actorId = idOf(animal);
  if (
    !actorId || !animalIntent || !threatAssessment?.accepted
    || !threatAssessment.responseOptions?.includes(response)
  ) return reject("defensive-animal-response-illegal", { actorId }, "defensive-animal-response-rejected");
  if (
    response === "defend-self"
    && escapeRoutes.length
    && animal.wildlifeBehaviorProfile?.escapeProfile?.stopPursuitWhenEscapeOpens
    && threatAssessment.classification === "avoid"
  ) return reject("defensive-animal-response-illegal", { actorId }, "defensive-animal-response-rejected");
  return {
    accepted: true,
    response,
    events: [event("defensive-animal-response-selected", { actorId }, {
      actorId,
      response,
      classification: threatAssessment.classification,
      motivation: animalIntent.motivation,
    })],
  };
}

export function createCanonicalHuntingEncounter({
  registry,
  generationId,
  hunterIds = [],
  companionIds = [],
  quarry = [],
  environmentSnapshot = createCanonicalHuntingEnvironment(),
  initialPhase = "search",
  source = "hunting-encounter",
} = {}) {
  const quarryIds = quarry.map(idOf).filter(Boolean);
  if (!generationId || !hunterIds.length || !quarryIds.length || !HUNTING_PHASES.includes(initialPhase)) return reject("hunting-encounter-invalid", { generationId }, "hunting-encounter-rejected");
  if (quarry.some((actor) => actor.creatureType === "animal" && !actor.wildlifeBehaviorProfile)) return reject("animal-intent-missing", { generationId }, "animal-intent-missing");
  const encounterId = `hunting:${generationId}:${[...hunterIds].sort().join(",")}:${[...quarryIds].sort().join(",")}`;
  if (registry.encounters.has(encounterId)) return reject("duplicate-hunting-encounter", { encounterId, generationId }, "duplicate-hunting-phase");
  const encounter = {
    encounterId, generationId, phase: initialPhase,
    hunterIds: Object.freeze([...hunterIds]), companionIds: Object.freeze([...companionIds]),
    quarryIds: Object.freeze([...quarryIds]), quarryAwareness: "unaware",
    quarryIntent: null, environmentSnapshot, trackState: null, stalkState: null,
    engagementState: null, pursuitState: null, recoveryState: null,
    outcome: null, finalizationOwner: "hunting-encounter", state: "active",
    phaseSequence: 0, completionCount: 0,
    source,
  };
  registry.encounters.set(encounterId, encounter);
  [...hunterIds, ...companionIds, ...quarryIds].forEach((actorId) => registry.activeEncounterByActor.set(actorId, encounterId));
  return {
    accepted: true,
    encounter: freeze(encounter),
    events: [event("hunting-encounter-created", encounter, { phase: initialPhase })],
    playerEvents: [playerEvent("hunting-encounter-created", `Hunting encounter begins in the ${initialPhase.replaceAll("-", " ")} phase.`)],
  };
}

export function transitionCanonicalHuntingPhase({
  registry,
  encounterId,
  fromPhase,
  toPhase,
  generationId,
  initiativeTurnId,
  actionToken,
} = {}) {
  const encounter = registry?.encounters?.get(encounterId);
  const record = { ...encounter, initiativeTurnId, actionToken };
  const key = `${encounterId}:${encounter?.phaseSequence + 1}:${fromPhase}:${toPhase}:${actionToken}`;
  if (
    !encounter || encounter.state !== "active" || encounter.generationId !== generationId
    || encounter.phase !== fromPhase || !HUNTING_PHASES.includes(toPhase)
    || !initiativeTurnId || !actionToken || registry.phaseTransitionKeys.has(key)
  ) return reject("duplicate-hunting-phase", record, "duplicate-hunting-phase");
  const allowed = {
    search: ["sign-found", "contact", "resolved"],
    "sign-found": ["tracking", "contact", "resolved"],
    tracking: ["stalking", "contact", "pursuit", "resolved"],
    stalking: ["contact", "pursuit", "resolved"],
    contact: ["engagement", "pursuit", "recovery", "resolved"],
    engagement: ["pursuit", "recovery", "resolved"],
    pursuit: ["contact", "recovery", "resolved"],
    recovery: ["resolved"],
    resolved: [],
  };
  if (!allowed[fromPhase]?.includes(toPhase)) return reject("hunting-phase-transition-illegal", record, "hunting-phase-rejected");
  encounter.phase = toPhase;
  encounter.phaseSequence += 1;
  registry.phaseTransitionKeys.add(key);
  return {
    accepted: true,
    encounter: freeze(encounter),
    events: [event("hunting-phase-changed", record, { fromPhase, toPhase, phaseSequence: encounter.phaseSequence })],
  };
}

export function claimCanonicalHuntingAction({
  registry,
  encounterId,
  hunter,
  actionKey,
  actionToken,
  initiativeTurnId,
  generationId,
  authoritativeTurn = {},
  targetId = null,
  combatActive = true,
} = {}) {
  const encounter = registry?.encounters?.get(encounterId);
  const contract = HUNTING_ACTION_CONTRACTS[actionKey];
  const hunterId = idOf(hunter);
  const record = { encounterId, generationId, initiativeTurnId, actionToken, hunterId, actorId: hunterId, targetId };
  if (
    !encounter || encounter.state !== "active" || !contract || !contract.legalPhases.includes(encounter.phase)
    || combatActive === false || encounter.generationId !== generationId
    || !encounter.hunterIds.includes(hunterId)
    || authoritativeTurn.generationId !== generationId
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || authoritativeTurn.actionToken !== actionToken
    || authoritativeTurn.actorId !== hunterId
    || registry.actionClaims.has(actionToken) || registry.completedActionTokens.has(actionToken)
  ) return reject("stale-hunting-callback", record);
  if (contract.targetRequired && !targetId) return reject("hunting-action-target-required", record, "hunting-action-rejected");
  const claim = {
    ...record, actionKey, state: "claimed", completionCount: 0,
    phase: encounter.phase, actionCost: contract.actionCost,
  };
  registry.actionClaims.set(actionToken, claim);
  return { accepted: true, claim: freeze(claim), events: [event("hunting-action-claimed", claim, { actionKey })] };
}

const liveClaim = (registry, claim, allowedKeys) => {
  const authoritative = registry?.actionClaims?.get(claim?.actionToken);
  if (!authoritative || authoritative.state !== "claimed" || !allowedKeys.includes(authoritative.actionKey)) return null;
  return authoritative;
};

export function completeCanonicalHuntingAction({ registry, claim, status = "completed" } = {}) {
  const authoritative = liveClaim(registry, claim, Object.keys(HUNTING_ACTION_CONTRACTS));
  if (!authoritative || registry.completedActionTokens.has(claim?.actionToken)) return reject("duplicate-completion", claim, "duplicate-completion");
  authoritative.state = status;
  authoritative.completionCount += 1;
  registry.completedActionTokens.add(authoritative.actionToken);
  return { accepted: true, claim: freeze(authoritative), events: [event("hunting-action-completed", authoritative, { status })] };
}

export function establishCanonicalHuntingContact({
  registry,
  claim,
  hunter,
  quarry,
  contactType = "located",
} = {}) {
  const authoritative = liveClaim(registry, claim, ["scan-terrain", "listen", "stalk", "wait-in-cover"]);
  if (!authoritative || idOf(hunter) !== authoritative.hunterId || idOf(quarry) !== authoritative.targetId) {
    return reject("stale-hunting-callback", claim);
  }
  const encounter = registry.encounters.get(authoritative.encounterId);
  encounter.engagementState = freeze({
    hunterId: idOf(hunter),
    quarryId: idOf(quarry),
    contactType,
    state: "contact-established",
  });
  return {
    accepted: true,
    engagementState: encounter.engagementState,
    events: [event("hunting-contact-established", authoritative, {
      actorId: idOf(hunter),
      targetId: idOf(quarry),
      contactType,
    })],
  };
}

export function resolveCanonicalTracking({
  registry,
  claim,
  tracker,
  quarry,
  result = "tracks-found",
  trackEvidence = {},
} = {}) {
  const authoritative = liveClaim(registry, claim, ["search-for-sign", "examine-tracks", "follow-trail"]);
  if (!authoritative) return reject("stale-hunting-callback", claim);
  const encounter = registry.encounters.get(authoritative.encounterId);
  if (idOf(quarry) !== authoritative.targetId && authoritative.targetId) return reject("tracking-quarry-mismatch", authoritative);
  const previous = encounter.trackState || {};
  const found = ["tracks-found", "trail-followed"].includes(result);
  const lost = result === "trail-lost";
  const trackState = freeze({
    speciesEstimate: found ? (trackEvidence.speciesEstimate || quarry?.species || null) : previous.speciesEstimate || null,
    direction: found ? trackEvidence.direction || previous.direction || null : lost ? null : previous.direction || null,
    ageClass: trackEvidence.ageClass || previous.ageClass || null,
    freshness: trackEvidence.freshness || previous.freshness || null,
    groupSizeEstimate: trackEvidence.groupSizeEstimate ?? previous.groupSizeEstimate ?? null,
    injuryEvidence: trackEvidence.injuryEvidence ?? previous.injuryEvidence ?? false,
    confidence: lost ? "lost" : trackEvidence.confidence || (found ? "ordinary" : "none"),
    lastKnownPosition: found && trackEvidence.lastKnownPosition ? point(trackEvidence.lastKnownPosition) : previous.lastKnownPosition || null,
    lostAtPosition: lost ? point(tracker) : null,
    trailOwnerId: idOf(quarry),
    state: lost ? "lost" : found ? "active" : "no-usable-sign",
  });
  encounter.trackState = trackState;
  return {
    accepted: true,
    trackState,
    events: [
      event(result === "tracks-found" ? "tracks-located" : result === "trail-followed" ? "trail-followed" : "trail-lost", authoritative, {
        actorId: idOf(tracker), targetId: idOf(quarry), trackState,
      }),
    ],
  };
}

export function resolveCanonicalStalk({
  registry,
  claim,
  hunter,
  quarry,
  destination,
  equipmentNoise = "ordinary",
  commitMovement = () => ({ accepted: false, reason: "canonical-movement-required" }),
  detectionResult = null,
} = {}) {
  const authoritative = liveClaim(registry, claim, ["stalk", "wait-in-cover"]);
  if (!authoritative) return reject("stale-hunting-callback", claim);
  const encounter = registry.encounters.get(authoritative.encounterId);
  const movement = authoritative.actionKey === "wait-in-cover"
    ? { accepted: true, actor: hunter, position: point(hunter), events: [] }
    : commitMovement({
        actor: hunter, destination, actionToken: authoritative.actionToken,
        initiativeTurnId: authoritative.initiativeTurnId, generationId: authoritative.generationId,
        source: "hunting-stalk",
      });
  if (!movement.accepted) return reject(movement.reason || "stalking-movement-rejected", authoritative, "stalking-resolved");
  const detected = detectionResult?.detected === true;
  const stalkState = freeze({
    hunterId: idOf(hunter), quarryId: idOf(quarry), destination: point(movement.actor || destination),
    equipmentNoise, quarryAlerted: detected, state: detected ? "failed-alerted" : "concealed",
  });
  encounter.stalkState = stalkState;
  encounter.quarryAwareness = detected ? "alerted" : encounter.quarryAwareness;
  return {
    accepted: true,
    hunter: movement.actor || hunter,
    quarry,
    movement,
    stalkState,
    events: [
      event("stalking-started", authoritative, { actorId: idOf(hunter), targetId: idOf(quarry), equipmentNoise }),
      ...(movement.events || []),
      event("stalking-resolved", authoritative, { actorId: idOf(hunter), targetId: idOf(quarry), state: stalkState.state }),
    ],
  };
}

export function executeCanonicalHuntingShot({
  registry,
  claim,
  hunter,
  quarry,
  weapon,
  distanceFeet,
  lineOfSight = true,
  obstruction = false,
  cover = null,
  authorizeImpact = () => ({ accepted: true }),
  resolveImpact = ({ attacker, target }) => ({ attacker, target, damage: 0 }),
} = {}) {
  const authoritative = liveClaim(registry, claim, ["take-hunting-shot"]);
  if (!authoritative) return reject("stale-hunting-callback", claim);
  if (idOf(hunter) !== authoritative.hunterId || idOf(quarry) !== authoritative.targetId) return reject("hunting-shot-identity-mismatch", authoritative);
  const validation = validateCanonicalRangedAttack({
    actor: hunter, target: quarry, weaponProfile: weapon, ammunitionState: hunter.ammunitionState,
    actionToken: authoritative.actionToken, activeActionToken: authoritative.actionToken,
    distanceFeet, lineOfSight, obstruction, cover,
  });
  if (!validation.accepted) return { ...validation, events: [event("hunting-shot-rejected", authoritative, { reason: validation.reason })] };
  const ammunitionClaim = claimCanonicalAmmunitionSpend({
    ammunitionState: hunter.ammunitionState, weaponProfile: weapon,
    actionToken: authoritative.actionToken, activeActionToken: authoritative.actionToken,
  });
  if (!ammunitionClaim.accepted) return ammunitionClaim;
  const ammunition = commitCanonicalAmmunitionSpend({
    ammunitionState: hunter.ammunitionState, weaponProfile: weapon, claim: ammunitionClaim.claim,
  });
  if (!ammunition.accepted) return ammunition;
  const attacker = { ...hunter, ammunitionState: ammunition.ammunitionState };
  const authorization = authorizeImpact({
    attacker, target: quarry, weapon, actionToken: authoritative.actionToken,
    executionKey: authoritative.actionToken, source: "canonical-hunting-shot",
    huntingEncounterId: authoritative.encounterId,
  });
  if (authorization?.accepted !== true) return reject(authorization?.reason || "hunting-impact-rejected", authoritative, "hunting-shot-rejected");
  const impact = resolveImpact({
    authorization, attacker, target: quarry, weapon,
    actionToken: authoritative.actionToken, executionKey: authoritative.actionToken,
    source: "canonical-hunting-shot", huntingEncounterId: authoritative.encounterId,
  });
  const encounter = registry.encounters.get(authoritative.encounterId);
  encounter.engagementState = freeze({
    hunterId: idOf(hunter), quarryId: idOf(quarry), actionToken: authoritative.actionToken,
    weaponId: weapon.profileKey || weapon.weaponId, ammunitionSpent: ammunitionClaim.claim.amount,
    hitLocation: impact?.hitLocation || null, armorAuthority: impact?.armorAuthority || null,
    injuryAuthorized: authorization.accepted === true, damage: Math.max(0, finite(impact?.damage)),
    state: "resolved",
  });
  return {
    accepted: true,
    hunter: impact?.attacker || attacker,
    quarry: impact?.target || quarry,
    validation, ammunitionClaim, ammunition, authorization, impact,
    events: [
      event("hunting-shot-entered", authoritative, { actorId: idOf(hunter), targetId: idOf(quarry), weaponId: weapon.profileKey || weapon.weaponId }),
      event("quarry-injury-recorded", authoritative, {
        actorId: idOf(hunter), targetId: idOf(quarry), damage: Math.max(0, finite(impact?.damage)),
        hitLocation: impact?.hitLocation || null, bleeding: impact?.bleeding === true,
      }),
    ],
  };
}

export function beginCanonicalHuntingPursuit({
  registry,
  encounterId,
  quarry,
  pursuers,
  generationId,
  initiativeTurnId,
  actionToken,
  lastKnownPosition,
  bloodEvidence = false,
  quarryInjuryState = null,
} = {}) {
  const encounter = registry?.encounters?.get(encounterId);
  const quarryId = idOf(quarry);
  const pursuitId = `${encounterId}:pursuit:${quarryId}`;
  const record = { encounterId, pursuitId, quarryId, generationId, initiativeTurnId, actionToken };
  if (
    !encounter || encounter.state !== "active" || encounter.generationId !== generationId
    || !encounter.quarryIds.includes(quarryId) || registry.pursuits.has(pursuitId)
    || !pursuers?.length || !actionToken || !initiativeTurnId
  ) return reject("stale-pursuit-callback", record, "stale-pursuit-callback-rejected");
  const pursuitState = {
    pursuitId, encounterId, generationId, initiativeTurnId, actionToken,
    quarryId, pursuerIds: Object.freeze(pursuers.map(idOf)),
    lastKnownPosition: point(lastKnownPosition || quarry),
    trailConfidence: bloodEvidence ? "strong" : "ordinary", bloodEvidence,
    movementEvidence: true, quarrySpeedState: "moving",
    quarryInjuryState, lostTrail: false, recovered: false,
    state: "active", updateSequence: 0,
  };
  registry.pursuits.set(pursuitId, pursuitState);
  encounter.pursuitState = freeze(pursuitState);
  encounter.phase = "pursuit";
  return {
    accepted: true,
    pursuitState: freeze(pursuitState),
    events: [
      event("quarry-flight-started", record, { targetId: quarryId }),
      event("pursuit-started", record, { targetId: quarryId, pursuerIds: pursuitState.pursuerIds, bloodEvidence }),
    ],
  };
}

export function updateCanonicalHuntingPursuit({
  registry,
  pursuitId,
  generationId,
  initiativeTurnId,
  actionToken,
  updateSequence,
  lastKnownPosition,
  trailConfidence,
  lostTrail = false,
  recovered = false,
  quarryInjuryState,
} = {}) {
  const pursuit = registry?.pursuits?.get(pursuitId);
  const record = { ...pursuit, initiativeTurnId, actionToken };
  if (
    !pursuit || pursuit.state !== "active" || pursuit.generationId !== generationId
    || !initiativeTurnId || !actionToken || finite(updateSequence) !== pursuit.updateSequence + 1
  ) return reject("stale-pursuit-callback", record, "stale-pursuit-callback-rejected");
  pursuit.initiativeTurnId = initiativeTurnId;
  pursuit.actionToken = actionToken;
  pursuit.updateSequence = updateSequence;
  pursuit.lastKnownPosition = lostTrail ? pursuit.lastKnownPosition : point(lastKnownPosition || pursuit.lastKnownPosition);
  pursuit.trailConfidence = trailConfidence || pursuit.trailConfidence;
  pursuit.lostTrail = Boolean(lostTrail);
  pursuit.recovered = Boolean(recovered);
  pursuit.quarryInjuryState = quarryInjuryState ?? pursuit.quarryInjuryState;
  pursuit.state = recovered ? "recovered" : lostTrail ? "lost" : "active";
  if (pursuit.state !== "active") registry.completedPursuitIds.add(pursuitId);
  const encounter = registry.encounters.get(pursuit.encounterId);
  encounter.pursuitState = freeze(pursuit);
  return {
    accepted: true,
    pursuitState: freeze(pursuit),
    events: [
      event("pursuit-updated", record, { targetId: pursuit.quarryId, state: pursuit.state, trailConfidence: pursuit.trailConfidence }),
      ...(lostTrail ? [event("trail-lost", record, { targetId: pursuit.quarryId })] : []),
      ...(recovered ? [event("quarry-recovered", record, { targetId: pursuit.quarryId })] : []),
    ],
  };
}

export function establishCanonicalCompanionLink({
  registry,
  companion,
  handler,
  companionType,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn = {},
  commandRange = "profile",
} = {}) {
  const companionId = idOf(companion);
  const handlerId = idOf(handler);
  const record = { companionId, handlerId, generationId, initiativeTurnId, actionToken };
  if (
    !companionId || !handlerId || companionId === handlerId
    || companion.companionProfile?.enabled !== true
    || !companion.companionProfile.companionTypes.includes(companionType)
    || authoritativeTurn.generationId !== generationId
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || authoritativeTurn.actionToken !== actionToken
    || authoritativeTurn.actorId !== handlerId
    || registry.activeCompanionLinkByCompanion.has(companionId)
  ) return reject("command-without-companion-link", record, "companion-link-rejected");
  const linkId = `${generationId}:${handlerId}:${companionId}:companion`;
  const link = {
    linkId, companionId, handlerId, companionType,
    trainingProfile: freeze(companion.companionProfile),
    commandRange,
    communicationMethods: Object.freeze([...companion.companionProfile.communicationMethods]),
    recallMethod: companion.companionProfile.recallMethod,
    trustState: "established", rewardState: "none", currentCommand: null,
    commandOwnerToken: null, initiativeTurnId, generationId, state: "active",
  };
  registry.companionLinks.set(linkId, link);
  registry.activeCompanionLinkByCompanion.set(companionId, linkId);
  return {
    accepted: true,
    companionLink: freeze(link),
    events: [event("companion-link-established", { ...record, actorId: handlerId }, { linkId, companionType })],
  };
}

export function issueCanonicalCompanionCommand({
  registry,
  companionLinkId,
  companion,
  handler,
  commandKey,
  commandToken,
  initiativeTurnId,
  generationId,
  quarry = null,
  companionState = "available",
  quarryState = null,
  communicationAvailable = true,
  pressure = false,
  resolveExistingControl = () => ({ outcome: "accepted", rollMade: false }),
} = {}) {
  const link = registry?.companionLinks?.get(companionLinkId);
  const contract = COMPANION_COMMAND_CONTRACTS[commandKey];
  const record = {
    companionId: idOf(companion), handlerId: idOf(handler), generationId,
    initiativeTurnId, commandToken, actionToken: commandToken,
  };
  if (
    !link || link.state !== "active" || link.companionId !== idOf(companion)
    || link.handlerId !== idOf(handler) || link.generationId !== generationId
    || !contract || !commandToken || !initiativeTurnId || !communicationAvailable
    || !contract.legalCompanionStates.includes(companionState)
    || registry.commands.has(commandToken) || registry.completedCommandTokens.has(commandToken)
  ) return reject("stale-companion-callback", record, "stale-companion-callback-rejected");
  if (contract.legalQuarryStates.length) {
    if (!quarry || !contract.legalQuarryStates.includes(quarryState)) return reject("invalid-quarry-target", record, "companion-command-rejected");
    const quarryValidation = validateCanonicalWildlifeQuarry({ predator: companion, candidate: quarry });
    if (commandKey === "pursue-quarry" && !quarryValidation.accepted) return { ...quarryValidation, events: [event("companion-command-rejected", record, { commandKey, reason: quarryValidation.reason })] };
    if (commandKey === "hold-quarry" && !["controlled", "captured"].includes(quarryState)) return reject("hold-quarry-without-control", record, "companion-command-rejected");
  }
  const requested = event("companion-command-requested", record, { commandKey, targetId: idOf(quarry) });
  const routine = pressure === false;
  const control = routine ? { outcome: "accepted", rollMade: false } : resolveExistingControl({ companion, handler, commandKey, quarry });
  if (control?.outcome !== "accepted") {
    registry.completedCommandTokens.add(commandToken);
    return {
      accepted: true, outcome: "rejected", rollMade: control?.rollMade === true,
      events: [requested, event("companion-command-rejected", record, { commandKey, outcome: control?.outcome || "rejected" })],
    };
  }
  const command = {
    ...record, companionLinkId, commandKey, quarryId: idOf(quarry),
    state: "accepted", completionCount: 0, rollMade: control?.rollMade === true,
  };
  const task = {
    taskId: `${commandToken}:task`, commandToken, companionLinkId,
    companionId: link.companionId, handlerId: link.handlerId,
    quarryId: idOf(quarry), commandKey,
    goal: ["return-to-glove", "return-to-lure"].includes(commandKey) ? point(handler) : null,
    state: contract.companionActionEffect, movementCommitted: false,
  };
  link.currentCommand = commandKey;
  link.commandOwnerToken = commandToken;
  registry.commands.set(commandToken, command);
  registry.tasks.set(task.taskId, task);
  return {
    accepted: true, outcome: "accepted", rollMade: control?.rollMade === true,
    command: freeze(command), task: freeze(task), companionLink: freeze(link),
    events: [
      requested,
      event("companion-command-accepted", record, { commandKey, targetId: idOf(quarry) }),
    ],
  };
}

export function completeCanonicalCompanionTask({
  registry,
  task,
  companion,
  generationId,
  initiativeTurnId,
  commandToken,
  movementResult = null,
  controlRecord = null,
  releaseQuarry = null,
  status = "completed",
} = {}) {
  const authoritative = registry?.tasks?.get(task?.taskId);
  const command = registry?.commands?.get(commandToken);
  const link = command ? registry.companionLinks.get(command.companionLinkId) : null;
  const record = { ...command, initiativeTurnId, actionToken: commandToken };
  if (
    !authoritative || !command || command.state !== "accepted"
    || command.generationId !== generationId || command.commandToken !== commandToken
    || command.companionId !== idOf(companion)
    || registry.completedCommandTokens.has(commandToken)
  ) return reject("stale-companion-callback", record, "stale-companion-callback-rejected");
  if (["return-to-glove", "return-to-lure"].includes(command.commandKey)) {
    if (!movementResult?.accepted) return reject("companion-return-requires-movement", record, "companion-return-teleport");
    authoritative.movementCommitted = true;
  }
  if (command.commandKey === "hold-quarry" && controlRecord?.state !== "established") return reject("hold-quarry-without-control", record, "companion-command-rejected");
  if (command.commandKey === "release-quarry" && typeof releaseQuarry !== "function") return reject("release-quarry-authority-required", record, "companion-command-rejected");
  const release = command.commandKey === "release-quarry"
    ? releaseQuarry({ companion, command: freeze(command), task: freeze(authoritative) })
    : null;
  if (release && release.accepted !== true) return reject(release.reason || "release-quarry-rejected", record, "companion-command-rejected");
  authoritative.state = status;
  command.state = status;
  command.completionCount += 1;
  link.currentCommand = null;
  link.commandOwnerToken = null;
  registry.completedCommandTokens.add(commandToken);
  return {
    accepted: true,
    command: freeze(command), task: freeze(authoritative), companion,
    movementResult, release,
    events: [
      ...(movementResult?.events || []),
      ...(release?.events || []),
      event(status === "canceled" ? "companion-task-canceled" : "companion-task-completed", record, { commandKey: command.commandKey }),
    ],
  };
}

export function cancelCanonicalCompanionTask({ registry, commandToken, reason = "aborted" } = {}) {
  const command = registry?.commands?.get(commandToken);
  const task = command ? registry.tasks.get(`${commandToken}:task`) : null;
  const link = command ? registry.companionLinks.get(command.companionLinkId) : null;
  if (!command || !task || command.state !== "accepted") return reject("stale-companion-callback", command, "stale-companion-callback-rejected");
  command.state = "canceled";
  task.state = "canceled";
  if (link) {
    link.currentCommand = null;
    link.commandOwnerToken = null;
  }
  registry.completedCommandTokens.add(commandToken);
  return { accepted: true, command: freeze(command), task: freeze(task), events: [event("companion-task-canceled", command, { reason })] };
}

export function createCanonicalCarcassState({
  registry,
  sourceActor,
  generationId,
  deathTime = Date.now(),
  deathLocation,
  causeOfDeath = "unknown",
  primaryInjuries = [],
  projectileIds = [],
  recovered = false,
  claimedByActorId = null,
} = {}) {
  const sourceActorId = idOf(sourceActor);
  if (!sourceActorId || sourceActor?.creatureType !== "animal" || !(sourceActor.dead || sourceActor.isDead)) {
    return reject("carcass-source-actor-missing", { generationId, actorId: sourceActorId }, "carcass-source-actor-missing");
  }
  const carcassId = `${generationId}:carcass:${sourceActorId}`;
  if (registry.carcasses.has(carcassId)) return reject("duplicate-carcass", { generationId, actorId: sourceActorId }, "duplicate-completion");
  const carcassState = {
    carcassId, sourceActorId, species: sourceActor.species, size: sourceActor.size,
    deathTime, deathLocation: point(deathLocation || sourceActor), causeOfDeath,
    primaryInjuries: Object.freeze([...primaryInjuries]), contaminationState: "unknown",
    recovered, claimedByActorId, fieldDressed: false,
    harvestEligibility: recovered ? "boundary-available" : "unavailable",
    projectileRecoveryState: freeze({
      projectileIds: Object.freeze([...projectileIds]), embedded: projectileIds.length > 0,
      recoverable: "undetermined", damaged: "undetermined", recoveryPending: projectileIds.length > 0,
    }),
    state: recovered ? "recovered" : "unrecovered",
  };
  registry.carcasses.set(carcassId, carcassState);
  return { accepted: true, carcassState: freeze(carcassState), events: [event("carcass-state-created", { generationId, actorId: sourceActorId }, { carcassId, recovered })] };
}

export function recoverCanonicalCarcass({ registry, carcassId, claimantId, recoveryPosition } = {}) {
  const carcass = registry?.carcasses?.get(carcassId);
  if (!carcass || carcass.state !== "unrecovered" || !claimantId) return reject("carcass-recovery-rejected", { actorId: claimantId }, "harvest-before-recovery");
  carcass.recovered = true;
  carcass.claimedByActorId = claimantId;
  carcass.recoveryPosition = point(recoveryPosition || carcass.deathLocation);
  carcass.harvestEligibility = "boundary-available";
  carcass.state = "recovered";
  return { accepted: true, carcassState: freeze(carcass), events: [event("quarry-recovered", { actorId: claimantId }, { carcassId })] };
}

const resourceTagsFor = (actor = {}) => {
  const tags = ["meat", "hide", "fat", "bones"];
  if (actor.anatomyProfile?.tusksPresent) tags.push("tusks");
  if (actor.anatomyProfile?.wingsPresent) tags.push("feathers");
  return Object.freeze(tags);
};

export function createCanonicalHarvestBoundary({ registry, carcassId, claimantId, sourceActor } = {}) {
  const carcass = registry?.carcasses?.get(carcassId);
  if (!carcass || !carcass.recovered || carcass.claimedByActorId !== claimantId || carcass.state !== "recovered") return reject("harvest-before-recovery", { actorId: claimantId }, "harvest-before-recovery");
  const harvestState = freeze({
    carcassId, claimantId, species: carcass.species, carcassCondition: carcass.contaminationState,
    potentialResources: resourceTagsFor(sourceActor), fieldDressingRequired: true,
    inventoryTransferPending: true, cookingTransferPending: true,
    exactQuantities: null, currencyValues: null, state: "boundary-created",
  });
  registry.harvests.set(carcassId, harvestState);
  carcass.harvestEligibility = "created";
  return { accepted: true, harvestState, events: [event("harvest-eligibility-created", { actorId: claimantId }, { carcassId, potentialResources: harvestState.potentialResources })] };
}

export function commitCanonicalHuntingOutcome({
  registry,
  encounterId,
  outcome,
  generationId,
  actionToken,
  pendingOwnership = {},
} = {}) {
  const encounter = registry?.encounters?.get(encounterId);
  const record = { ...encounter, actionToken };
  const pending = Object.entries(pendingOwnership).filter(([, value]) => Boolean(value)).map(([key]) => key);
  if (pending.length) return { accepted: false, deferred: true, reason: "hunting-ownership-pending", pending, events: [event("hunting-finalization-deferred", record, { pending })] };
  if (
    !encounter || encounter.state !== "active" || encounter.generationId !== generationId
    || !HUNTING_OUTCOMES.includes(outcome) || registry.committedOutcomeIds.has(encounterId)
    || registry.finalizers.has(encounterId)
  ) return reject("duplicate-hunting-outcome", record, "duplicate-hunting-outcome");
  encounter.outcome = outcome;
  encounter.phase = "resolved";
  encounter.state = "resolved";
  encounter.completionCount += 1;
  registry.committedOutcomeIds.add(encounterId);
  registry.finalizers.add(encounterId);
  [...encounter.hunterIds, ...encounter.companionIds, ...encounter.quarryIds].forEach((actorId) => registry.activeEncounterByActor.delete(actorId));
  for (const pursuit of registry.pursuits.values()) {
    if (pursuit.encounterId === encounterId && pursuit.state === "active") {
      pursuit.state = "canceled-outcome";
      registry.completedPursuitIds.add(pursuit.pursuitId);
    }
  }
  return {
    accepted: true,
    encounter: freeze(encounter),
    outcome,
    events: [
      ...(outcome.includes("escaped") ? [event("quarry-escaped", record, { outcome })] : []),
      ...(outcome === "quarry-recovered" || outcome === "clean-kill" ? [event("quarry-recovered", record, { outcome })] : []),
      event("hunting-outcome-committed", record, { outcome }),
      event("encounter-over", record, { outcome, finalizationOwner: "hunting-encounter" }),
    ],
    playerEvents: [playerEvent("hunting-outcome", `The hunt ends: ${outcome.replaceAll("-", " ")}.`)],
  };
}

export function filterCanonicalWildlifeAIActions({
  actions = [],
  actor,
  animalIntent,
  threatAssessment,
  encounter,
  escapeRoutes = [],
} = {}) {
  if (!actor?.wildlifeBehaviorProfile || !animalIntent || encounter?.state === "resolved" || terminal(actor)) return [];
  return actions.filter((action) => {
    const key = action.key || action.id || action.type;
    if (key === "attack" || key === "natural-attack" || key === "charge") {
      return ["immediate-threat", "territorial-threat", "quarry"].includes(threatAssessment?.classification)
        && !(
          animalIntent.motivation === "defend-self"
          && escapeRoutes.length
          && actor.wildlifeBehaviorProfile.escapeProfile?.stopPursuitWhenEscapeOpens
        );
    }
    if (key === "pursue" || key === "begin-pursuit") return animalIntent.motivation === "pursue-quarry" && actor.quarryProfile?.enabled === true;
    if (key === "escape" || key === "hide") return escapeRoutes.length > 0;
    return true;
  });
}

export function getCanonicalHuntingPresentation({ encounter, companionLink = null } = {}) {
  if (!encounter) return { visible: false, reason: "hunting-encounter-missing" };
  return freeze({
    visible: true,
    phase: encounter.phase,
    quarryAwareness: encounter.quarryAwareness,
    trackConfidence: encounter.trackState?.confidence || "none",
    windDirection: encounter.environmentSnapshot?.windDirection || "unknown",
    quarryStatus: encounter.outcome || encounter.pursuitState?.state || "active",
    companionCommand: companionLink?.currentCommand || "none",
    pursuitStatus: encounter.pursuitState?.state || "none",
    outcome: encounter.outcome,
    marker: encounter.phase === "tracking" ? "T" : encounter.phase === "pursuit" ? "Q" : null,
    ariaLabel: `Hunting encounter, phase ${encounter.phase}, quarry awareness ${encounter.quarryAwareness}, track confidence ${encounter.trackState?.confidence || "none"}, pursuit ${encounter.pursuitState?.state || "none"}, outcome ${encounter.outcome || "pending"}`,
  });
}

export function validateCanonicalHuntingState({ registry, actors = [], rendererDetectionWrites = false } = {}) {
  const diagnostics = [];
  const byId = new Map(actors.map((actor) => [idOf(actor), actor]));
  for (const encounter of registry?.encounters?.values?.() || []) {
    if (encounter.state === "active") {
      encounter.quarryIds.forEach((actorId) => {
        const actor = byId.get(actorId);
        if (actor?.creatureType === "animal" && !registry.intents.has(actorId)) diagnostics.push(event("animal-intent-missing", encounter, { actorId }));
      });
    }
    if (encounter.state === "resolved" && encounter.outcome?.includes("escaped")) {
      const escapedCarcass = [...registry.carcasses.values()].find((carcass) => encounter.quarryIds.includes(carcass.sourceActorId));
      if (escapedCarcass) diagnostics.push(event("escaped-quarry-carcass", encounter, { carcassId: escapedCarcass.carcassId }));
    }
    if (encounter.state === "resolved" && [...registry.pursuits.values()].some((pursuit) => pursuit.encounterId === encounter.encounterId && pursuit.state === "active")) diagnostics.push(event("unresolved-hunting-ownership", encounter));
  }
  for (const link of registry?.companionLinks?.values?.() || []) {
    if (!byId.has(link.companionId) || !byId.has(link.handlerId)) diagnostics.push(event("command-without-companion-link", link));
    const companion = byId.get(link.companionId);
    const handler = byId.get(link.handlerId);
    if (companion?.combatStamina && companion.combatStamina === handler?.combatStamina) diagnostics.push(event("companion-handler-stamina-merge", link));
    if (companion?.hpState && companion.hpState === handler?.hpState) diagnostics.push(event("companion-handler-hp-merge", link));
  }
  for (const harvest of registry?.harvests?.values?.() || []) {
    if (!registry.carcasses.get(harvest.carcassId)?.recovered) diagnostics.push(event("harvest-before-recovery", harvest));
  }
  if (rendererDetectionWrites) diagnostics.push(event("wildlife-detection-from-renderer", {}));
  return { valid: diagnostics.length === 0, diagnostics };
}

export default {
  ANIMAL_AWARENESS_STATES,
  ANIMAL_MOTIVATIONS,
  COMPANION_COMMAND_CONTRACTS,
  HUNTING_ACTION_CONTRACTS,
  HUNTING_OUTCOMES,
  HUNTING_PHASES,
  beginCanonicalHuntingPursuit,
  cancelCanonicalCompanionTask,
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
  getCanonicalHuntingPresentation,
  issueCanonicalCompanionCommand,
  recoverCanonicalCarcass,
  resolveAnimalThreatAssessment,
  resolveCanonicalStalk,
  resolveCanonicalTracking,
  resolveWildlifeDetection,
  selectCanonicalDefensiveAnimalResponse,
  selectCanonicalAnimalIntent,
  establishCanonicalHuntingContact,
  transitionCanonicalHuntingPhase,
  updateCanonicalHuntingPursuit,
  validateCanonicalHuntingState,
  validateCanonicalWildlifeQuarry,
};
