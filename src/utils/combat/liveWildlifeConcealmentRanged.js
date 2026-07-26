import {
  resolveAnimalThreatAssessment,
  validateCanonicalWildlifeQuarry,
} from "./canonicalHuntingEncounter.js";
import {
  applyRangedAttackRangeModifierToBonus,
  isExplicitRangedAttack,
} from "../rangedAttackRangeModifier.js";

const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value) => String(value ?? "").trim().toLowerCase();
const freeze = (value) => Object.freeze({ ...value });
const point = (value = {}) => freeze({
  x: finite(value.position?.x ?? value.x),
  y: finite(value.position?.y ?? value.y),
});
const distance = (a, b) => Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y)) * 5;
const event = (eventType, data = {}) => freeze({
  eventType,
  actorId: data.actorId ?? null,
  targetId: data.targetId ?? null,
  data: freeze(data),
});
const reject = (reason, eventType, data = {}) => ({
  accepted: false,
  reason,
  events: [event(eventType, { ...data, reason })],
});
const terminal = (actor) => Boolean(
  actor?.dead || actor?.isDead || actor?.unconscious || actor?.isUnconscious
  || actor?.captured || actor?.isCaptured || actor?.fled || actor?.hasFled
  || finite(actor?.currentHP ?? actor?.hp, 1) <= 0,
);
const authoritative = (turn, actorId, generationId, initiativeTurnId, actionToken) => (
  Boolean(actorId && generationId && initiativeTurnId && actionToken)
  && turn?.actorId === actorId
  && turn?.generationId === generationId
  && turn?.initiativeTurnId === initiativeTurnId
  && turn?.actionToken === actionToken
);
const terrainTags = (environment = {}) => new Set([
  ...(environment.terrainTags || []),
  environment.terrain,
  environment.groundCover,
  environment.visualCover,
].filter(Boolean).map(text));

export const LIVE_WILDLIFE_ACTIONS = Object.freeze({
  "circle-and-scan": freeze({ key: "circle-and-scan", label: "Circle and Scan", actionCost: 1, movement: true }),
  "glide-search-pattern": freeze({ key: "glide-search-pattern", label: "Glide Search Pattern", actionCost: 1, movement: true }),
  "gain-scouting-altitude": freeze({ key: "gain-scouting-altitude", label: "Gain Scouting Altitude", actionCost: 1, movement: true }),
  "hold-altitude": freeze({ key: "hold-altitude", label: "Hold Altitude", actionCost: 1, movement: false }),
  "perch-and-observe": freeze({ key: "perch-and-observe", label: "Perch and Observe", actionCost: 1, movement: true }),
  "avoid-threat": freeze({ key: "avoid-threat", label: "Avoid Threat", actionCost: 1, movement: true }),
  "leave-encounter": freeze({ key: "leave-encounter", label: "Leave Encounter", actionCost: 1, movement: true }),
  "wildlife-flee": freeze({ key: "wildlife-flee", label: "Flee", actionCost: 1, movement: true }),
  "defensive-hold": freeze({ key: "defensive-hold", label: "Defensive Hold", actionCost: 1, movement: false }),
});

export const CONCEALMENT_ACTIONS = Object.freeze({
  hide: freeze({ key: "hide", label: "Hide", actionCost: 1, executor: "resolveCanonicalHide" }),
  sneak: freeze({ key: "sneak", label: "Sneak", actionCost: 1, executor: "resolveCanonicalSneak" }),
  aim: freeze({ key: "aim", label: "Aim", actionCost: 1, executor: "establishCanonicalAim" }),
});

export function createLiveWildlifeRegistry() {
  return {
    contexts: new Map(),
    visibilityByObserver: new Map(),
    actionClaims: new Map(),
    completedActionTokens: new Set(),
    searchSectorsByActor: new Map(),
    aimsByActor: new Map(),
    completedAimTokens: new Set(),
    diagnostics: [],
  };
}

