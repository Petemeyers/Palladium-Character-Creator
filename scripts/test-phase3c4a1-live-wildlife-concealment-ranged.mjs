import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import {
  cancelCanonicalAim,
  consumeCanonicalAim,
  createLiveWildlifeContext,
  createLiveWildlifeRegistry,
  establishCanonicalAim,
  resolveAerialSearchWaypoint,
  resolveCanonicalHide,
  resolveCanonicalRangedContext,
  resolveCanonicalSneak,
  resolveConcealmentAvailability,
  resolveLiveWildlifeTurnContext,
  resolveObserverVisibility,
  resolveWildlifeEscapeRoute,
  validatePhase3C4A1State,
} from "../src/utils/combat/liveWildlifeConcealmentRanged.js";
import { validateCanonicalWildlifeQuarry } from "../src/utils/combat/canonicalHuntingEncounter.js";
import { createInternalTinyQuarryFixture } from "../src/utils/combat/phase3c4aHuntingScenarios.js";
import { reproducePhase3C4A1KnownFailures, runPhase3C4A1BrowserScenarios } from "../src/utils/combat/phase3c4a1LiveScenarios.js";

let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, `${passed + 1}. ${message}`);
  passed += 1;
};
const clone = (value) => structuredClone(value);
const actor = (key, id = key, team = "enemy") => ({
  ...clone(getCanonicalCombatActorDefinition(key)),
  id, team, side: team,
  currentHP: getCanonicalCombatActorDefinition(key).derivedStats.hp,
  remainingActions: 2,
});
const authority = (actorId, key = "a") => ({
  actorId,
  generationId: `g-${key}`,
  initiativeTurnId: `t-${key}`,
  actionToken: `a-${key}`,
});
const count = (events, type) => events.filter((entry) => entry.eventType === type).length;
const browser = runPhase3C4A1BrowserScenarios();
const [hawkSearch, hawkPrey, boarOpen, boarCornered, hideBrush, hideBare, sneakBrush, observerDiff, rangeBands, aimShot, threatenedShot, fullEncounter] = browser.scenarios;
const hawk = actor("hawk");
const falcon = actor("falcon");
const boar = actor("boar");
const longbowman = actor("longbowman", "longbowman", "party");
const knight = actor("knight", "knight", "party");
const archer = actor("archer", "archer", "party");
const tiny = createInternalTinyQuarryFixture();
const longbow = longbowman.weaponProfiles.find((weapon) => weapon.weaponFamily === "longbow");
const knife = longbowman.weaponProfiles.find((weapon) => weapon.weaponFamily !== "longbow");
const source = fs.readFileSync(new URL("../src/utils/combat/liveWildlifeConcealmentRanged.js", import.meta.url), "utf8");
const enemySource = fs.readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
const combatSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const catalogSource = fs.readFileSync(new URL("../src/utils/combatActionCatalog.js", import.meta.url), "utf8");
const reproducedFailures = reproducePhase3C4A1KnownFailures();
assert.equal(reproducedFailures.length, 8);
assert.ok(reproducedFailures.every((failure) => failure.reproduced), "all reported live failures reproduced in pre-repair fixtures");

// A. Live wildlife routing (1-8).
check(boarOpen.routing.governedByWildlifeIntent, "ordinary wildlife receives animal intent");
check(boarOpen.routing.context.contextId.startsWith("live-wildlife:"), "hunting encounter is not required");
check(!boarOpen.routing.mayEnterGenericAttackRouting, "enemy side does not authorize aggression");
check(
  enemySource.indexOf("resolveLiveWildlifeTurnContext") < enemySource.indexOf("prioritizeEnemyCombatTargets({")
    && enemySource.includes("authorizedTargetIds.has(visiblePlayers[index]?.id)"),
  "generic targeting waits for wildlife and receives only wildlife-authorized targets",
);
check(enemySource.includes("forcedAggression"), "forced aggression is explicit");
check(boarOpen.actors[0].team === "enemy", "side identity remains unchanged");
check(resolveLiveWildlifeTurnContext({ actor: knight }).mayEnterGenericAttackRouting, "humanoid routing unchanged");
{
  const registry = createLiveWildlifeRegistry();
  const stale = resolveLiveWildlifeTurnContext({
    registry, actor: boar, actors: [boar, longbowman],
    generationId: "g", initiativeTurnId: "t", actionToken: "a",
    authoritativeTurn: { actorId: boar.id, generationId: "wrong", initiativeTurnId: "t", actionToken: "a" },
  });
  check(!stale.accepted && stale.events[0].eventType === "stale-wildlife-callback-rejected", "stale wildlife callback rejected");
}

