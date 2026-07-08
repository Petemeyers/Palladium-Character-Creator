import assert from "node:assert/strict";

import { chooseEnemyMovementFallback } from "../src/utils/enemyMovementFallback.js";

const enemy = { id: "enemy", name: "Knight", team: "enemy" };
const target = { id: "party", name: "Knight", team: "party", currentHP: 10 };
const positions = {
  enemy: { x: 0, y: 0 },
  party: { x: 2, y: 0 },
};
const getDistance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;
const getNeighbors = (x, y) => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
  { x: x + 1, y: y - 1 },
  { x: x - 1, y: y + 1 },
];

const plan = chooseEnemyMovementFallback({
  enemy,
  hostileCandidates: [target],
  positions,
  currentPosition: positions.enemy,
  maxHexes: 2,
  getNeighbors,
  isLegalCenter: (position) => position.x >= 0 && position.y >= 0 && !(position.x === 2 && position.y === 0),
  getDistance,
  isHostile: (candidate) => candidate.team === "party",
  canAttackFrom: (position, candidate, candidatePosition) => getDistance(position, candidatePosition) <= 5.5,
});

assert.equal(plan.type, "attack-position", "close-range approach should prefer an attack-reachable hex");
assert.deepEqual(plan.position, { x: 1, y: 0 }, "nearest adjacent attack hex should be selected");
assert.ok(getDistance(plan.position, positions.party) <= 5.5, "selected destination should be in melee reach");

console.log("enemy close-range approach attack-hex preference tests passed");