export function createLiveWildlifeContext({
  registry,
  generationId,
  environment = {},
  actors = [],
  forcedAggressionByActorId = {},
  protectedTargets = [],
  exitRegions = [],
  coverRegions = [],
} = {}) {
  const contextId = `live-wildlife:${generationId}`;
  const existing = registry?.contexts?.get(contextId);
  if (existing) return { accepted: true, context: existing, events: [] };
  const context = freeze({
    contextId,
    generationId,
    environmentSnapshot: freeze(environment),
    actorIntentById: freeze({}),
    awarenessByObserver: freeze({}),
    forcedAggressionByActorId: freeze({ ...forcedAggressionByActorId }),
    protectedTargets: Object.freeze([...protectedTargets]),
    exitRegions: Object.freeze([...exitRegions]),
    coverRegions: Object.freeze([...coverRegions]),
    actorIds: Object.freeze(actors.map(idOf).filter(Boolean)),
    state: "active",
  });
  registry?.contexts?.set(contextId, context);
  return {
    accepted: true,
    context,
    events: [event("live-wildlife-context-created", { generationId, contextId })],
  };
}

function classifyHawkCandidate(actor, candidate) {
  const quarry = validateCanonicalWildlifeQuarry({ predator: actor, candidate });
  if (quarry.accepted) return { candidate, classification: "suitable-quarry", quarry };
  const humanoid = ["human", "humanoid"].includes(text(candidate?.creatureType || candidate?.category));
  const candidateSize = text(candidate?.size || "medium");
  const classification = humanoid
    ? "dangerous-threat"
    : ["large", "huge", "gargantuan"].includes(candidateSize)
      ? "large-non-quarry"
      : "neutral-non-quarry";
  return { candidate, classification, quarry };
}