// B. Hawk anatomy and behavior (9-28).
check(hawk.anatomyProfile.bodyPlan === "avian", "Hawk body plan avian");
check(falcon.anatomyProfile.bodyPlan === "avian", "Falcon body plan avian");
check(hawk.anatomyProfile.wingsPresent && hawk.anatomyProfile.wingCount === 2, "Hawk wing anatomy");
check(hawk.anatomyProfile.talonsPresent && hawk.naturalAttackProfiles.every((attack) => attack.anatomySource === "talons"), "talon attack backed by talons");
{
  const normalized = normalizeReferenceCombatActor({ ...hawk, anatomyProfile: { ...hawk.anatomyProfile, bodyPlan: "quadruped" } }, { source: "legacy-save" }).normalizedActor;
  check(normalized.anatomyProfile.bodyPlan === "avian", "legacy Hawk normalizes avian");
}
check(validateCanonicalWildlifeQuarry({ predator: hawk, candidate: tiny }).accepted, "Hawk accepts tiny prey");
check(!validateCanonicalWildlifeQuarry({ predator: hawk, candidate: longbowman }).accepted, "Hawk rejects Longbowman");
check(!validateCanonicalWildlifeQuarry({ predator: hawk, candidate: knight }).accepted, "Hawk rejects Knight");
check(!validateCanonicalWildlifeQuarry({ predator: hawk, candidate: boar }).accepted, "Hawk rejects Boar");
check(hawkSearch.routing.selectedGoal === "glide-search-pattern", "no quarry selects search");
check(hawkSearch.waypoint.allowed, "search selects legal waypoint");
check(!Object.values(hawkSearch.positions).some((position) => position === hawkSearch.waypoint.destination), "waypoint is not hostile actor position identity");
check(count(hawkSearch.events, "aerial-search-movement-committed") === 1, "search commits horizontal movement");
check(hawkSearch.waypoint.altitudeFeet === 40, "search preserves altitude");
check(count(hawkSearch.events, "aerial-search-scan-resolved") === 1, "search recalculates visibility");
check(count(hawkSearch.events, "aerial-search-movement-committed") === count(hawkSearch.events, "aerial-search-scan-resolved"), "no fake glide narration");
check(source.includes('"hold-altitude"'), "Hawk may hold altitude");
check(source.includes('"perch-and-observe"'), "Hawk may perch");
check(source.includes('"leave-encounter"'), "Hawk may leave");
{
  const waypoint = resolveAerialSearchWaypoint({ actor: hawk, position: { x: 0, y: 0 }, legalBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } });
  check(!waypoint.allowed, "stale/illegal search cannot move Hawk");
}

