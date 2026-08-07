import assert from "node:assert/strict";
import {
  getCanonicalMovementActionBudgetFt,
  getCanonicalRoundGroundPaceFt,
  getOddRHexDistanceFeet,
  validateMovementActionDestination,
} from "../src/utils/combat/movementActionAuthority.js";

const knight = {
  movement: { ground: 25, groundPace: 25, burst: 50, runDistance: 50 },
  actionsPerRound: 2,
  currentStamina: 28,
  maxStamina: 28,
};

assert.equal(getCanonicalRoundGroundPaceFt(knight), 25);
assert.equal(getCanonicalMovementActionBudgetFt(knight, "walk"), 15);
assert.equal(getCanonicalMovementActionBudgetFt({ ...knight, movementSpentThisRoundFt: 15 }, "walk"), 10);
assert.equal(getCanonicalMovementActionBudgetFt({ ...knight, movementSpentThisRoundFt: 25 }, "walk"), 0);
assert.equal(getCanonicalMovementActionBudgetFt(knight, "run"), 50);
assert.equal(getCanonicalMovementActionBudgetFt(knight, "charge"), 50);

const baseline = {
  movement: { ground: 40, runDistance: 40 },
  actionsPerRound: 2,
  currentStamina: 20,
  maxStamina: 20,
};
assert.equal(getCanonicalMovementActionBudgetFt(baseline, "walk"), 20);
assert.equal(getCanonicalMovementActionBudgetFt(baseline, "run"), 40);

assert.equal(getOddRHexDistanceFeet({ x: 5, y: 5 }, { x: 5, y: 6 }), 5);
assert.equal(getOddRHexDistanceFeet({ x: 5, y: 5 }, { x: 6, y: 5 }), 5);
assert.equal(getOddRHexDistanceFeet({ x: 5, y: 5 }, { x: 5, y: 8 }), 15);

const acceptedWalk = validateMovementActionDestination({
  fighter: knight,
  movementType: "walk",
  origin: { x: 5, y: 5 },
  destination: { x: 5, y: 8 },
});
assert.equal(acceptedWalk.accepted, true);
assert.equal(acceptedWalk.distanceFeet, 15);

const rejectedWalk = validateMovementActionDestination({
  fighter: knight,
  movementType: "walk",
  origin: { x: 5, y: 5 },
  destination: { x: 5, y: 9 },
});
assert.equal(rejectedWalk.accepted, false);
assert.equal(rejectedWalk.budgetFeet, 15);

console.log("movement action authority regression: passed");
