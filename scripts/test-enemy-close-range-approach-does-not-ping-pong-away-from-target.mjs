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
  maxHexes: 1,
  getNeighbors,
  isLegalCenter: (position) => position.x >= 0 && position.y >= 0 && !(position.x === 2 && position.y === 0),
  getDistance,
  isHostile: (candidate) => candidate.team === "party",
  canAttackFrom: (position, candidate, candidatePosition) => getDistance(position, candidatePosition) <= 5.5,
  previousPosition: { x: 0, y: 1 },
});

assert.equal(plan.type, "attack-position", "close-range planner should choose attack hex rather than lateral ping-pong");
assert.ok(
  getDistance(plan.position, positions.party) < getDistance(positions.enemy, positions.party),
  "selected movement should improve distance to target",
);
assert.notDeepEqual(plan.position, { x: 0, y: 1 }, "selected movement should not bounce back to previous non-attack hex");

console.log("enemy close-range approach anti-ping-pong tests passed");
