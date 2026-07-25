import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  ANIMAL_AWARENESS_STATES,
  COMPANION_COMMAND_CONTRACTS,
  HUNTING_ACTION_CONTRACTS,
  claimCanonicalHuntingAction,
  commitCanonicalHuntingOutcome,
  completeCanonicalCompanionTask,
  completeCanonicalHuntingAction,
  createCanonicalCarcassState,
  createCanonicalHuntingEncounter,
  createCanonicalHuntingRegistry,
  issueCanonicalCompanionCommand,
  resolveAnimalThreatAssessment,
  resolveWildlifeDetection,
  transitionCanonicalHuntingPhase,
  validateCanonicalHuntingState,
  validateCanonicalWildlifeQuarry,
} from "../src/utils/combat/canonicalHuntingEncounter.js";
import { isHumanoidSurrenderAllowedForActor } from "../src/utils/combat/canonicalNaturalAttacks.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import {
  createInternalTinyQuarryFixture,
  runPhase3C4ABrowserScenarios,
} from "../src/utils/combat/phase3c4aHuntingScenarios.js";

let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};
const clone = (value) => structuredClone(value);
const definition = (key) => clone(getCanonicalCombatActorDefinition(key));
const eventCount = (scenario, type) => scenario.events.filter((entry) => entry.eventType === type).length;

const browser = runPhase3C4ABrowserScenarios();
const [boarHunt, hawkHunt, wolfEncounter, , escapeEncounter] = browser.scenarios;
const wolf = definition("wolf");
const boar = definition("boar");
const bear = definition("bear");
const mastiff = definition("mastiff");
const warhorse = definition("warhorse");
const rat = definition("giant-rat");
const hawk = definition("hawk");
const falcon = definition("falcon");
const knight = definition("knight");
const longbowman = definition("longbowman");
const tiny = createInternalTinyQuarryFixture();
const source = fs.readFileSync(new URL("../src/utils/combat/canonicalHuntingEncounter.js", import.meta.url), "utf8");
const catalogSource = fs.readFileSync(new URL("../src/utils/combatActionCatalog.js", import.meta.url), "utf8");
const panelSource = fs.readFileSync(new URL("../src/components/HuntingEncounterPanel.jsx", import.meta.url), "utf8");

// 1-16: intent and perception authority.
check(Boolean(wolfEncounter.intent.animalIntent?.motivation), "1 explicit animal intent");
check(!wolfEncounter.actions.some((action) => action.key === "attack"), "2 wildlife does not begin universally hostile");
check(!source.includes("alignment") && !source.includes("morality"), "3 species does not determine morality");
check(wolfEncounter.wolf.team === "neutral" && wolfEncounter.assessment.classification === "avoid", "4 hostility is encounter-specific");
check(ANIMAL_AWARENESS_STATES.includes(wolfEncounter.intent.animalIntent.awareness), "5 awareness is explicit");
check(validateCanonicalHuntingState({ registry: boarHunt.registry, rendererDetectionWrites: true }).diagnostics.some((entry) => entry.eventType === "wildlife-detection-from-renderer"), "6 renderer detection writes are diagnosed");
check(resolveWildlifeDetection({ registry: createCanonicalHuntingRegistry(), observer: wolf, subject: knight }).accepted === false, "7 detection requires owned trigger");
{
  const registry = createCanonicalHuntingRegistry();
  const args = {
    registry, observer: { ...wolf, id: "w" }, subject: { ...knight, id: "k" },
    generationId: "g", initiativeTurnId: "t", actionToken: "a",
    authoritativeTurn: { actorId: "wrong", generationId: "g", initiativeTurnId: "t", actionToken: "a" },
  };
  check(resolveWildlifeDetection(args).events[0].eventType === "stale-detection-callback-rejected", "8 stale detection callback rejected");
}
check(wolf.perceptionProfile.sight === "ordinary", "9 sight profile preserved");
check(wolf.perceptionProfile.hearing === "strong", "10 hearing profile preserved");
check(wolf.perceptionProfile.scent === "strong", "11 scent profile preserved");
check(source.includes("profile.scentWindDependency") && source.includes("wind.direction"), "12 wind only affects scent in detection");
check(source.includes("visualCover") && source.includes("visualAccess"), "13 cover affects canonical visibility");
check(hawk.perceptionProfile.sight === "exceptional", "14 Hawk visual detection");
check(wolf.perceptionProfile.scent === "strong" && wolf.perceptionProfile.hearing === "strong", "15 Wolf scent/hearing");
check(boar.perceptionProfile.scent === "strong" && boar.perceptionProfile.hearing === "strong", "16 Boar scent/hearing");

