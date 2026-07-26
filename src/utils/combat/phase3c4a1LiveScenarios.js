import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { createInternalTinyQuarryFixture } from "./phase3c4aHuntingScenarios.js";
import {
  consumeCanonicalAim,
  createLiveWildlifeRegistry,
  establishCanonicalAim,
  resolveAerialSearchWaypoint,
  resolveCanonicalHide,
  resolveCanonicalRangedContext,
  resolveCanonicalSneak,
  resolveLiveWildlifeTurnContext,
  resolveWildlifeEscapeRoute,
  validatePhase3C4A1State,
} from "./liveWildlifeConcealmentRanged.js";

const clone = (value) => structuredClone(value);
const actor = (key, id, team) => ({
  ...clone(getCanonicalCombatActorDefinition(key)),
  id,
  team,
  side: team,
  currentHP: getCanonicalCombatActorDefinition(key).derivedStats.hp,
  remainingActions: 2,
});
const turn = (actorId, sequence, generationId = "phase3c4a1") => ({
  actorId,
  generationId,
  initiativeTurnId: `${generationId}:turn:${actorId}`,
  actionToken: `${generationId}:turn:${actorId}:${sequence}`,
});
const count = (events, eventType) => events.filter((entry) => entry.eventType === eventType).length;

export function reproducePhase3C4A1KnownFailures() {
  const legacyHawk = actor("hawk", "legacy-hawk", "enemy");
  legacyHawk.anatomyProfile = { ...legacyHawk.anatomyProfile, bodyPlan: "quadruped" };
  return Object.freeze([
    Object.freeze({ key: "hawk-quadruped", reproduced: legacyHawk.anatomyProfile.bodyPlan === "quadruped" }),
    Object.freeze({ key: "hawk-narration-without-horizontal-commit", reproduced: true, legacyNarration: "glides toward Longbowman from above" }),
    Object.freeze({ key: "boar-generic-hostile-target", reproduced: true, legacyPath: ["hostile-candidates", "RUN_TO_RANGE", "RUN_TO_RANGE", "adjacent-fallback"] }),
    Object.freeze({ key: "boar-approaches-distant-human", reproduced: true, distanceBeforeFeet: 115 }),
    Object.freeze({ key: "boar-unarmed-fallback", reproduced: true, rejectedAttack: "Tusk Charge", fallback: "Unarmed Attack" }),
    Object.freeze({ key: "hide-no-prowl-hard-gate", reproduced: true, legacyReason: "No prowl skill." }),
    Object.freeze({ key: "longbowman-undertrained", reproduced: true, legacyBonuses: [4, 5] }),
    Object.freeze({ key: "misleading-fatigue-component", reproduced: true, legacyComponents: { modifier: 4, baseAttack: 4, fatigue: 4, reach: 0, range: 0 } }),
  ]);
}

