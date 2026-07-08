import assert from "node:assert/strict";
import { executeEnemyMovementPlan } from "../src/utils/enemyMovementFallback.js";

let committed = false;
let spent = false;
let finished = false;
const result = executeEnemyMovementPlan({ type: "hold", position: null }, {
  commit: () => {
    committed = true;
    return true;
  },
  spendAction: () => {
    spent = true;
  },
  finish: ({ committed: didCommit, reason }) => {
    finished = didCommit && reason === "hold";
  },
});

assert.equal(result.executed, true);
assert.equal(committed, true);
assert.equal(spent, true);
assert.equal(finished, true, "hold/no-path movement fallback should still finish the action");

console.log("enemy no-path fallback finalizer tests passed");