export function resolveLiveWildlifeTurnContext({
  registry,
  actor,
  actors = [],
  positions = {},
  environment = {},
  encounter = null,
  initiativeTurnId,
  generationId,
  actionToken,
  authoritativeTurn = null,
  forcedAggression = false,
  exitRegions = [],
  coverRegions = [],
} = {}) {
  const actorId = idOf(actor);
  if (!actor?.wildlifeBehaviorProfile || actor?.creatureType !== "animal") {
    return {
      governedByWildlifeIntent: false,
      mayEnterGenericAttackRouting: true,
      reason: "actor-not-wildlife-governed",
      events: [event("wildlife-routing-bypassed", { actorId, reason: "actor-not-wildlife-governed" })],
    };
  }
  if (!authoritative(authoritativeTurn, actorId, generationId, initiativeTurnId, actionToken)) {
    return reject("stale-wildlife-callback", "stale-wildlife-callback-rejected", {
      actorId, generationId, initiativeTurnId, actionToken,
    });
  }
  const contextResult = createLiveWildlifeContext({
    registry, generationId, environment, actors, exitRegions, coverRegions,
    forcedAggressionByActorId: forcedAggression ? { [actorId]: true } : {},
  });
  const hostiles = actors.filter((candidate) => (
    idOf(candidate) !== actorId
    && !terminal(candidate)
    && String(candidate?.team ?? candidate?.side) !== String(actor?.team ?? actor?.side)
  ));
  const actorPosition = point(positions[actorId] || actor);
  const candidates = hostiles.map((candidate) => ({
    candidate,
    distance: distance(actorPosition, point(positions[idOf(candidate)] || candidate)),
  }));
  const events = [
    ...contextResult.events,
    event("wildlife-routing-entered", { actorId, generationId, initiativeTurnId, actionToken }),
  ];

  const avianPredator = actor?.anatomyProfile?.bodyPlan === "avian" && actor?.quarryProfile?.enabled;
  if (avianPredator) {
    const classifications = candidates.map(({ candidate }) => classifyHawkCandidate(actor, candidate));
    const legalQuarry = classifications.filter((entry) => entry.quarry.accepted);
    classifications.filter((entry) => !entry.quarry.accepted).forEach((entry) => {
      events.push(event("hawk-quarry-candidate-rejected", {
        actorId, targetId: idOf(entry.candidate), classification: entry.classification,
      }));
    });
    const aggressionAuthorized = Boolean(forcedAggression || legalQuarry.length);
    events.push(event(aggressionAuthorized ? "wildlife-hostility-authorized" : "wildlife-hostility-rejected", {
      actorId,
      targetId: idOf(legalQuarry[0]?.candidate),
      reason: forcedAggression ? "explicit-forced-aggression" : legalQuarry.length ? "legal-quarry" : "no-legal-quarry",
    }));
    events.push(event("wildlife-intent-resolved", {
      actorId,
      intent: legalQuarry.length ? "hunt" : "observe",
      goal: legalQuarry.length ? "pursue-quarry" : "glide-search-pattern",
    }));
    return {
      accepted: true,
      governedByWildlifeIntent: true,
      context: contextResult.context,
      intent: legalQuarry.length ? "hunt" : "observe",
      awareness: "alerted",
      threatAssessments: classifications,
      legalQuarry,
      legalThreatTargets: classifications.filter((entry) => entry.classification.includes("threat")).map((entry) => entry.candidate),
      escapeOptions: exitRegions,
      defensiveOptions: ["avoid-threat", "hold-altitude"],
      idleOptions: ["circle-and-scan", "glide-search-pattern", "hold-altitude", "perch-and-observe", "leave-encounter"],
      selectedGoal: legalQuarry.length ? "pursue-quarry" : "glide-search-pattern",
      mayEnterGenericAttackRouting: aggressionAuthorized,
      reason: aggressionAuthorized ? "legal-wildlife-aggression" : "search-before-generic-targeting",
      events,
    };
  }

  const assessments = candidates.map(({ candidate, distance: candidateDistance }) => resolveAnimalThreatAssessment({
    animal: actor,
    candidate,
    animalIntent: { motivation: forcedAggression ? "defend-self" : "forage" },
    distance: candidateDistance,
    candidateSize: candidate?.size,
    candidateArmor: candidate?.equippedArmor || candidate?.wornArmor,
    escapeRoutes: exitRegions,
    protectedTargets: encounter?.protectedTargets || [],
  }));
  const nearestIndex = candidates.reduce((best, entry, index) => (
    best < 0 || entry.distance < candidates[best].distance ? index : best
  ), -1);
  const nearest = nearestIndex >= 0 ? candidates[nearestIndex] : null;
  const nearestAssessment = nearestIndex >= 0 ? assessments[nearestIndex] : null;
  const cornered = hostiles.length > 0 && exitRegions.length === 0;
  const aggressionAuthorized = Boolean(
    forcedAggression
    || (cornered && nearest && nearest.distance <= 20)
    || ["territorial-threat", "immediate-threat"].includes(nearestAssessment?.classification),
  );
  const selectedGoal = aggressionAuthorized
    ? (nearest?.distance >= 15 ? "defensive-charge" : "defensive-hold")
    : hostiles.length ? "wildlife-flee" : "observe";
  events.push(event(aggressionAuthorized ? "wildlife-hostility-authorized" : "wildlife-hostility-rejected", {
    actorId,
    targetId: idOf(nearest?.candidate),
    reason: forcedAggression ? "explicit-forced-aggression" : aggressionAuthorized ? "cornered-defensive-aggression" : "side-does-not-authorize-aggression",
  }));
  events.push(event("wildlife-intent-resolved", {
    actorId,
    intent: aggressionAuthorized ? "defend-self" : hostiles.length ? "escape" : "forage",
    goal: selectedGoal,
  }));
  if (aggressionAuthorized) events.push(event("wildlife-defensive-state-entered", { actorId, targetId: idOf(nearest?.candidate), selectedGoal }));
  return {
    accepted: true,
    governedByWildlifeIntent: true,
    context: contextResult.context,
    intent: aggressionAuthorized ? "defend-self" : hostiles.length ? "escape" : "forage",
    awareness: hostiles.length ? "located-threat" : "suspicious",
    threatAssessments: assessments,
    legalQuarry: [],
    legalThreatTargets: aggressionAuthorized && nearest ? [nearest.candidate] : [],
    escapeOptions: exitRegions,
    defensiveOptions: ["defensive-charge", "defensive-hold"],
    idleOptions: ["observe", "forage"],
    selectedGoal,
    primaryThreat: nearest?.candidate || null,
    mayEnterGenericAttackRouting: aggressionAuthorized && selectedGoal === "defensive-charge",
    reason: aggressionAuthorized ? "defensive-aggression-authorized" : "escape-before-generic-targeting",
    events,
  };
}

