import assert from "node:assert/strict";

import {
  auditCombatResetCoordinates,
  buildCombatExecutionReset,
} from "../src/utils/combat/combatReset.js";
import {
  auditInitiativeSchedulerAgreement,
  buildInitiativePresentation,
  resolveCombatantDisplayIdentity,
} from "../src/utils/combat/initiativeIdentity.js";
import {
  createAttackPromiseReceipt,
  settleAttackPromiseReceipt,
} from "../src/utils/combat/attackPromiseReceipt.js";
import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
  validateArmoredActionPlanIdentity,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

let passed = 0;
const test = (name, run) => {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
};

const reset = buildCombatExecutionReset({ previousGenerationId: 8 });
test("new generation advances once", () => assert.equal(reset.generationId, 9));
test("new generation begins at round one", () => assert.equal(reset.round, 1));
test("new generation begins at turn zero", () => assert.equal(reset.turnCounter, 0));
test("new generation begins at initiative index zero", () => assert.equal(reset.initiativeIndex, 0));
test("old initiative turn is cleared", () => assert.equal(reset.initiativeTurnId, null));
test("old action sequence is cleared", () => assert.equal(reset.actionSequence, 0));
test("old attack ownership is cleared", () => assert.equal(reset.activeAttackExecutionKey, null));
test("old grapple ownership is cleared", () => assert.equal(reset.activeGrappleExecutionKey, null));
test("old exchange and reaction state are cleared", () => {
  assert.equal(reset.exchangeState, null);
  assert.equal(reset.reactionOpportunity, null);
});
test("reset coordinate audit passes", () => assert.equal(auditCombatResetCoordinates(reset).matches, true));

const roster = [
  { id: "enemy-knight", name: "Knight", team: "enemy", type: "enemy" },
  { id: "party-knight", name: "Knight", team: "party", type: "player" },
];
const ordered = [
  {
    ...roster[0], initiativeEligible: true, initiativeRoll: 15,
    initiativeTotal: 20, initiativeTieBreaker: 18, initiativeBreakdown: { total: 5 },
  },
  {
    ...roster[1], initiativeEligible: true, initiativeRoll: 15,
    initiativeTotal: 20, initiativeTieBreaker: 12, initiativeBreakdown: { total: 5 },
  },
];
const presentation = buildInitiativePresentation(ordered, [...roster].reverse(), {
  initiativeRound: 4,
  source: "test",
});
test("enemy identity uses enemy suffix", () =>
  assert.equal(resolveCombatantDisplayIdentity("enemy-knight", roster).displayName, "Knight [enemy]"));
test("party identity uses party suffix", () =>
  assert.equal(resolveCombatantDisplayIdentity("party-knight", roster).displayName, "Knight [party]"));
test("duplicate names remain distinguishable", () =>
  assert.notEqual(presentation.results[0].displayName, presentation.results[1].displayName));
test("sorting does not detach actor label", () => {
  assert.equal(presentation.results[0].actorId, "enemy-knight");
  assert.equal(presentation.results[0].team, "enemy");
});
test("every tied fighter has a roll result", () => assert.equal(presentation.results.length, 2));
test("visible totals stay tied", () =>
  assert.deepEqual(presentation.results.map((entry) => entry.initiativeTotal), [20, 20]));
test("tie resolution is a separate event", () => assert.equal(presentation.ties.length, 1));
test("tie winner uses sorted first actor", () => assert.equal(presentation.ties[0].winnerActorId, "enemy-knight"));
test("summary contains both stable identities", () => {
  assert.match(presentation.summary, /Knight \[enemy\]/);
  assert.match(presentation.summary, /Knight \[party\]/);
});
test("summary retains initiative round", () => assert.equal(presentation.initiativeRound, 4));
test("scheduler audit accepts rank one", () =>
  assert.equal(auditInitiativeSchedulerAgreement({
    initiativeRound: 4,
    firstRankedActorId: "enemy-knight",
    scheduledActorId: "enemy-knight",
  }).matches, true));
test("scheduler audit rejects detached actor", () =>
  assert.equal(auditInitiativeSchedulerAgreement({
    initiativeRound: 4,
    firstRankedActorId: "enemy-knight",
    scheduledActorId: "party-knight",
  }).matches, false));

