import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { normalizeAlignmentBehavior } from "../src/utils/behavior/normalizeAlignmentBehavior.js";
import { selectSurrenderResolution, selectSurrenderResponse } from "../src/utils/behavior/selectSurrenderResolution.js";

const target = { id: "target", isSurrendered: true, prisonerValue: 4 };
const score = (alignment, context = {}, victor = {}) => selectSurrenderResolution({ victor: { id: "victor", alignment, ...victor }, surrenderedActor: target, battlefieldContext: context, rng: () => 0.5 });
const lawfulGood = score("lawful-good");
const neutralGood = score("neutral-good");
const trueNeutral = score("true-neutral");
const lawfulEvil = score("lawful-evil", { legalAuthority: 2, witnesses: 2 }, { traits: ["personal code"] });
const chaoticEvil = score("chaotic-evil", { allowExecution: true });
assert.ok(lawfulGood.scores.acceptYieldWithoutCapture > lawfulGood.scores.executeSurrenderedOpponent);
assert.ok(neutralGood.scores.executeSurrenderedOpponent < chaoticEvil.scores.executeSurrenderedOpponent);
assert.ok(trueNeutral.scores.setRansomDisposition > trueNeutral.scores.executeSurrenderedOpponent);
assert.ok(lawfulEvil.scores.takePrisoner > 0);
assert.ok(chaoticEvil.scores.executeSurrenderedOpponent > neutralGood.scores.executeSurrenderedOpponent);
assert.notEqual(chaoticEvil.selectedDecision, undefined);
assert.equal(score("chaotic-evil").rejectedCandidates.some((entry) => entry.action === "executeSurrenderedOpponent"), true);

const knight = getCanonicalCombatActorDefinition("knight");
const goblin = getCanonicalCombatActorDefinition("goblin-warrior");
const sameBehavior = normalizeAlignmentBehavior("neutral-good");
const speciesKnight = selectSurrenderResolution({ victor: { ...knight, species: "human" }, surrenderedActor: target, alignmentBehavior: sameBehavior, rng: () => 0.4 });
const speciesGoblin = selectSurrenderResolution({ victor: { ...knight, species: "goblin" }, surrenderedActor: target, alignmentBehavior: sameBehavior, rng: () => 0.4 });
assert.deepEqual(speciesKnight.scores, speciesGoblin.scores);
assert.equal(speciesKnight.selectedDecision, speciesGoblin.selectedDecision);

const noOrder = score("true-neutral");
const ransomOrder = selectSurrenderResolution({ victor: goblin, surrenderedActor: target, factionOrders: { prisonerPolicy: "prefer-ransom" }, rng: () => 0.3 });
assert.ok(ransomOrder.scores.setRansomDisposition > noOrder.scores.setRansomDisposition);
const noQuarter = selectSurrenderResolution({ victor: knight, surrenderedActor: target, factionOrders: { prisonerPolicy: "no-quarter" }, battlefieldContext: { allowExecution: false, acceptanceRevocable: true }, rng: () => 0.99 });
assert.equal(noQuarter.scores.executeSurrenderedOpponent, 0);
assert.ok(noQuarter.scores.revokeSurrenderAcceptance > 0);
const explicitNoQuarter = selectSurrenderResolution({ victor: knight, surrenderedActor: target, factionOrders: { prisonerPolicy: "no-quarter" }, battlefieldContext: { allowExecution: true }, rng: () => 0.999999 });
assert.ok(explicitNoQuarter.scores.executeSurrenderedOpponent > 0);
assert.equal(explicitNoQuarter.selectedDecision, "executeSurrenderedOpponent");
const witnessed = score("neutral-evil", { allowExecution: true, witnesses: 4, legalAuthority: 3 });
const unwitnessed = score("neutral-evil", { allowExecution: true, witnesses: 0, legalAuthority: 0 });
assert.ok(witnessed.scores.executeSurrenderedOpponent < unwitnessed.scores.executeSurrenderedOpponent);
const valuable = score("true-neutral", { prisonerValue: 8, guardsAvailable: 2, restraintsAvailable: 1 });
const worthless = score("true-neutral", { prisonerValue: 0, guardsAvailable: 0, restraintsAvailable: 0 });
assert.ok(valuable.scores.setRansomDisposition > worthless.scores.setRansomDisposition);
assert.ok(valuable.scores.takePrisoner > worthless.scores.takePrisoner);
const response = selectSurrenderResponse({ victor: knight, surrenderedActor: target, rng: () => 0 });
assert.equal(response.selectedDecision, "accept");
assert.ok(response.scores.refuse > 0, "mercy is weighted, not hardcoded");
const grid = Object.fromEntries([
  "lawful-good", "neutral-good", "chaotic-good", "lawful-neutral", "true-neutral",
  "chaotic-neutral", "lawful-evil", "neutral-evil", "chaotic-evil",
].map((alignment) => [alignment, score(alignment)]));
assert.ok(grid["lawful-good"].scores.takePrisoner > grid["lawful-good"].scores.executeSurrenderedOpponent);
assert.ok(grid["neutral-good"].scores.acceptYieldWithoutCapture > grid["neutral-good"].scores.confiscateAndCapture);
assert.ok(grid["chaotic-good"].scores.disarmAndRelease > grid["chaotic-good"].scores.takePrisoner);
assert.ok(grid["lawful-neutral"].scores.takePrisoner > grid["lawful-neutral"].scores.disarmAndRelease);
assert.ok(grid["true-neutral"].candidates.length >= 5);
assert.equal(grid["chaotic-neutral"].scores.executeSurrenderedOpponent, 0);
assert.ok(grid["lawful-evil"].scores.confiscateAndCapture > grid["lawful-evil"].scores.disarmAndRelease);
assert.ok(grid["neutral-evil"].scores.setRansomDisposition > grid["neutral-evil"].scores.disarmAndRelease);
assert.equal(grid["chaotic-evil"].scores.executeSurrenderedOpponent, 0, "alignment alone never authorizes execution");
console.log("Phase 3B3B alignment-weighted surrender selection passed");