export function resolveAerialSearchWaypoint({
  actor,
  position,
  altitude = 0,
  environment = {},
  previouslySearchedSectors = [],
  threats = [],
  legalBounds = { minX: 0, minY: 0, maxX: 29, maxY: 19 },
  flightProfile = actor?.flightProfile || {},
} = {}) {
  const origin = point(position || actor);
  const candidates = [
    { x: origin.x + 2, y: origin.y + 1, sector: "east" },
    { x: origin.x - 2, y: origin.y + 1, sector: "west" },
    { x: origin.x + 1, y: origin.y - 2, sector: "north" },
    { x: origin.x - 1, y: origin.y + 2, sector: "south" },
  ].filter((candidate) => (
    candidate.x >= legalBounds.minX && candidate.x <= legalBounds.maxX
    && candidate.y >= legalBounds.minY && candidate.y <= legalBounds.maxY
  ));
  const oldSectors = new Set(previouslySearchedSectors);
  candidates.sort((a, b) => {
    const repeatA = oldSectors.has(a.sector) ? 1 : 0;
    const repeatB = oldSectors.has(b.sector) ? 1 : 0;
    if (repeatA !== repeatB) return repeatA - repeatB;
    const threatA = Math.min(...threats.map((threat) => distance(a, point(threat))), Infinity);
    const threatB = Math.min(...threats.map((threat) => distance(b, point(threat))), Infinity);
    return threatB - threatA || a.sector.localeCompare(b.sector);
  });
  const selected = candidates[0];
  if (!selected) return { allowed: false, destination: origin, altitudeFeet: altitude, searchSector: null, path: [], reason: "no-legal-waypoint" };
  const maximum = finite(flightProfile.maximumAltitudeFeet, 100);
  return {
    allowed: true,
    destination: freeze({ x: selected.x, y: selected.y }),
    altitudeFeet: Math.min(maximum, Math.max(5, finite(altitude, 20))),
    searchSector: selected.sector,
    path: Object.freeze([origin, freeze({ x: selected.x, y: selected.y })]),
    reason: environment?.perchingSupport && candidates.length === 0 ? "perch-support" : "expand-visible-search-area",
    events: [event("aerial-search-waypoint-resolved", {
      actorId: idOf(actor), destination: freeze({ x: selected.x, y: selected.y }), searchSector: selected.sector,
    })],
  };
}

export function resolveWildlifeEscapeRoute({
  actor,
  actorPosition,
  threatPosition,
  exitRegions = [],
  coverRegions = [],
  legalBounds = { minX: 0, minY: 0, maxX: 29, maxY: 19 },
} = {}) {
  const origin = point(actorPosition || actor);
  const threat = point(threatPosition);
  const options = [...coverRegions.map((region) => ({ ...point(region), kind: "cover" })), ...exitRegions.map((region) => ({ ...point(region), kind: "exit" }))];
  if (!options.length) {
    const dx = Math.sign(origin.x - threat.x) || 1;
    const dy = Math.sign(origin.y - threat.y);
    options.push({
      x: Math.min(legalBounds.maxX, Math.max(legalBounds.minX, origin.x + dx * 3)),
      y: Math.min(legalBounds.maxY, Math.max(legalBounds.minY, origin.y + dy * 3)),
      kind: "open-escape",
    });
  }
  const currentDistance = distance(origin, threat);
  const legal = options.filter((option) => distance(option, threat) > currentDistance);
  legal.sort((a, b) => (a.kind === "cover" ? -1 : 0) - (b.kind === "cover" ? -1 : 0) || distance(b, threat) - distance(a, threat));
  const selected = legal[0];
  return selected
    ? {
        allowed: true,
        destination: freeze({ x: selected.x, y: selected.y }),
        routeType: selected.kind,
        threatDistanceBefore: currentDistance,
        threatDistanceAfter: distance(selected, threat),
        events: [event("wildlife-escape-route-resolved", { actorId: idOf(actor), routeType: selected.kind })],
      }
    : { allowed: false, reason: "no-escape-route-increases-threat-distance", events: [event("wildlife-escape-route-resolved", { actorId: idOf(actor), allowed: false })] };
}