// 17-27: encounter, tracking, and stalking.
check(boarHunt.encounter.encounterId.startsWith("hunting:"), "17 stable encounter ID");
check(boarHunt.encounter.phaseSequence === 3, "18 phase advances exactly once per transition");
{
  const registry = createCanonicalHuntingRegistry();
  const quarry = { ...boar, id: "b" };
  const made = createCanonicalHuntingEncounter({ registry, generationId: "g", hunterIds: ["h"], quarry: [quarry] });
  const once = transitionCanonicalHuntingPhase({ registry, encounterId: made.encounter.encounterId, fromPhase: "search", toPhase: "contact", generationId: "g", initiativeTurnId: "t", actionToken: "a" });
  const twice = transitionCanonicalHuntingPhase({ registry, encounterId: made.encounter.encounterId, fromPhase: "search", toPhase: "contact", generationId: "g", initiativeTurnId: "t", actionToken: "a" });
  check(once.accepted && !twice.accepted, "19 duplicate phase rejected");
}
check(hawkHunt.encounter.phaseSequence === 0 && hawkHunt.events.some((entry) => entry.eventType === "hunting-encounter-created" && entry.data.phase === "contact"), "20 known-contact start");
check(eventCount(boarHunt, "tracks-located") === 1, "21 tracks found");
{
  const result = escapeEncounter.events.some((entry) => entry.eventType === "trail-lost");
  check(result, "22 trail can be lost");
}
check(!escapeEncounter.registry.encounters.get(escapeEncounter.encounter.encounterId).trackState?.lastKnownPosition, "23 tracking failure does not fabricate position");
check(eventCount(boarHunt, "canonical-movement-committed") === 1, "24 stalking uses canonical movement");
check(boarHunt.hunter.position.x === 20 && boarHunt.hunter.x === 20, "25 stalk position remains authoritative");
check(boarHunt.registry.encounters.get(boarHunt.encounter.encounterId).quarryAwareness === "alerted", "26 failed stalk alerts quarry");
check(boarHunt.events.some((entry) => entry.eventType === "wildlife-detection-resolved"), "27 noisy equipment is represented without damage math");

// 28-48: quarry and species behavior.
check(Boolean(hawk.quarryProfile?.enabled), "28 quarry profile explicit");
check(validateCanonicalWildlifeQuarry({ predator: hawk, candidate: tiny }).accepted, "29 Hawk accepts tiny quarry");
check(!validateCanonicalWildlifeQuarry({ predator: hawk, candidate: { ...knight, id: "knight-target", creatureType: "humanoid" } }).accepted, "30 Hawk rejects armored Knight");
check(wolfEncounter.assessment.reason === "prepared-armored-group", "31 Wolf avoids armored group");
check(warhorse.quarryProfile.enabled === false, "32 Warhorse quarry disabled");
check(wolfEncounter.assessment.classification === "avoid" && hawkHunt.quarryValidation.accepted, "33 quarry differs from threat");
{
  const result = resolveAnimalThreatAssessment({ animal: { ...boar, id: "b" }, candidate: { ...knight, id: "k" }, animalIntent: { motivation: "forage" }, distance: 10, escapeRoutes: [{ x: 20, y: 0 }] });
  check(result.classification === "avoid", "34 Boar defaults to escape");
}
{
  const result = resolveAnimalThreatAssessment({ animal: { ...boar, id: "b" }, candidate: { ...knight, id: "k" }, animalIntent: { motivation: "defend-self" }, distance: 4, escapeRoutes: [] });
  check(result.responseOptions.includes("defend-self"), "35 cornered Boar may charge/defend");
}
check(boar.naturalAttackProfiles.some((attack) => /tusk/i.test(attack.name)), "36 Boar charge uses canonical tusk attack");
check(!source.includes("free charge") && !source.includes("freeCharge"), "37 no free wound charge");
check(bear.wildlifeBehaviorProfile.escapeProfile != null, "38 Bear may avoid");
check(bear.wildlifeBehaviorProfile.territorialProfile.protectedTypes.includes("food") && bear.wildlifeBehaviorProfile.territorialProfile.protectedTypes.includes("young"), "39 Bear protects food/young");
check(bear.wildlifeBehaviorProfile.packProfile?.enabled === false, "40 Bear has no pack tactics");
check(mastiff.companionProfile.enabled && mastiff.companionProfile.companionTypes.includes("tracking-dog"), "41 Mastiff handler relationship explicit");
check(hawkHunt.commandResults.every(({ issued }) => issued.rollMade === false), "42 routine Mastiff/Hawk commands need no roll");
check(mastiff.companionProfile.pressureUsesExistingControl === true, "43 pressure uses existing control");
check(warhorse.quarryProfile.enabled === false && !warhorse.wildlifeBehaviorProfile.defaultMotivations.includes("hunt"), "44 Warhorse does not hunt");
check(rat.wildlifeBehaviorProfile.defaultMotivations.includes("hide"), "45 Giant Rat seeks cover");
check(rat.wildlifeBehaviorProfile.defensiveProfile != null, "46 Giant Rat may defend when trapped");
check(hawk.wildlifeBehaviorProfile.threatAssessmentProfile?.avoidGroundedMelee === true, "47 Hawk avoids grounded melee");
check(falcon.actorKey !== hawk.actorKey && falcon.name !== hawk.name, "48 Falcon remains distinct");

