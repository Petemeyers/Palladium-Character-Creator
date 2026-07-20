import assert from "node:assert/strict";

import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
  staleArmoredActionPlans,
  summarizeArmoredActionPlans,
  validateArmoredActionPlanIdentity,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const makePlan = (patch = {}) => ({
  planId: "plan-a",
  selectionId: "plan-a",
  generationId: "gen-1",
  round: 2,
  initiativeIndex: 1,
  initiativeTurnId: "turn-1",
  actionToken: "token-1",
  actorId: "enemy-knight",
  targetId: "party-knight",
  selectedTechnique: "longsword-thrust-gap",
  sourceWeaponId: "Long Sword",
  state: "created",
  ...patch,
});

const identity = {
  generationId: "gen-1",
  round: 2,
  initiativeIndex: 1,
  initiativeTurnId: "turn-1",
  actionToken: "token-1",
  actorId: "enemy-knight",
  targetId: "party-knight",
  selectedTechnique: "longsword-thrust-gap",
  sourceWeaponId: "Long Sword",
};

const registry = createArmoredActionPlanRegistry();
assert.equal(registerArmoredActionPlan(registry, makePlan()).ok, true, "valid plan should register.");
assert.equal(validateArmoredActionPlanIdentity(registry, "plan-a", identity, "dispatch").ok, true, "dispatch identity should match a created plan.");
assert.equal(markArmoredActionPlanDispatched(registry, "plan-a").ok, true, "created plan should dispatch.");
assert.equal(validateArmoredActionPlanIdentity(registry, "plan-a", identity, "attack-entry").ok, true, "attack entry identity should match a dispatched plan.");
assert.equal(markArmoredActionPlanTerminal(registry, "plan-a", "consumed").ok, true, "dispatched plan should consume exactly once.");
assert.equal(markArmoredActionPlanTerminal(registry, "plan-a", "consumed").ok, false, "duplicate consume should be rejected.");

const mismatchRegistry = createArmoredActionPlanRegistry();
registerArmoredActionPlan(mismatchRegistry, makePlan({ planId: "round-old", selectionId: "round-old" }));
assert.equal(
  validateArmoredActionPlanIdentity(mismatchRegistry, "round-old", { ...identity, round: 3 }, "dispatch").reason,
  "round-mismatch",
  "cross-round plan should be rejected before dispatch.",
);

registerArmoredActionPlan(mismatchRegistry, makePlan({ planId: "actor-wrong", selectionId: "actor-wrong" }));
assert.equal(
  validateArmoredActionPlanIdentity(mismatchRegistry, "actor-wrong", { ...identity, actorId: "other" }, "dispatch").reason,
  "actor-mismatch",
  "actor mismatch should reject the plan.",
);

registerArmoredActionPlan(mismatchRegistry, makePlan({ planId: "weapon-wrong", selectionId: "weapon-wrong" }));
assert.equal(
  validateArmoredActionPlanIdentity(mismatchRegistry, "weapon-wrong", { ...identity, sourceWeaponId: "Dagger" }, "dispatch").reason,
  "source-weapon-mismatch",
  "source weapon mismatch should reject the plan.",
);

const staled = staleArmoredActionPlans(
  mismatchRegistry,
  (plan) => Number(plan.round) !== 3,
  { reason: "round-advanced" },
);
assert.ok(staled.length >= 3, "round advance should stale pending non-terminal plans.");

const summary = summarizeArmoredActionPlans(registry);
assert.equal(summary.created, 1, "summary should count created plans.");
assert.equal(summary.consumed, 1, "summary should count consumed plans.");
assert.equal(summary.open, 0, "valid consumed registry should leave no open plan.");

console.log("✅ Phase 3B1 armored plan identity tests passed");