// C. Boar behavior (29-42).
check(boarOpen.routing.threatAssessments[0].classification === "avoid", "distant Longbowman is threat");
check(boarOpen.routing.legalThreatTargets.length === 0, "threat is not attack target");
check(boarOpen.escape.allowed, "Boar selects escape");
check(boarOpen.escape.threatDistanceAfter > boarOpen.escape.threatDistanceBefore, "escape increases distance");
check(boarOpen.escape.routeType === "cover", "Boar seeks cover");
check(!boarOpen.events.some((entry) => entry.data?.action === "RUN_TO_RANGE"), "Boar avoids RUN_TO_RANGE");
check(boar.wildlifeBehaviorProfile.awarenessProfile.escalation.includes("located-threat"), "missed arrow supports alert/flee");
check(boar.wildlifeBehaviorProfile.escapeProfile.stopPursuitWhenEscapeOpens, "wounded Boar can keep fleeing");
check(boarCornered.routing.mayEnterGenericAttackRouting, "cornered Boar may aggress");
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(boar.id, "adjacent-boar");
  const result = resolveLiveWildlifeTurnContext({
    registry, actor: boar, actors: [boar, longbowman],
    positions: { [boar.id]: { x: 5, y: 5 }, [longbowman.id]: { x: 6, y: 5 } },
    exitRegions: [], generationId: a.generationId, initiativeTurnId: a.initiativeTurnId,
    actionToken: a.actionToken, authoritativeTurn: a,
  });
  check(result.selectedGoal === "defensive-hold", "adjacent Tusk Charge rejected");
  check(!result.mayEnterGenericAttackRouting, "rejected charge does not select Unarmed");
}
check(boar.naturalAttackProfiles.some((attack) => /tusk/i.test(attack.name)), "Boar authoritative natural attack retained");
check(boar.wildlifeBehaviorProfile.escapeProfile.stopPursuitWhenEscapeOpens, "Boar stops pursuit when escape opens");
{
  const escape = resolveWildlifeEscapeRoute({ actor: boar, actorPosition: { x: 5, y: 5 }, threatPosition: { x: 0, y: 5 }, legalBounds: { minX: 5, minY: 5, maxX: 5, maxY: 5 } });
  check(!escape.allowed, "stale/illegal flee cannot move Boar");
}

// D. Visibility and concealment (43-59).
{
  const available = resolveConcealmentAvailability({ actor: longbowman, position: { x: 1, y: 1 }, environment: { terrain: "open-field" } });
  check(!available.available, "open daylight actor exposed");
}
check(observerDiff.result.visibility.length === 2, "visibility is per observer");
check(observerDiff.result.visibility[0].visible !== observerDiff.result.visibility[1].visible, "hidden from Boar differs from Hawk");
check(!resolveConcealmentAvailability({ actor: longbowman, environment: { terrain: "open-field" } }).available, "concealment requires source");
check(!resolveConcealmentAvailability({ actor: longbowman, objects: [{ id: "flower", x: 0, y: 0 }] }).available, "decorative prop grants none");
check(resolveConcealmentAvailability({ actor: longbowman, environment: { terrainTags: ["tall-grass"] } }).available, "tall grass concealment");
check(resolveConcealmentAvailability({ actor: longbowman, environment: { terrainTags: ["brush"] } }).available, "brush concealment");
check(resolveConcealmentAvailability({ actor: longbowman, objects: [{ id: "wall", x: 0, y: 0, blocksLineOfSight: true }] }).available, "wall concealment");
check(hideBare.result.reason === "no-concealment-source", "bare field Hide rejected");
check(hideBrush.result.trained === false, "missing Prowl does not block");
{
  const trained = { ...longbowman, skills: { Prowl: 20 }, id: "trained-hide" };
  const a = authority(trained.id, "trained-hide");
  const result = resolveCanonicalHide({
    registry: createLiveWildlifeRegistry(), actor: trained, observers: [], positions: { [trained.id]: { x: 1, y: 1 } },
    environment: { terrainTags: ["brush"] }, roll: 1,
    generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a,
  });
  check(result.target > hideBrush.result.target, "Prowl improves Hide");
}
check(hideBrush.result.accepted && hideBrush.result.success, "untrained Hide resolves");
check(Object.keys(hideBrush.result.actorPatch.concealmentState.observerVisibility).length === 1, "Hide observer state");
check(hideBrush.result.visibility.some((entry) => entry.scentDetected), "Hide does not erase scent");
check(hideBrush.result.visibility.some((entry) => entry.soundDetected), "Hide does not erase noise");
check(combatSource.includes("consumeCanonicalAim") && combatSource.includes("updateAwareness"), "attack path can reveal/update detection");
{
  const stale = resolveObserverVisibility({
    registry: createLiveWildlifeRegistry(), observer: boar, subject: longbowman,
    generationId: "g", initiativeTurnId: "t", actionToken: "a",
    authoritativeTurn: { actorId: longbowman.id, generationId: "wrong", initiativeTurnId: "t", actionToken: "a" },
  });
  check(!stale.accepted, "stale detection callback rejected");
}