// 49-60: companion ownership.
check(hawkHunt.handler.id !== hawkHunt.hawk.id, "49 companion and handler separate");
check(hawkHunt.handler.combatStamina !== hawkHunt.hawk.combatStamina, "50 companion stamina not merged");
check(issueCanonicalCompanionCommand({ registry: createCanonicalHuntingRegistry(), companion: hawkHunt.hawk, handler: hawkHunt.handler, commandKey: "release-raptor", commandToken: "x" }).accepted === false, "51 Release requires link");
check(hawkHunt.commandResults.some(({ issued }) => issued.task.commandKey === "search-from-above"), "52 Search creates owned task");
check(hawkHunt.commandResults.some(({ issued }) => issued.task.commandKey === "pursue-quarry" && issued.command.quarryId === hawkHunt.quarry.id), "53 Pursue validates quarry");
check(COMPANION_COMMAND_CONTRACTS["abort-pursuit"].companionActionEffect === "returning", "54 Abort cancels pursuit");
check(hawkHunt.returned.movementResult.accepted && eventCount(hawkHunt, "canonical-movement-committed") === 1, "55 Return does not teleport");
check(hawkHunt.commandResults.some(({ issued, completed }) => issued.command.commandKey === "hold-quarry" && completed.accepted), "56 Hold requires control");
check(source.includes("releaseQuarry") && source.includes("release-quarry-authority-required"), "57 above-ground release delegates authority");
{
  const completed = hawkHunt.commandResults[0].completed;
  check(!completeCanonicalCompanionTask({ registry: hawkHunt.registry, task: completed.task, companion: hawkHunt.hawk, generationId: "wrong", commandToken: completed.command.commandToken }).accepted, "58 stale companion cannot move");
}
check(source.includes('return reject("stale-companion-callback"') && source.indexOf('return reject("stale-companion-callback"') < source.indexOf("releaseQuarry({"), "59 stale companion cannot attack/release");
check(hawkHunt.registry.completedCommandTokens.size === 5, "60 stale companion cannot release quarry");

// 61-70: ranged, impact, bleeding, and defensive response.
check(longbowman.weaponProfiles.some((weapon) => weapon.weaponFamily === "longbow"), "61 Longbowman canonical weapon");
check(boarHunt.shot.validation.accepted, "62 hunting shot uses canonical ranged executor");
check(boarHunt.shot.ammunitionClaim.claim.amount === 1 && boarHunt.hunter.ammunitionState.current === 19, "63 arrow spends once");
check(boarHunt.hunter.ammunitionState.current < longbowman.ammunitionState.current, "64 no immediate ammunition refund");
check(boarHunt.shot.impact.hitLocation === "torso", "65 hit location canonical");
check(boarHunt.shot.impact.armorAuthority === "natural-hide" && boar.armorProfile.category === "natural", "66 Boar hide remains natural hide");
check(boarHunt.shot.authorization.accepted && boarHunt.shot.impact.damage === 3, "67 injury authorization precedes HP mutation");
check(escapeEncounter.pursuit.pursuitState.quarryInjuryState.bleeding === true, "68 bleeding persists through pursuit");
check(escapeEncounter.registry.intents.get(escapeEncounter.boar.id).motivation === "escape", "69 wounded quarry may flee");
check(boar.wildlifeBehaviorProfile.defensiveProfile != null, "70 wounded cornered quarry may defend");

