import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  registerArmoredActionPlan,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const registry = createArmoredActionPlanRegistry();
const plan = {
  selectionId: "plan-telemetry-1",
  actorId: "a",
  targetId: "b",
  generationId: "g",
  round: 1,
  initiativeIndex: 0,
  initiativeTurnId: "turn-1",
};

assert.equal(registerArmoredActionPlan(registry, plan).ok, true);
const first = markArmoredActionPlanDispatched(registry, plan.selectionId, { executionKey: "x1" });
assert.equal(first.ok, true);
assert.equal(first.alreadyDispatched, undefined);
const dispatchedAt = first.plan.dispatchedAt;

const second = markArmoredActionPlanDispatched(registry, plan.selectionId, { executionKey: "x2" });
assert.equal(second.ok, true);
assert.equal(second.alreadyDispatched, true);
assert.equal(second.plan.dispatchedAt, dispatchedAt, "duplicate dispatch must not alter dispatchedAt");

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.match(combatPage, /armored-action-plan-dispatch-validated/);
assert.match(combatPage, /dispatched\.alreadyDispatched \? "armored-action-plan-dispatch-validated" : "armored-action-plan-dispatched"/);

console.log("✅ Phase 3B1 plan dispatch telemetry tests passed");
