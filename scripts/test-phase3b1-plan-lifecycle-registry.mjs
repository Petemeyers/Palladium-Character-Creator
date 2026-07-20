import assert from "node:assert/strict";

import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
  summarizeArmoredActionPlans,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const registry = createArmoredActionPlanRegistry();
const plan = {
  selectionId: "plan-1",
  actionType: "attack",
  selectedTechnique: "half-sword-thrust",
  attackerId: "knight-a",
  defenderId: "knight-b",
  generationId: "g1",
  round: 3,
  initiativeIndex: 0,
};

assert.equal(registerArmoredActionPlan(registry, plan).ok, true);

const illegalConsume = markArmoredActionPlanTerminal(registry, plan.selectionId, "consumed", {
  executionKey: "attack-1",
});
assert.equal(illegalConsume.ok, false, "created plans must not be consumed before dispatch");
assert.equal(illegalConsume.reason, "plan-not-dispatched");
assert.equal(illegalConsume.fromState, "created");
assert.equal(illegalConsume.requestedState, "consumed");

assert.equal(markArmoredActionPlanDispatched(registry, plan.selectionId, { executionKey: "attack-1" }).ok, true);
assert.equal(markArmoredActionPlanTerminal(registry, plan.selectionId, "consumed", { executionKey: "attack-1" }).ok, true);

const summary = summarizeArmoredActionPlans(registry);
assert.deepEqual(
  {
    created: summary.created,
    consumed: summary.consumed,
    rejected: summary.rejected,
    stale: summary.stale,
    canceled: summary.canceled,
    open: summary.open,
  },
  { created: 1, consumed: 1, rejected: 0, stale: 0, canceled: 0, open: 0 },
);

console.log("✅ Phase 3B1 plan lifecycle registry tests passed");