export function resolveConcealmentAvailability({
  actor,
  position,
  environment = {},
  objects = [],
} = {}) {
  const tags = terrainTags(environment);
  const actorPoint = point(position || actor);
  const sources = [];
  if (["tall-grass", "brush", "dense-brush", "woodland", "fog", "darkness"].some((tag) => tags.has(tag))) {
    sources.push({ type: "terrain", key: [...tags].find((tag) => ["tall-grass", "brush", "dense-brush", "woodland", "fog", "darkness"].includes(tag)) });
  }
  for (const object of objects) {
    const geometry = object?.blocksLineOfSight || object?.providesCover || object?.concealment === true;
    const objectPosition = point(object.position || object);
    if (geometry && distance(actorPoint, objectPosition) <= finite(object.concealmentRadiusFeet, 10)) {
      sources.push({ type: "geometry", key: object.id || object.type || "cover-object" });
    }
  }
  const distraction = Boolean(environment.meaningfulObserverDistraction);
  if (distraction) sources.push({ type: "distraction", key: "observer-distraction" });
  return {
    accepted: true,
    available: sources.length > 0,
    sources: Object.freeze(sources.map(freeze)),
    reason: sources.length ? "concealment-source-present" : "no-concealment-source",
    events: [event("concealment-availability-resolved", { actorId: idOf(actor), available: sources.length > 0, sourceCount: sources.length })],
  };
}

export function resolveObserverVisibility({
  registry,
  observer,
  subject,
  observerPosition,
  subjectPosition,
  environment = {},
  concealment = null,
  hiddenAttempt = null,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
} = {}) {
  const observerId = idOf(observer);
  const subjectId = idOf(subject);
  if (!authoritative(authoritativeTurn, subjectId, generationId, initiativeTurnId, actionToken)) {
    return reject("stale-concealment-callback", "stale-concealment-callback-rejected", {
      actorId: subjectId, targetId: observerId, generationId, initiativeTurnId, actionToken,
    });
  }
  const separation = distance(point(observerPosition || observer), point(subjectPosition || subject));
  const senses = observer?.perceptionProfile || {};
  const exceptionalSight = text(senses.sight) === "exceptional";
  const strongScent = ["strong", "exceptional"].includes(text(senses.scent));
  const strongHearing = ["strong", "exceptional"].includes(text(senses.hearing));
  const hidden = Boolean(hiddenAttempt?.success && concealment?.available);
  const visualDetected = !hidden || exceptionalSight || environment.lighting === "bright-daylight" && concealment.sources?.length === 0;
  const scentDetected = strongScent && environment.scentBlocked !== true;
  const soundDetected = strongHearing && hiddenAttempt?.silent !== true;
  const visible = visualDetected;
  const aware = visible || scentDetected || soundDetected;
  const key = `${observerId}:${subjectId}`;
  const previous = registry?.visibilityByObserver?.get(key);
  const record = freeze({
    observerId, subjectId, visible, aware, visualDetected, scentDetected, soundDetected,
    distanceFt: separation, concealmentSources: concealment?.sources || [], generationId,
  });
  registry?.visibilityByObserver?.set(key, record);
  return {
    accepted: true,
    ...record,
    events: previous?.visible === visible && previous?.aware === aware
      ? []
      : [event("observer-visibility-changed", { actorId: subjectId, targetId: observerId, visible, aware })],
  };
}

const claimAction = ({ registry, actorId, actionToken, actionType, authoritativeTurn, generationId, initiativeTurnId }) => {
  if (!authoritative(authoritativeTurn, actorId, generationId, initiativeTurnId, actionToken)) {
    return reject(`stale-${actionType}-callback`, "stale-concealment-callback-rejected", { actorId, actionToken, actionType });
  }
  if (registry?.actionClaims?.has(actionToken) || registry?.completedActionTokens?.has(actionToken)) {
    return reject(`duplicate-${actionType}`, "duplicate-concealment-action-rejected", { actorId, actionToken, actionType });
  }
  const claim = freeze({ actorId, actionToken, actionType, generationId, initiativeTurnId, state: "claimed" });
  registry?.actionClaims?.set(actionToken, claim);
  return { accepted: true, claim };
};

const completeAction = (registry, claim) => {
  registry?.actionClaims?.delete(claim.actionToken);
  registry?.completedActionTokens?.add(claim.actionToken);
};

