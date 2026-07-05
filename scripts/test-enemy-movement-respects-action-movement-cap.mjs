import assert from "node:assert/strict";
import { resolveEnemyMovementBudget } from "../src/utils/enemyClosingMovement.js";

const budget = resolveEnemyMovementBudget({
  fighter: {
    normalizedSelectableActor: true,
    movement: { ground: 30 },
    derivedStats: { movement: 30 },
  },
  movementType: "RUN",
  pathSearchBudgetFeet: 135,
  legacyAllowanceFeet: 135,
  distanceFeet: 200,
  cellSize: 5,
});

assert.equal(budget.movementAllowanceThisAction, 30);
assert.equal(budget.pathSearchBudget, 135);
assert.equal(budget.actualMoveCapFeet, 30);
assert.equal(budget.maxCommittedHexes, 6);
console.log("enemy committed movement respects canonical action cap");
