import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

const registry = createArmoredActionPlanRegistry();
const plan = {
  planId: "dispatch-gate-plan",
  selectionId: "dispatch-gate-plan",
  state: "created",
  generationId: "gen",
  round: 1,
  initiativeIndex: 0,
  initiativeTurnId: "turn",
  actionToken: "token",
  actorId: "actor",
  targetId: "target",
  selectedTechnique: "longsword-cut",
  sourceWeaponId: "Long Sword",
};

assert.equal(registerArmoredActionPlan(registry, plan).ok, true, "plan should register in created state.");
assert.equal(
  markArmoredActionPlanTerminal(registry, plan.planId, "consumed").reason,
  "plan-not-dispatched",
  "created plan must not jump directly to consumed.",
);
assert.equal(markArmoredActionPlanDispatched(registry, plan.planId).ok, true, "created plan should dispatch.");
{
  const duplicateDispatch = markArmoredActionPlanDispatched(registry, plan.planId);
  assert.equal(duplicateDispatch.ok, true, "duplicate dispatch should validate as an idempotent no-op.");
  assert.equal(duplicateDispatch.alreadyDispatched, true, "duplicate dispatch should be explicitly marked alreadyDispatched.");
}
assert.equal(markArmoredActionPlanTerminal(registry, plan.planId, "consumed").ok, true, "dispatched plan should consume.");
assert.match(
  combatPage,
  /eventType:\s*dispatched\.alreadyDispatched \? "armored-action-plan-dispatch-validated" : "armored-action-plan-dispatched"[\s\S]*?planId=\$\{armoredActionPlanId\}/,
  "attack entry should emit canonical registry-backed dispatch or dispatch-validated event.",
);
assert.match(
  combatPage,
  /eventType:\s*"armored-action-plan-identity-rejected"[\s\S]*?stage=consume[\s\S]*?return makeBlockedAttackResult\(consumed\.reason/,
  "consume rejection should block before stamina, roll, damage, or HP mutation.",
);

console.log("✅ Phase 3B1 plan dispatch gate tests passed");
