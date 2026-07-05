import assert from "node:assert/strict";
import { formatEnemyMovementDebug } from "../src/utils/enemyClosingMovement.js";

const message = formatEnemyMovementDebug({
  movementAllowanceThisAction: 30,
  pathSearchBudget: 135,
  actualMovedDistance: 20,
});

assert.match(message, /movementAllowanceThisAction=30ft/);
assert.match(message, /pathSearchBudget=135ft/);
assert.match(message, /actualMovedDistance=20ft/);
assert.doesNotMatch(message, /maxThisAction/);
console.log("enemy movement diagnostics separate allowance, search, and actual movement");