// 71-90: pursuit, escape, carcass, harvest, and finalization.
check(escapeEncounter.pursuit.pursuitState.quarryId === escapeEncounter.boar.id, "71 pursuit keeps quarry identity");
check(escapeEncounter.pursuit.pursuitState.pursuerIds.includes(escapeEncounter.hunter.id), "72 pursuit keeps hunter identity");
check(!escapeEncounter.stalePursuit.accepted && escapeEncounter.stalePursuit.events[0].eventType === "stale-pursuit-callback-rejected", "73 stale pursuit rejected");
check(escapeEncounter.events.some((entry) => entry.eventType === "trail-lost"), "74 trail loss can escape");
check(escapeEncounter.encounter.outcome === "quarry-wounded-escaped", "75 escape is legal");
check(!escapeEncounter.boar.dead && escapeEncounter.boar.currentHP === 5, "76 escaped quarry remains alive");
check(escapeEncounter.registry.carcasses.size === 0, "77 escaped quarry has no carcass");
check(boarHunt.registry.carcasses.size === 1, "78 recovered death creates carcass");
{
  const registry = createCanonicalHuntingRegistry();
  const dead = { ...boar, id: "dead-boar", dead: true };
  const carcass = createCanonicalCarcassState({ registry, sourceActor: dead, generationId: "g" });
  check(carcass.accepted && registry.harvests.size === 0, "79 unrecovered death has no harvest");
}
check(boarHunt.registry.harvests.size === 1, "80 recovered carcass creates harvest boundary");
check(boarHunt.registry.harvests.values().next().value.inventoryTransferPending === true, "81 no automatic inventory");
check(boarHunt.registry.harvests.values().next().value.exactQuantities === null, "82 no meat quantity invented");
check(boarHunt.registry.harvests.values().next().value.currencyValues === null, "83 no hide value invented");
check(boarHunt.registry.carcasses.values().next().value.projectileRecoveryState.recoveryPending === true, "84 no arrow auto-refund");
check(["quarry-wounded-escaped", "hunt-abandoned", "hunter-driven-off"].every((outcome) => browser.scenarios.some((scenario) => scenario.encounter.outcome === outcome)), "85 hunt ends without death");
check(browser.scenarios.every((scenario) => eventCount(scenario, "hunting-outcome-committed") === 1), "86 one outcome commits");
{
  const registry = createCanonicalHuntingRegistry();
  const made = createCanonicalHuntingEncounter({ registry, generationId: "g", hunterIds: ["h"], quarry: [{ ...boar, id: "b" }] });
  check(commitCanonicalHuntingOutcome({ registry, encounterId: made.encounter.encounterId, outcome: "quarry-escaped", generationId: "g", pendingOwnership: { pursuit: true } }).deferred, "87 pursuit defers finalization");
}
{
  const registry = createCanonicalHuntingRegistry();
  const made = createCanonicalHuntingEncounter({ registry, generationId: "g", hunterIds: ["h"], quarry: [{ ...boar, id: "b" }] });
  check(commitCanonicalHuntingOutcome({ registry, encounterId: made.encounter.encounterId, outcome: "quarry-escaped", generationId: "g", pendingOwnership: { companionTask: true } }).deferred, "88 companion task defers");
}
{
  const registry = createCanonicalHuntingRegistry();
  const made = createCanonicalHuntingEncounter({ registry, generationId: "g", hunterIds: ["h"], quarry: [{ ...boar, id: "b" }] });
  check(commitCanonicalHuntingOutcome({ registry, encounterId: made.encounter.encounterId, outcome: "quarry-escaped", generationId: "g", pendingOwnership: { preyCarry: true, falling: true } }).deferred, "89 carry/fall defer");
}
check(browser.scenarios.every((scenario) => !scenario.events.some((entry) => entry.eventType === "combat-over")), "90 finalizers do not compete");