export function resolveCanonicalHide({
  registry,
  actor,
  observers = [],
  positions = {},
  environment = {},
  objects = [],
  roll = 50,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
} = {}) {
  const actorId = idOf(actor);
  const requested = event("hide-requested", { actorId, actionToken, generationId, initiativeTurnId });
  const claim = claimAction({ registry, actorId, actionToken, actionType: "hide", authoritativeTurn, generationId, initiativeTurnId });
  if (!claim.accepted) return { ...claim, events: [requested, ...claim.events] };
  const concealment = resolveConcealmentAvailability({ actor, position: positions[actorId], environment, objects });
  if (!concealment.available) {
    completeAction(registry, claim.claim);
    return {
      accepted: false,
      reason: "no-concealment-source",
      actionCompleted: true,
      concealment,
      events: [requested, ...concealment.events, event("hide-rejected", { actorId, actionToken, reason: "no-concealment-source" })],
    };
  }
  const prowl = finite(actor?.skills?.prowl ?? actor?.skills?.Prowl ?? actor?.prowlSkill, 0);
  const dexterity = finite(actor?.abilityScores?.dexterity ?? actor?.attributes?.deftness, 10);
  const awareness = finite(actor?.abilityScores?.wisdom ?? actor?.attributes?.awareness, 10);
  const untrainedBase = 35 + Math.floor((dexterity - 10) / 2) * 5 + Math.floor((awareness - 10) / 2) * 2;
  const coverBonus = Math.min(25, concealment.sources.length * 10);
  const darknessBonus = terrainTags(environment).has("darkness") ? 15 : 0;
  const skillBonus = prowl > 0 ? Math.min(40, prowl) : 0;
  const target = Math.max(5, Math.min(95, untrainedBase + coverBonus + darknessBonus + skillBonus));
  const success = finite(roll, 100) <= target;
  const visibility = observers.map((observer) => resolveObserverVisibility({
    registry,
    observer,
    subject: actor,
    observerPosition: positions[idOf(observer)],
    subjectPosition: positions[actorId],
    environment,
    concealment,
    hiddenAttempt: { success, silent: false },
    generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn,
  }));
  completeAction(registry, claim.claim);
  return {
    accepted: true,
    success,
    actionCompleted: true,
    actionCost: 1,
    trained: prowl > 0,
    target,
    roll: finite(roll),
    concealment,
    visibility,
    actorPatch: {
      concealmentState: freeze({
        state: success ? "concealed" : "revealed",
        sourceKeys: Object.freeze(concealment.sources.map((source) => source.key)),
        observerVisibility: freeze(Object.fromEntries(visibility.map((entry) => [entry.observerId, freeze({ visible: entry.visible, aware: entry.aware })]))),
      }),
      prowlState: freeze({ hidden: success, prowlSuccess: success, roll: finite(roll), total: target, trained: prowl > 0 }),
    },
    events: [
      requested,
      ...concealment.events,
      ...visibility.flatMap((entry) => entry.events),
      event("hide-resolved", { actorId, actionToken, success, trained: prowl > 0, roll: finite(roll), target }),
    ],
  };
}

export function resolveCanonicalSneak({
  registry,
  actor,
  observers = [],
  from,
  destination,
  environment = {},
  destinationEnvironment = environment,
  positions = {},
  movementMode = "sneak",
  commitMovement,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
} = {}) {
  const actorId = idOf(actor);
  const requested = event("sneak-requested", { actorId, actionToken });
  const claim = claimAction({ registry, actorId, actionToken, actionType: "sneak", authoritativeTurn, generationId, initiativeTurnId });
  if (!claim.accepted) return { ...claim, events: [requested, ...claim.events] };
  const startCover = resolveConcealmentAvailability({ actor, position: from, environment });
  const endCover = resolveConcealmentAvailability({ actor, position: destination, environment: destinationEnvironment });
  if (!startCover.available || !endCover.available || movementMode === "run") {
    completeAction(registry, claim.claim);
    return {
      accepted: false,
      reason: movementMode === "run" ? "running-breaks-sneak" : "sneak-without-concealment",
      actionCompleted: true,
      events: [requested, event("sneak-detection-resolved", { actorId, actionToken, concealed: false })],
    };
  }
  const maximumFeet = Math.max(5, finite(actor?.movement?.ground ?? actor?.derivedStats?.movement, 30) / 2);
  if (distance(point(from), point(destination)) > maximumFeet) {
    completeAction(registry, claim.claim);
    return { accepted: false, reason: "sneak-distance-exceeded", actionCompleted: true, events: [requested] };
  }
  const movement = typeof commitMovement === "function"
    ? commitMovement({ actorId, from: point(from), destination: point(destination), actionToken, source: "canonical-sneak" })
    : { accepted: false, reason: "canonical-movement-authority-required" };
  if (movement?.accepted === false) {
    completeAction(registry, claim.claim);
    return { accepted: false, reason: movement.reason, actionCompleted: true, events: [requested] };
  }
  const visibility = observers.map((observer) => resolveObserverVisibility({
    registry, observer, subject: actor, observerPosition: positions[idOf(observer)],
    subjectPosition: destination, environment: destinationEnvironment, concealment: endCover,
    hiddenAttempt: { success: true, silent: true }, generationId, initiativeTurnId, actionToken, authoritativeTurn,
  }));
  completeAction(registry, claim.claim);
  return {
    accepted: true,
    actionCompleted: true,
    actionCost: 1,
    positionCommitted: true,
    concealed: visibility.some((entry) => entry.visible === false),
    visibility,
    events: [
      requested,
      event("sneak-movement-committed", { actorId, actionToken, destination: point(destination) }),
      ...visibility.flatMap((entry) => entry.events),
      event("sneak-detection-resolved", { actorId, actionToken, concealed: visibility.some((entry) => !entry.visible) }),
    ],
  };
}

