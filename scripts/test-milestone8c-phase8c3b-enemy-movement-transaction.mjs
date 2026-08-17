import assert from "node:assert/strict";
import { executeEnemyMovementPlan } from "../src/utils/enemyMovementFallback.js";

let spent = 0;
let finished = null;
const rejected = executeEnemyMovementPlan(
  { type: "approach", position: { x: 2, y: 0 }, path: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
  {
    commit: () => true,
    move: () => false,
    spendAction: () => { spent += 1; },
    finish: (receipt) => { finished = receipt; },
  },
);
assert.equal(rejected.executed, false);
assert.equal(rejected.committed, true);
assert.equal(rejected.movementAccepted, false);
assert.equal(rejected.reason, "movement-commit-rejected");
assert.equal(spent, 1);
assert.equal(finished?.executed, false);
assert.equal(finished?.actionSpent, true);
console.log("PASS rejected canonical movement cannot become a successful enemy move");

spent = 0;
finished = null;
const accepted = executeEnemyMovementPlan(
  { type: "approach", position: { x: 1, y: 0 }, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  {
    commit: () => true,
    move: () => true,
    spendAction: () => { spent += 1; },
    finish: (receipt) => { finished = receipt; },
  },
);
assert.equal(accepted.executed, true);
assert.equal(accepted.movementAccepted, true);
assert.equal(spent, 1);
assert.equal(finished?.executed, true);
console.log("PASS accepted enemy movement retains existing action semantics");

spent = 0;
const hold = executeEnemyMovementPlan(
  { type: "hold", position: null },
  {
    commit: () => true,
    hold: () => {},
    spendAction: () => { spent += 1; },
  },
);
assert.equal(hold.executed, true);
assert.equal(spent, 1);
console.log("PASS hold behavior remains compatible");

console.log("PASS Milestone 8C-8C.3B enemy movement transaction semantics");
