import assert from "node:assert/strict";

import { resolveArmoredCombatAction } from "../src/utils/ai/resolveArmoredCombatAction.js";
import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
  summarizeArmoredActionPlans,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const attacker = {
  id: "knight-a",
  name: "Knight A",
  weapons: [{ id: "dagger-a", name: "Dagger" }],
  remainingActions: 1,
};
const defender = {
  id: "knight-b",
  name: "Knight B",
  armorProfile: { armorClass: "plate", rigidCoverage: true },
};
const longSword = { id: "long-sword-a", name: "Long Sword", reach: 5 };

const rejectedLogs = [];
const missingToken = resolveArmoredCombatAction({
  attacker,
  defender,
  selectedWeapon: longSword,
  distance: 5,
  remainingActions: 1,
  generationId: "combat-g",
  rng: () => 0.99,
  source: "test-missing-token",
  addLog: (entry) => rejectedLogs.push(entry),
});

assert.equal(missingToken.actionType, "rejected");
assert.equal(missingToken.reason, "missing-turn-token");
assert.ok(rejectedLogs.some((entry) => entry?.eventType === "armored-action-plan-rejected"));

const createdLogs = [];
const action = resolveArmoredCombatAction({
  attacker,
  defender,
  selectedWeapon: longSword,
  distance: 5,
  remainingActions: 1,
  generationId: "combat-g",
  round: 3,
  initiativeIndex: 1,
  turnToken: "turn-token-a",
  rng: () => 0.99,
  source: "test-grapple-plan",
  addLog: (entry) => createdLogs.push(entry),
});

assert.equal(action.actionType, "grapple");
assert.equal(action.technique, "grapple");
assert.ok(action.armoredActionPlan.selectionId);
assert.equal(action.armoredActionPlan.turnToken, "turn-token-a");
assert.equal(action.armoredActionPlan.round, 3);
assert.equal(action.armoredActionPlan.initiativeIndex, 1);
assert.equal(action.armoredActionPlan.sourceWeaponId, null);
assert.equal(action.armoredActionPlan.sourceWeaponName, null);
assert.equal(action.armoredActionPlan.sourceWeaponProfileKey, null);
assert.equal(action.armoredActionPlan.sourceWeaponSnapshot, null);
assert.equal(action.armoredActionPlan.resolvedAttackMode, "grapple");
assert.ok(createdLogs.some((entry) => entry?.eventType === "armored-action-plan-created"));

const registry = createArmoredActionPlanRegistry();
assert.equal(registerArmoredActionPlan(registry, action.armoredActionPlan).ok, true);
assert.equal(markArmoredActionPlanDispatched(registry, action.armoredActionPlan.selectionId).ok, true);
assert.equal(
  markArmoredActionPlanTerminal(registry, action.armoredActionPlan.selectionId, "consumed").ok,
  true,
  "grapple plan should be consumed when handler accepts ownership, independent of opposed roll outcome",
);
assert.equal(
  markArmoredActionPlanDispatched(registry, action.armoredActionPlan.selectionId).ok,
  false,
  "consumed grapple plan must not be dispatched again",
);

const summary = summarizeArmoredActionPlans(registry);
assert.equal(summary.created, 1);
assert.equal(summary.consumed, 1);
assert.equal(summary.open, 0);

console.log("✅ Phase 3B1 grapple plan accounting tests passed");