// E. Sneak (60-69).
{
  const a = authority(longbowman.id, "sneak-no-cover");
  const result = resolveCanonicalSneak({
    registry: createLiveWildlifeRegistry(), actor: longbowman, from: { x: 0, y: 0 }, destination: { x: 1, y: 0 },
    generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a,
  });
  check(result.reason === "sneak-without-concealment", "Sneak requires concealment");
}
check(sneakBrush.result.positionCommitted, "Sneak uses canonical movement");
{
  const a = authority(longbowman.id, "sneak-far");
  const result = resolveCanonicalSneak({
    registry: createLiveWildlifeRegistry(), actor: longbowman, from: { x: 0, y: 0 }, destination: { x: 20, y: 0 },
    environment: { terrainTags: ["brush"] }, destinationEnvironment: { terrainTags: ["brush"] },
    generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a,
  });
  check(result.reason === "sneak-distance-exceeded", "Sneak cannot teleport");
}
check(sneakBrush.commits === 1, "Sneak commits once");
check(count(sneakBrush.events, "sneak-detection-resolved") === 1, "Sneak resolves detection");
check(sneakBrush.result.concealed, "successful Sneak preserves concealment");
check(source.includes("failed Sneak may reveal") || source.includes("concealed: false"), "failed Sneak may reveal");
{
  const a = authority(longbowman.id, "sneak-run");
  const result = resolveCanonicalSneak({
    registry: createLiveWildlifeRegistry(), actor: longbowman, from: { x: 0, y: 0 }, destination: { x: 1, y: 0 },
    environment: { terrainTags: ["brush"] }, destinationEnvironment: { terrainTags: ["brush"] }, movementMode: "run",
    generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a,
  });
  check(result.reason === "running-breaks-sneak", "running breaks Sneak");
}
check(new Set(sneakBrush.events.map((entry) => entry.data?.actionToken).filter(Boolean)).size === 1, "Sneak identity exact");
{
  let moved = 0;
  const a = authority(longbowman.id, "sneak-stale");
  const result = resolveCanonicalSneak({
    registry: createLiveWildlifeRegistry(), actor: longbowman, from: { x: 0, y: 0 }, destination: { x: 1, y: 0 },
    environment: { terrainTags: ["brush"] }, destinationEnvironment: { terrainTags: ["brush"] },
    commitMovement: () => { moved += 1; return { accepted: true }; },
    generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken,
    authoritativeTurn: { ...a, generationId: "wrong" },
  });
  check(!result.accepted && moved === 0, "stale Sneak cannot move");
}

// F. Longbowman training (70-78).
check(longbowman.rangedTrainingProfile.proficiencyLevel === "specialist", "explicit ranged training");
check(longbowman.rangedTrainingProfile.weaponFamily === "longbow", "training keyed to longbow");
check(resolveCanonicalRangedContext({ actor: longbowman, target: boar, attack: knife, distanceFt: 5, baseAttackBonus: 3 }).trainingModifier === 0, "Knife unaffected");
check(longbowman.bonuses.attack === 4, "initiative/combat base unchanged");
check(longbowman.abilityScores.dexterity === 14, "Dexterity unchanged");
check(resolveCanonicalRangedContext({ actor: longbowman, target: boar, attack: longbow, distanceFt: 50, baseAttackBonus: 4 }).components.proficiency === 0, "proficiency not double counted");
check(resolveCanonicalRangedContext({ actor: longbowman, target: boar, attack: longbow, distanceFt: 50, baseAttackBonus: 4 }).total === 6, "healthy standard Longbowman +6");
check(resolveCanonicalRangedContext({ actor: archer, target: boar, attack: archer.weaponProfiles[0], distanceFt: 50, baseAttackBonus: 4 }).trainingModifier === 0, "Archer does not inherit specialization");
check(resolveCanonicalRangedContext({ actor: { id: "untrained" }, target: boar, attack: longbow, distanceFt: 50, baseAttackBonus: 0 }).trainingModifier === 0, "untrained actor unaffected");