export function establishCanonicalAim({
  registry,
  actor,
  target,
  weapon,
  visible = true,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
} = {}) {
  const actorId = idOf(actor);
  const targetId = idOf(target);
  const weaponId = weapon?.weaponId || weapon?.profileKey || weapon?.id;
  const requested = event("aim-requested", { actorId, targetId, weaponId, actionToken });
  if (!authoritative(authoritativeTurn, actorId, generationId, initiativeTurnId, actionToken)) {
    return { ...reject("stale-aim-callback", "stale-concealment-callback-rejected", { actorId, targetId, actionToken }), events: [requested, event("aim-canceled", { actorId, targetId, actionToken, reason: "stale-aim-callback" })] };
  }
  if (!visible || !targetId) return { ...reject("aim-target-not-visible", "aim-canceled", { actorId, targetId, actionToken }), events: [requested, event("aim-canceled", { actorId, targetId, actionToken, reason: "aim-target-not-visible" })] };
  if (!weaponId || !isExplicitRangedAttack(weapon) || actor?.rangedTrainingProfile?.aimSupported === false) {
    return { ...reject("aim-weapon-incompatible", "aim-canceled", { actorId, targetId, weaponId, actionToken }), events: [requested, event("aim-canceled", { actorId, targetId, weaponId, actionToken, reason: "aim-weapon-incompatible" })] };
  }
  if (registry?.aimsByActor?.has(actorId)) {
    return { ...reject("duplicate-aim", "aim-canceled", { actorId, targetId, weaponId, actionToken }), events: [requested, event("aim-canceled", { actorId, targetId, weaponId, actionToken, reason: "duplicate-aim" })] };
  }
  const aim = freeze({
    aimToken: `aim:${generationId}:${initiativeTurnId}:${actionToken}:${actorId}`,
    actorId, targetId, weaponId, generationId, initiativeTurnId, actionToken,
    bonus: 2, state: "established",
  });
  registry?.aimsByActor?.set(actorId, aim);
  return {
    accepted: true,
    aim,
    actionCost: 1,
    ammunitionSpent: 0,
    events: [requested, event("aim-established", { ...aim })],
  };
}

export function cancelCanonicalAim({ registry, actorId, reason = "opportunity-ended" } = {}) {
  const aim = registry?.aimsByActor?.get(actorId);
  if (!aim) return { accepted: false, reason: "aim-not-established", events: [] };
  registry.aimsByActor.delete(actorId);
  return { accepted: true, aim, events: [event("aim-canceled", { ...aim, reason })] };
}

export function consumeCanonicalAim({
  registry,
  actor,
  target,
  weapon,
  generationId,
  initiativeTurnId,
} = {}) {
  const actorId = idOf(actor);
  const aim = registry?.aimsByActor?.get(actorId);
  if (!aim) return { accepted: false, reason: "aim-not-established", bonus: 0, events: [] };
  const weaponId = weapon?.weaponId || weapon?.profileKey || weapon?.id;
  const reason = aim.generationId !== generationId || aim.initiativeTurnId !== initiativeTurnId
    ? "stale-aim"
    : aim.targetId !== idOf(target)
      ? "aim-wrong-target"
      : aim.weaponId !== weaponId
        ? "aim-wrong-weapon"
        : null;
  if (reason) return { ...cancelCanonicalAim({ registry, actorId, reason }), accepted: false, reason, bonus: 0 };
  if (registry.completedAimTokens.has(aim.aimToken)) return reject("duplicate-aim-consumption", "aim-canceled", { actorId, aimToken: aim.aimToken });
  registry.aimsByActor.delete(actorId);
  registry.completedAimTokens.add(aim.aimToken);
  return { accepted: true, bonus: aim.bonus, aim, events: [event("aim-consumed", { ...aim })] };
}