// 91-107: surrender, normalization, stale work, presentation, browser authority.
check(!isHumanoidSurrenderAllowedForActor(wolf), "91 animal surrender panel blocked");
check(!wolfEncounter.actions.some((action) => action.key === "attack"), "92 defensive animal stops when escape opens");
{
  const normalized = normalizeReferenceCombatActor({ ...wolfEncounter.wolf, animalIntent: wolfEncounter.intent.animalIntent }, { source: "test" }).normalizedActor;
  check(normalized.animalIntent.motivation === "travel", "93 intent survives normalization");
}
{
  const normalized = normalizeReferenceCombatActor({ ...boarHunt.boar, huntingEncounterId: boarHunt.encounter.encounterId, trackState: { confidence: "strong" } }, { source: "test" }).normalizedActor;
  check(normalized.huntingEncounterId === boarHunt.encounter.encounterId && normalized.trackState.confidence === "strong", "94 hunting state survives");
}
{
  const normalized = normalizeReferenceCombatActor({ ...hawkHunt.hawk, companionLink: hawkHunt.link.companionLink, currentCommand: "return-to-glove" }, { source: "test" }).normalizedActor;
  check(normalized.companionLink.linkId === hawkHunt.link.companionLink.linkId, "95 companion state survives");
}
{
  const normalized = normalizeReferenceCombatActor({ ...escapeEncounter.boar, pursuitState: escapeEncounter.pursuit.pursuitState }, { source: "test" }).normalizedActor;
  check(normalized.pursuitState.quarryId === escapeEncounter.boar.id, "96 pursuit survives");
}
{
  const carcassState = boarHunt.registry.carcasses.values().next().value;
  const normalized = normalizeReferenceCombatActor({ ...boarHunt.boar, carcassState }, { source: "test" }).normalizedActor;
  check(normalized.carcassState.carcassId === carcassState.carcassId, "97 carcass survives");
}
{
  const once = normalizeReferenceCombatActor({ ...wolfEncounter.wolf, animalIntent: wolfEncounter.intent.animalIntent }, { source: "test" }).normalizedActor;
  const twice = normalizeReferenceCombatActor(once, { source: "test" }).normalizedActor;
  check(JSON.stringify(once) === JSON.stringify(twice), "98 normalization idempotent");
}
check(normalizeReferenceCombatActor(wolfEncounter.wolf, { source: "test", lifecyclePhase: "hunting-shot" }).blocked === true, "99 normalization blocked mid-action");
{
  const registry = createCanonicalHuntingRegistry();
  const hunter = { ...longbowman, id: "h" };
  const quarry = { ...boar, id: "b" };
  const made = createCanonicalHuntingEncounter({ registry, generationId: "g", hunterIds: ["h"], quarry: [quarry], initialPhase: "contact" });
  const claim = claimCanonicalHuntingAction({ registry, encounterId: made.encounter.encounterId, hunter, actionKey: "take-hunting-shot", targetId: "b", generationId: "g", initiativeTurnId: "t", actionToken: "a", authoritativeTurn: { actorId: "h", generationId: "g", initiativeTurnId: "t", actionToken: "a" } });
  completeCanonicalHuntingAction({ registry, claim: claim.claim });
  check(!completeCanonicalHuntingAction({ registry, claim: claim.claim }).accepted, "100 duplicate completion blocked");
}
{
  const duplicate = commitCanonicalHuntingOutcome({ registry: escapeEncounter.registry, encounterId: escapeEncounter.encounter.encounterId, outcome: "quarry-escaped", generationId: escapeEncounter.encounter.generationId, actionToken: "again" });
  check(!duplicate.accepted, "101 duplicate finalizer blocked");
}
check(!source.includes("selectedAtRound <") && escapeEncounter.encounter.generationId === "phase3c4a-escape", "102 round rollback absent");
check(browser.scenarios.every((scenario) => scenario.events.every((entry) => entry.data?.actionToken !== "")), "103 no turn-key mismatch");
check(!escapeEncounter.postOutcomeAction.accepted, "104 no post-outcome movement");
check(!escapeEncounter.postOutcomeAction.accepted && escapeEncounter.postOutcomeAction.reason === "stale-hunting-callback", "105 no post-outcome attack");
check(browser.authorityDiagnostics.length === 0, "106 deterministic browser scenarios have zero authority errors");
check(browser.scenarios.every((scenario) => eventCount(scenario, "encounter-over") === 1), "107 exactly one encounter-over per scenario");

assert.equal(passed, 107);
assert.equal(Object.keys(HUNTING_ACTION_CONTRACTS).length, 14);
assert.equal(Object.keys(COMPANION_COMMAND_CONTRACTS).length, 11);
assert.ok(catalogSource.includes("buildHuntingActions"));
assert.ok(panelSource.includes("Quarry:") && panelSource.includes("Awareness:"));
console.log(`Phase 3C4A hunting and wildlife tests passed: ${passed}`);