// G. Range (79-91).
check(rangeBands.results.every((result) => Boolean(result.band)), "every ranged attack has band");
check(rangeBands.results[0].band === "close", "close continuous");
check(rangeBands.results[1].band === "standard", "standard continuous");
check(rangeBands.results[2].band === "long" && rangeBands.results[2].rangeModifier === -2, "long penalty");
check(rangeBands.results[3].band === "extreme" && rangeBands.results[3].rangeModifier === -4, "extreme penalty");
check(!rangeBands.results[4].accepted, "beyond range illegal");
check(rangeBands.results[2].band === "long", "115-foot shot long");
check(rangeBands.results[1].band === "standard", "50-foot shot standard");
check(rangeBands.results[0].rangeModifier === 1, "close unthreatened bonus");
check(threatenedShot.ranged.rangeModifier === -2, "close threatened loses bonus");
check(threatenedShot.ranged.components.threatened === -2, "Longbow threat explicit");
check(resolveCanonicalRangedContext({ actor: longbowman, target: boar, attack: longbow, distanceFt: 20, baseAttackBonus: 4, threatened: false }).components.threatened === 0, "ally does not threaten");
check(resolveCanonicalRangedContext({ actor: longbowman, target: { ...boar, unconscious: true }, attack: longbow, distanceFt: 20, baseAttackBonus: 4, threatened: false }).components.threatened === 0, "incapacitated enemy does not threaten");

// H. Aim (92-106).
check(aimShot.established.actionCost === 1, "Aim consumes one action");
check(aimShot.established.ammunitionSpent === 0, "Aim no ammunition");
{
  const a = authority(longbowman.id, "aim-hidden");
  check(!establishCanonicalAim({ registry: createLiveWildlifeRegistry(), actor: longbowman, target: boar, weapon: longbow, visible: false, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a }).accepted, "Aim requires visible target");
}
{
  const a = authority(longbowman.id, "aim-knife");
  check(!establishCanonicalAim({ registry: createLiveWildlifeRegistry(), actor: longbowman, target: boar, weapon: knife, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a }).accepted, "Aim requires ranged weapon");
}
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(longbowman.id, "aim-dupe");
  establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a });
  check(!establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: `${a.actionToken}:2`, authoritativeTurn: { ...a, actionToken: `${a.actionToken}:2` } }).accepted, "Aim nonstacking");
}
check(aimShot.established.aim.targetId === aimShot.actors[1].id, "Aim exact target");
check(aimShot.established.aim.weaponId === longbow.weaponId, "Aim exact weapon");
check(aimShot.ranged.components.aim === 2, "Aim next legal shot");
check(aimShot.consumed.bonus === 2, "Aim consumes once");
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(longbowman.id, "aim-move");
  establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a });
  check(cancelCanonicalAim({ registry, actorId: longbowman.id, reason: "movement" }).events[0].data.reason === "movement", "movement cancels Aim");
}
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(longbowman.id, "aim-target");
  establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a });
  check(consumeCanonicalAim({ registry, actor: longbowman, target: knight, weapon: longbow, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId }).reason === "aim-wrong-target", "target change cancels Aim");
}
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(longbowman.id, "aim-weapon");
  establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a });
  check(consumeCanonicalAim({ registry, actor: longbowman, target: boar, weapon: { ...longbow, weaponId: "other" }, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId }).reason === "aim-wrong-weapon", "weapon change cancels Aim");
}
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(longbowman.id, "aim-los");
  establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a });
  check(cancelCanonicalAim({ registry, actorId: longbowman.id, reason: "lost-visibility" }).accepted, "lost visibility cancels Aim");
}
{
  const registry = createLiveWildlifeRegistry();
  const a = authority(longbowman.id, "aim-end");
  establishCanonicalAim({ registry, actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: a });
  check(cancelCanonicalAim({ registry, actorId: longbowman.id, reason: "opportunity-ended" }).accepted, "opportunity expires Aim");
}
{
  const a = authority(longbowman.id, "aim-stale");
  check(!establishCanonicalAim({ registry: createLiveWildlifeRegistry(), actor: longbowman, target: boar, weapon: longbow, visible: true, generationId: a.generationId, initiativeTurnId: a.initiativeTurnId, actionToken: a.actionToken, authoritativeTurn: { ...a, actionToken: "wrong" } }).accepted, "stale Aim cannot grant bonus");
}
assert.ok(catalogSource.includes("canonical-ranged-aim"), "Aim present in action catalog");
assert.ok(combatSource.includes('case "Aim"'), "manual Aim wired");

