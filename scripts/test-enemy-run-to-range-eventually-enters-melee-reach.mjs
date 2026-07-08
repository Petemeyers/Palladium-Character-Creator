import assert from "node:assert/strict";

import { chooseEnemyMovementFallback } from "../src/utils/enemyMovementFallback.js";

const enemy = { id: "enemy", name: "Knight", team: "enemy", currentHP: 10 };
const target = { id: "party", name: "Knight", team: "party", currentHP: 10 };
const getDistance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;
const getNeighbors = (x, y) => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
  { x: x + 1, y: y - 1 },
  { x: x - 1, y: y + 1 },
];
const targetPosition = { x: 6, y: 0 };
let currentPosition = { x: 0, y: 0 };
let previousPosition = null;

for (let turn = 0; turn < 4 && getDistance(currentPosition, targetPosition) > 5.5; turn += 1) {
  const positions = { enemy: currentPosition, party: targetPosition };
  const plan = chooseEnemyMovementFallback({
    enemy,
    hostileCandidates: [target],
    positions,
    currentPosition,
    maxHexes: 2,
    getNeighbors,
    isLegalCenter: (position) => (
      position.x >= 0 &&
      position.y >= -4 &&
      position.y <= 4 &&
      !(position.x === targetPosition.x && position.y === targetPosition.y)
    ),
    getDistance,
    isHostile: (candidate) => candidate.team === "party",
    canAttackFrom: (position, candidate, candidatePosition) => getDistance(position, candidatePosition) <= 5.5,
    previousPosition,
  });

  assert.ok(plan.position, `turn ${turn + 1} should have a movement destination`);
  const nextDistance = getDistance(plan.position, targetPosition);
  assert.ok(
    nextDistance < getDistance(currentPosition, targetPosition) || nextDistance <= 5.5,
    `turn ${turn + 1} should improve distance or enter reach`,
  );
  previousPosition = currentPosition;
  currentPosition = plan.position;
}

assert.ok(getDistance(currentPosition, targetPosition) <= 5.5, "repeated RUN_TO_RANGE should enter melee reach");

console.log("enemy run-to-range eventually enters melee reach tests passed");