const registry = createArmoredActionPlanRegistry();
const mutableWeapon = {
  id: "long-sword",
  name: "Long Sword",
  armorContactTraits: { halfSwordCapable: true },
};
const plan = {
  planId: "plan:1",
  generationId: "generation:1",
  round: 1,
  initiativeIndex: 0,
  initiativeTurnId: "turn:1",
  actionToken: "turn:1:action:1",
  actorId: "party-knight",
  targetId: "enemy-knight",
  selectedTechnique: "longsword-thrust",
  resolvedAttackMode: "longsword-thrust",
  sourceWeaponId: "long-sword",
  sourceWeaponName: "Long Sword",
  sourceWeaponSnapshot: mutableWeapon,
  attackSnapshot: { name: "Long Sword Thrust", selectedTechnique: "longsword-thrust" },
};
const registered = registerArmoredActionPlan(registry, plan).plan;
mutableWeapon.name = "Dagger";
mutableWeapon.armorContactTraits.halfSwordCapable = false;
test("armored source weapon snapshot is immutable", () => {
  assert.equal(registered.sourceWeaponSnapshot.name, "Long Sword");
  assert.equal(registered.sourceWeaponSnapshot.armorContactTraits.halfSwordCapable, true);
  assert.equal(Object.isFrozen(registered.sourceWeaponSnapshot), true);
});
test("armored attack snapshot is immutable", () => assert.equal(Object.isFrozen(registered.attackSnapshot), true));
const identity = {
  generationId: "generation:1",
  round: 1,
  initiativeIndex: 0,
  initiativeTurnId: "turn:1",
  actionToken: "turn:1:action:1",
  actorId: "party-knight",
  targetId: "enemy-knight",
  selectedTechnique: "longsword-thrust",
  sourceWeaponId: "long-sword",
};
test("immutable plan validates before dispatch", () =>
  assert.equal(validateArmoredActionPlanIdentity(registry, "plan:1", identity, "dispatch").ok, true));
test("plan dispatches once", () => assert.equal(markArmoredActionPlanDispatched(registry, "plan:1").ok, true));
test("consumed plan cannot be reused", () => {
  assert.equal(markArmoredActionPlanTerminal(registry, "plan:1", "consumed").ok, true);
  assert.equal(markArmoredActionPlanTerminal(registry, "plan:1", "consumed").ok, false);
});
const replacementRegistry = createArmoredActionPlanRegistry();
registerArmoredActionPlan(replacementRegistry, { ...plan, planId: "plan:2", actionToken: "turn:1:action:2" });
test("replacement plan retains new plan identity", () => assert.equal(replacementRegistry.has("plan:2"), true));

const receipts = new Map();
const receipt = createAttackPromiseReceipt({
  generationId: "generation:1",
  initiativeTurnId: "turn:1",
  actorId: "enemy-knight",
  targetId: "party-knight",
  executionKey: "attack:1",
  actionSequence: 1,
  source: "enemy-melee",
});
receipts.set(receipt.executionKey, receipt);
test("valid current attack promise completes", () =>
  assert.equal(settleAttackPromiseReceipt(receipts, receipt, {
    generationId: "generation:1",
    initiativeTurnId: "turn:1",
    activeActorId: "enemy-knight",
  }).accepted, true));
test("duplicate promise settlement is idempotent", () =>
  assert.equal(settleAttackPromiseReceipt(receipts, receipt, {
    generationId: "generation:1",
    initiativeTurnId: "turn:1",
    activeActorId: "enemy-knight",
  }).reason, "receipt-already-settled"));

const staleCases = [
  ["generation reset", { generationId: "generation:2", initiativeTurnId: "turn:1", activeActorId: "enemy-knight" }, "generation-changed"],
  ["turn advance", { generationId: "generation:1", initiativeTurnId: "turn:2", activeActorId: "enemy-knight" }, "initiative-turn-changed"],
  ["active actor change", { generationId: "generation:1", initiativeTurnId: "turn:1", activeActorId: "party-knight" }, "active-actor-changed"],
  ["combat end", { generationId: "generation:1", initiativeTurnId: "turn:1", activeActorId: "enemy-knight", combatActive: false }, "combat-ended"],
  ["existing finalizer", { generationId: "generation:1", initiativeTurnId: "turn:1", activeActorId: "enemy-knight", finalizerOwned: true }, "completion-already-owned"],
];
staleCases.forEach(([name, context, reason], index) => test(`promise after ${name} is ignored`, () => {
  const staleReceipt = createAttackPromiseReceipt({
    ...receipt,
    executionKey: `attack:stale:${index}`,
  });
  const staleRegistry = new Map([[staleReceipt.executionKey, staleReceipt]]);
  const result = settleAttackPromiseReceipt(staleRegistry, staleReceipt, context);
  assert.equal(result.ignored, true);
  assert.equal(result.reason, reason);
}));

console.log(`Phase 3.1 stabilization tests: ${passed}/${passed} passed`);