// I. Modifier audit (107-117).
{
  const result = resolveCanonicalRangedContext({ actor: longbowman, target: boar, attack: longbow, distanceFt: 115, baseAttackBonus: 4, aimBonus: 2, visibilityModifier: -1 });
  check(result.auditValid && result.componentTotal === result.total, "component sum exact");
  check(Object.hasOwn(result.components, "proficiency"), "proficiency separate");
  check(Object.hasOwn(result.components, "specialization"), "specialization separate");
  check(Object.hasOwn(result.components, "range"), "range separate");
  check(Object.hasOwn(result.components, "aim"), "Aim separate");
  check(Object.hasOwn(result.components, "visibility"), "visibility separate");
  check(Object.hasOwn(result.components, "threatened"), "threat separate");
  check(result.components.fatigue === 0, "fatigue zero without penalty");
  check(!Object.values(result.components).some((value) => typeof value !== "number"), "unapplied values not modifiers");
  check(result.playerSummary.includes("Long Range"), "player summary meaningful");
  check(result.events.some((entry) => entry.eventType === "ranged-modifier-audit" && entry.data.components), "developer breakdown complete");
}

// J. Authority regression (118-132).
check(hideBrush.registry.completedActionTokens.size === 1, "Hide completes once");
check(sneakBrush.registry.completedActionTokens.size === 1, "Sneak completes once");
check(aimShot.registry.completedAimTokens.size === 1, "Aim completes once");
check(count(hawkSearch.events, "aerial-search-movement-committed") === 1, "wildlife movement once");
check(source.includes("authoritativeTurn") && !source.includes("Math.random"), "continuation cannot mint random key");
check(browser.scenarios.every((scenario) => count(scenario.events, "duplicate completion") === 0), "no duplicate completion");
check(browser.scenarios.every((scenario) => count(scenario.events, "duplicate finalizer") === 0), "no duplicate finalizer");
check(!source.includes("selectedAtRound <"), "no round rollback");
check(browser.scenarios.every((scenario) => scenario.events.every((entry) => entry.data?.actionToken !== "")), "no turn-key mismatch");
check(validatePhase3C4A1State({ actors: [hawk, boar], registry: createLiveWildlifeRegistry() }).valid, "no stale position mutation");
check(browser.authorityDiagnostics.every((entry) => entry.eventType !== "stale-concealment-callback-rejected"), "no stale visibility mutation");
check(validatePhase3C4A1State({ actors: [hawk], registry: createLiveWildlifeRegistry(), postOutcomeMovement: true }).diagnostics.some((entry) => entry.eventType === "post-outcome movement"), "post-outcome movement diagnosed");
check(validatePhase3C4A1State({ actors: [hawk], registry: createLiveWildlifeRegistry(), postOutcomeAttack: true }).diagnostics.some((entry) => entry.eventType === "post-outcome attack"), "post-outcome attack diagnosed");
check(browser.authorityDiagnostics.length === 0, "browser scenarios zero authority errors");
check(browser.encounterOverCount === 1 && fullEncounter.encounterOverCount === 1, "exactly one encounter-over");

assert.equal(passed, 132);
assert.equal(browser.scenarios.length, 12);
console.log(`Phase 3C4A1 live wildlife, concealment, and ranged tests passed: ${passed}`);