export function resolveCanonicalRangedContext({
  actor,
  target,
  attack,
  distanceFt,
  baseAttackBonus = 0,
  threatened = false,
  aimBonus = 0,
  visibilityModifier = 0,
  shooterMovementModifier = 0,
  targetMovementModifier = 0,
  fatigueModifier = 0,
} = {}) {
  const result = applyRangedAttackRangeModifierToBonus({
    actor, attack, distanceFt, baseAttackBonus, threatened, aimBonus,
    visibilityModifier, shooterMovementModifier, targetMovementModifier, fatigueModifier,
  });
  const components = freeze({
    baseAttack: finite(baseAttackBonus),
    proficiency: finite(result.components?.proficiencyApplied),
    specialization: finite(result.components?.specialization),
    range: finite(result.components?.range),
    aim: finite(result.components?.aim),
    visibility: finite(result.components?.visibility),
    threatened: finite(result.components?.threatenedClose),
    shooterMovement: finite(result.components?.shooterMovement),
    targetMovement: finite(result.components?.targetMovement),
    fatigue: Math.min(0, finite(result.components?.fatigue)),
  });
  const componentTotal = Object.values(components).reduce((sum, value) => sum + value, 0);
  const total = result.blocked ? null : componentTotal;
  const auditValid = result.blocked || total === result.modifiedAttackBonus;
  return {
    accepted: !result.blocked,
    ...result,
    targetId: idOf(target),
    components,
    componentTotal,
    total,
    auditValid,
    events: [
      event("ranged-context-resolved", { actorId: idOf(actor), targetId: idOf(target), distanceFt, band: result.band }),
      ...(result.trainingModifier ? [event("ranged-training-applied", { actorId: idOf(actor), weaponFamily: attack?.weaponFamily, specialization: result.trainingModifier })] : []),
      event("range-band-resolved", { actorId: idOf(actor), targetId: idOf(target), band: result.band, rangeModifier: result.rangeModifier }),
      event("ranged-modifier-audit", { actorId: idOf(actor), targetId: idOf(target), components, total, auditValid }),
    ],
    playerSummary: result.blocked
      ? `${attack?.name || "Ranged attack"} is beyond its listed range.`
      : `${result.bandLabel}: ${result.rangeModifier >= 0 ? "+" : ""}${result.rangeModifier}; total attack modifier ${total >= 0 ? "+" : ""}${total}.`,
  };
}

export function validatePhase3C4A1State({
  actors = [],
  registry,
  postOutcomeMovement = false,
  postOutcomeAttack = false,
} = {}) {
  const diagnostics = [];
  for (const actor of actors) {
    if (["hawk", "falcon"].includes(text(actor?.actorKey || actor?.species))) {
      if (actor?.anatomyProfile?.bodyPlan !== "avian") diagnostics.push(event("hawk-quadruped-body-plan", { actorId: idOf(actor) }));
      if (!actor?.anatomyProfile?.wingsPresent || finite(actor?.anatomyProfile?.wingCount) < 2) diagnostics.push(event("avian-wing-anatomy-missing", { actorId: idOf(actor) }));
    }
    if (actor?.concealmentState?.state === "concealed" && !(actor.concealmentState.sourceKeys || []).length) {
      diagnostics.push(event("hidden-without-concealment", { actorId: idOf(actor) }));
    }
  }
  if (postOutcomeMovement) diagnostics.push(event("post-outcome movement"));
  if (postOutcomeAttack) diagnostics.push(event("post-outcome attack"));
  if (registry?.actionClaims?.size) diagnostics.push(event("unresolved-continuation", { count: registry.actionClaims.size }));
  return { valid: diagnostics.length === 0, diagnostics };
}
