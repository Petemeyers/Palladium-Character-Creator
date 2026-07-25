import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runEnemyApproachPlanner } from "../src/utils/enemyApproachPlannerContract.js";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
for (const eventType of [
  "enemy-approach-planner-entered",
  "enemy-approach-planner-resolved",
  "enemy-approach-planner-rejected",
  "enemy-approach-planner-error",
]) {
  assert.match(source, new RegExp(eventType), `${eventType} structured event exists`);
}

const actor = { id: "enemy:1" };
const target = { id: "party:1" };
const base = {
  actor,
  target,
  origin: { x: 0, y: 0 },
  targetPosition: { x: 5, y: 0 },
  beforeDistance: 25,
  executionKey: "move:1",
  initiativeTurnId: "turn:1",
  getDistance: (a, b) => Math.abs(a.x - b.x) * 5,
};
const moved = runEnemyApproachPlanner({
  ...base,
  planner: () => ({ type: "approach", position: { x: 3, y: 0 }, enteredRange: true }),
});
assert.equal(moved.accepted, true);
assert.equal(moved.result, "movement-selected");
assert.equal(moved.afterDistance, 10);
assert.equal(moved.enteredRange, true);
assert.equal(moved.tacticalPositionImproved, true);
assert.equal(moved.executionKey, "move:1");

assert.equal(
  runEnemyApproachPlanner({ ...base, planner: () => ({ type: "hold", position: null }) }).result,
  "no-legal-path",
);
assert.equal(runEnemyApproachPlanner({ ...base, actor: null, planner: () => null }).reason, "actor-invalid");
assert.equal(runEnemyApproachPlanner({ ...base, target: null, planner: () => null }).reason, "target-invalid");
assert.equal(runEnemyApproachPlanner({ ...base, authorityAccepted: false, planner: () => null }).reason, "stale-authority");
const error = runEnemyApproachPlanner({ ...base, planner: () => { throw new Error("fixture"); } });
assert.equal(error.result, "error");
assert.equal(error.reason, "planner-exception");

console.log("enemy approach planner entry return/error tests passed");
