import assert from "node:assert/strict";

import {
  getCombatantFootprintHexes,
  selectEnemyClosingMovementHex,
} from "../src/utils/enemyClosingMovement.js";

const bounds = { width: 12, height: 10 };
const offsets = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];
const getNeighbors = (x, y) => offsets.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
const getDistance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const inBounds = (hex) => (
  hex.x >= 0 && hex.x < bounds.width && hex.y >= 0 && hex.y < bounds.height
);
const makeLegalCenter = (combatant, occupied = new Set()) => (center) => (
  getCombatantFootprintHexes(combatant, center).every((cell) => (
    inBounds(cell) && !occupied.has(`${cell.x},${cell.y}`)
  ))
);

const meleeEnemy = { id: "minotaur", size: "medium" };
const farResult = selectEnemyClosingMovementHex({
  currentPosition: { x: 1, y: 5 },
  targetPosition: { x: 8, y: 5 },
  maxHexes: 3,
  getNeighbors,
  isLegalCenter: makeLegalCenter(meleeEnemy),
  getDistance,
});
assert.deepEqual(farResult.position, { x: 4, y: 5 });
assert.equal(farResult.bestCandidateDistance < farResult.currentDistance, true);
assert.equal(farResult.reason, "closer-reachable-hex");

const largeEnemy = { id: "minotaur", size: "large" };
const largeOccupied = new Set(["5,4"]);
const largeResult = selectEnemyClosingMovementHex({
  currentPosition: { x: 2, y: 4 },
  targetPosition: { x: 9, y: 4 },
  maxHexes: 2,
  getNeighbors,
  isLegalCenter: makeLegalCenter(largeEnemy, largeOccupied),
  getDistance,
});
assert.ok(largeResult.position, "large enemy finds a legal closing center");
assert.equal(largeResult.bestCandidateDistance < largeResult.currentDistance, true);
assert.equal(
  getCombatantFootprintHexes(largeEnemy, largeResult.position)
    .some((cell) => largeOccupied.has(`${cell.x},${cell.y}`)),
  false,
  "large enemy footprint avoids occupied cells"
);

const blockedDirectResult = selectEnemyClosingMovementHex({
  currentPosition: { x: 1, y: 2 },
  targetPosition: { x: 4, y: 2 },
  maxHexes: 1,
  getNeighbors,
  isLegalCenter: makeLegalCenter(meleeEnemy, new Set(["2,2"])),
  getDistance,
});
assert.ok(blockedDirectResult.position, "enemy can move around a blocked direct hex");
assert.notDeepEqual(blockedDirectResult.position, { x: 2, y: 2 });
assert.equal(blockedDirectResult.bestCandidateDistance < blockedDirectResult.currentDistance, true);

const antiOscillationResult = selectEnemyClosingMovementHex({
  currentPosition: { x: 2, y: 2 },
  targetPosition: { x: 6, y: 2 },
  maxHexes: 1,
  getNeighbors,
  isLegalCenter: makeLegalCenter(meleeEnemy, new Set(["3,2"])),
  getDistance,
  previousPosition: { x: 1, y: 2 },
});
assert.ok(antiOscillationResult.position);
assert.notDeepEqual(
  antiOscillationResult.position,
  { x: 1, y: 2 },
  "fallback avoids immediately reversing when another legal detour exists"
);

const noMovementResult = selectEnemyClosingMovementHex({
  currentPosition: { x: 1, y: 1 },
  targetPosition: { x: 8, y: 8 },
  maxHexes: 4,
  getNeighbors,
  isLegalCenter: () => false,
  getDistance,
});
assert.equal(noMovementResult.position, null);
assert.equal(noMovementResult.reason, "no-legal-reachable-hex");
assert.equal(noMovementResult.bestCandidateDistance, null);

console.log("enemy closing movement tests passed");