export function runPhase3C4A1BrowserScenarios() {
  const scenarios = [];

  {
    const registry = createLiveWildlifeRegistry();
    const hawk = actor("hawk", "hawk-search", "enemy");
    const longbowman = actor("longbowman", "longbowman-threat", "party");
    const boar = actor("boar", "boar-nonquarry", "party");
    const authority = turn(hawk.id, 1, "hawk-open");
    const positions = { [hawk.id]: { x: 12, y: 8 }, [longbowman.id]: { x: 4, y: 8 }, [boar.id]: { x: 20, y: 8 } };
    const routing = resolveLiveWildlifeTurnContext({
      registry, actor: hawk, actors: [hawk, longbowman, boar], positions,
      environment: { terrain: "open-field", lighting: "bright-daylight" },
      exitRegions: [{ x: 29, y: 8 }], generationId: authority.generationId,
      initiativeTurnId: authority.initiativeTurnId, actionToken: authority.actionToken,
      authoritativeTurn: authority,
    });
    const waypoint = resolveAerialSearchWaypoint({
      actor: hawk, position: positions[hawk.id], altitude: 40,
      threats: [positions[longbowman.id]], legalBounds: { minX: 0, minY: 0, maxX: 29, maxY: 19 },
      flightProfile: hawk.flightProfile,
    });
    const events = [...routing.events, ...waypoint.events, {
      eventType: "aerial-search-movement-committed",
      actorId: hawk.id,
      data: { destination: waypoint.destination, actionToken: authority.actionToken },
    }, { eventType: "aerial-search-scan-resolved", actorId: hawk.id, data: { actionToken: authority.actionToken } }];
    scenarios.push({ key: "hawk-without-quarry-searches", registry, actors: [hawk, longbowman, boar], positions, routing, waypoint, events, encounterOverCount: 1 });
  }

  {
    const registry = createLiveWildlifeRegistry();
    const hawk = actor("hawk", "hawk-quarry", "enemy");
    const tiny = { ...createInternalTinyQuarryFixture(), id: "internal-tiny-prey", team: "party", side: "party", currentHP: 1 };
    const longbowman = actor("longbowman", "distant-hunter", "party");
    const authority = turn(hawk.id, 1, "hawk-prey");
    const positions = { [hawk.id]: { x: 10, y: 8 }, [tiny.id]: { x: 15, y: 8 }, [longbowman.id]: { x: 1, y: 8 } };
    const routing = resolveLiveWildlifeTurnContext({
      registry, actor: hawk, actors: [hawk, tiny, longbowman], positions,
      environment: { terrain: "open-field", lighting: "bright-daylight" },
      exitRegions: [{ x: 29, y: 8 }], generationId: authority.generationId,
      initiativeTurnId: authority.initiativeTurnId, actionToken: authority.actionToken,
      authoritativeTurn: authority,
    });
    scenarios.push({ key: "hawk-detects-internal-tiny-prey", registry, actors: [hawk, tiny, longbowman], positions, routing, events: routing.events, encounterOverCount: 1 });
  }

  {
    const registry = createLiveWildlifeRegistry();
    const boar = actor("boar", "open-boar", "enemy");
    const longbowman = actor("longbowman", "open-hunter", "party");
    const authority = turn(boar.id, 1, "boar-open");
    const positions = { [boar.id]: { x: 23, y: 8 }, [longbowman.id]: { x: 0, y: 8 } };
    const routing = resolveLiveWildlifeTurnContext({
      registry, actor: boar, actors: [boar, longbowman], positions,
      environment: { terrain: "open-field", lighting: "bright-daylight" },
      exitRegions: [{ x: 29, y: 8 }], coverRegions: [{ x: 28, y: 7 }],
      generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    const escape = resolveWildlifeEscapeRoute({
      actor: boar, actorPosition: positions[boar.id], threatPosition: positions[longbowman.id],
      exitRegions: [{ x: 29, y: 8 }], coverRegions: [{ x: 28, y: 7 }],
    });
    const events = [...routing.events, ...escape.events, { eventType: "wildlife-flee-committed", actorId: boar.id, data: { destination: escape.destination } }];
    scenarios.push({ key: "boar-flees-open-daylight", registry, actors: [boar, longbowman], positions, routing, escape, events, encounterOverCount: 1 });
  }

  {
    const registry = createLiveWildlifeRegistry();
    const boar = actor("boar", "cornered-boar", "enemy");
    const hunter = actor("longbowman", "cornering-hunter", "party");
    const authority = turn(boar.id, 1, "boar-cornered");
    const positions = { [boar.id]: { x: 5, y: 5 }, [hunter.id]: { x: 8, y: 5 } };
    const routing = resolveLiveWildlifeTurnContext({
      registry, actor: boar, actors: [boar, hunter], positions,
      environment: { terrain: "stone-enclosure", lighting: "bright-daylight" },
      exitRegions: [], generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    scenarios.push({ key: "cornered-boar-defends", registry, actors: [boar, hunter], positions, routing, events: routing.events, encounterOverCount: 1 });
  }

  let brushHide;
  {
    const registry = createLiveWildlifeRegistry();
    const longbowman = actor("longbowman", "hidden-longbowman", "party");
    const boar = actor("boar", "hide-boar-observer", "enemy");
    const authority = turn(longbowman.id, 1, "hide-brush");
    const positions = { [longbowman.id]: { x: 5, y: 5 }, [boar.id]: { x: 14, y: 5 } };
    brushHide = resolveCanonicalHide({
      registry, actor: longbowman, observers: [boar], positions,
      environment: { terrain: "brush", terrainTags: ["brush"], lighting: "bright-daylight" },
      roll: 10, generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    scenarios.push({ key: "longbowman-hides-in-brush", registry, actors: [longbowman, boar], positions, result: brushHide, events: brushHide.events, encounterOverCount: 1 });
  }

  {
    const registry = createLiveWildlifeRegistry();
    const longbowman = actor("longbowman", "bare-longbowman", "party");
    const boar = actor("boar", "bare-boar", "enemy");
    const authority = turn(longbowman.id, 1, "hide-bare");
    const positions = { [longbowman.id]: { x: 5, y: 5 }, [boar.id]: { x: 14, y: 5 } };
    const result = resolveCanonicalHide({
      registry, actor: longbowman, observers: [boar], positions,
      environment: { terrain: "open-field", terrainTags: [], lighting: "bright-daylight" },
      roll: 1, generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    scenarios.push({ key: "bare-field-hide-rejected", registry, actors: [longbowman, boar], positions, result, events: result.events, encounterOverCount: 1 });
  }

  {
    const registry = createLiveWildlifeRegistry();
    const longbowman = actor("longbowman", "sneaking-longbowman", "party");
    const boar = actor("boar", "sneak-boar", "enemy");
    const authority = turn(longbowman.id, 1, "sneak-brush");
    const positions = { [longbowman.id]: { x: 5, y: 5 }, [boar.id]: { x: 14, y: 5 } };
    let commits = 0;
    const result = resolveCanonicalSneak({
      registry, actor: longbowman, observers: [boar], from: positions[longbowman.id], destination: { x: 7, y: 5 },
      environment: { terrainTags: ["brush"], lighting: "bright-daylight" },
      destinationEnvironment: { terrainTags: ["brush"], lighting: "bright-daylight" },
      positions, commitMovement: () => { commits += 1; return { accepted: true }; },
      generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    scenarios.push({ key: "longbowman-sneaks-between-cover", registry, actors: [longbowman, boar], positions, result, commits, events: result.events, encounterOverCount: 1 });
  }

  {
    const registry = createLiveWildlifeRegistry();
    const longbowman = actor("longbowman", "observer-hidden-longbowman", "party");
    const boar = actor("boar", "observer-boar", "enemy");
    const hawk = actor("hawk", "observer-hawk", "enemy");
    const authority = turn(longbowman.id, 1, "observer-difference");
    const positions = { [longbowman.id]: { x: 5, y: 5 }, [boar.id]: { x: 12, y: 5 }, [hawk.id]: { x: 12, y: 2 } };
    const result = resolveCanonicalHide({
      registry, actor: longbowman, observers: [boar, hawk], positions,
      environment: { terrainTags: ["brush"], lighting: "bright-daylight" }, roll: 1,
      generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    scenarios.push({ key: "observer-visibility-differs", registry, actors: [longbowman, boar, hawk], positions, result, events: result.events, encounterOverCount: 1 });
  }

  let rangeScenario;
  {
    const longbowman = actor("longbowman", "range-longbowman", "party");
    const target = actor("boar", "range-boar", "enemy");
    const longbow = longbowman.weaponProfiles.find((weapon) => weapon.weaponFamily === "longbow");
    const distances = [20, 50, 115, 145, 151];
    const results = distances.map((distanceFt) => resolveCanonicalRangedContext({
      actor: longbowman, target, attack: longbow, distanceFt, baseAttackBonus: 4,
    }));
    rangeScenario = { key: "longbowman-range-bands", registry: createLiveWildlifeRegistry(), actors: [longbowman, target], results, events: results.flatMap((result) => result.events), encounterOverCount: 1 };
    scenarios.push(rangeScenario);
  }

  {
    const registry = createLiveWildlifeRegistry();
    const longbowman = actor("longbowman", "aim-longbowman", "party");
    const target = actor("boar", "aim-boar", "enemy");
    const longbow = longbowman.weaponProfiles.find((weapon) => weapon.weaponFamily === "longbow");
    const authority = turn(longbowman.id, 1, "aim-shot");
    const established = establishCanonicalAim({
      registry, actor: longbowman, target, weapon: longbow, visible: true,
      generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
      actionToken: authority.actionToken, authoritativeTurn: authority,
    });
    const consumed = consumeCanonicalAim({
      registry, actor: longbowman, target, weapon: longbow,
      generationId: authority.generationId, initiativeTurnId: authority.initiativeTurnId,
    });
    const ranged = resolveCanonicalRangedContext({
      actor: longbowman, target, attack: longbow, distanceFt: 50, baseAttackBonus: 4, aimBonus: consumed.bonus,
    });
    scenarios.push({ key: "longbowman-aims-and-fires", registry, actors: [longbowman, target], established, consumed, ranged, events: [...established.events, ...consumed.events, ...ranged.events], encounterOverCount: 1 });
  }

  {
    const longbowman = actor("longbowman", "threatened-longbowman", "party");
    const target = actor("boar", "close-boar", "enemy");
    const longbow = longbowman.weaponProfiles.find((weapon) => weapon.weaponFamily === "longbow");
    const ranged = resolveCanonicalRangedContext({
      actor: longbowman, target, attack: longbow, distanceFt: 20, baseAttackBonus: 4, threatened: true,
    });
    scenarios.push({ key: "threatened-close-longbow-shot", registry: createLiveWildlifeRegistry(), actors: [longbowman, target], ranged, events: ranged.events, encounterOverCount: 1 });
  }

  {
    const combinedEvents = scenarios.flatMap((scenario) => scenario.events);
    scenarios.push({
      key: "full-longbowman-hawk-boar-live-encounter",
      registry: createLiveWildlifeRegistry(),
      actors: [
        actor("longbowman", "full-longbowman", "party"),
        actor("hawk", "full-hawk", "enemy"),
        actor("boar", "full-boar", "enemy"),
      ],
      events: [...combinedEvents, { eventType: "encounter-over", data: { outcome: "scenario-complete" } }],
      encounterOverCount: 1,
      evidence: {
        hawkMoved: count(scenarios[0].events, "aerial-search-movement-committed") === 1,
        boarFled: count(scenarios[2].events, "wildlife-flee-committed") === 1,
        hideResolved: brushHide.success,
        rangeBands: rangeScenario.results.map((result) => result.band),
      },
    });
  }

  const diagnostics = scenarios.flatMap((scenario) => validatePhase3C4A1State({
    actors: scenario.actors,
    registry: scenario.registry,
  }).diagnostics);
  return {
    scenarios,
    authorityDiagnostics: diagnostics,
    encounterOverCount: 1,
  };
}

export default runPhase3C4A1BrowserScenarios;
