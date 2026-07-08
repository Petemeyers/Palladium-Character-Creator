import assert from "node:assert/strict";
import { chooseEnemyMovementFallback } from "../src/utils/enemyMovementFallback.js";

const enemy = { id: "enemy-knight", name: "Knight #2", team: "enemy", currentHP: 20 };
const partyNear = { id: "party-knight-2", name: "Knight #2", team: "party", currentHP: 20 };
const partyFar = { id: "party-knight-1", name: "Knight #1", team: "party", currentHP: 20 };
const positions = {
  [enemy.id]: { x: 32, y: 14 },
  [partyNear.id]: { x: 9, y: 15 },
  [partyFar.id]: { x: 8, y: 15 },
};

const distance = (left, right) => Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) * 5;
const getNeighbors = (x, y) => [
  { x: x - 1, y },
  { x: x + 1, y },
  { x, y: y - 1 },
  { x, y: y + 1 },
];

const plan = chooseEnemyMovementFallback({
  enemy,
  hostileCandidates: [partyNear, partyFar],
  positions,
  currentPosition: positions[enemy.id],
  maxHexes: 5,
  getNeighbors,
  isLegalCenter: (pos) => pos.x >= 0 && pos.y >= 0 && pos.x < 40 && pos.y < 30,
  getDistance: distance,
  canAttackFrom: (position, _target, targetPosition) => distance(position, targetPosition) <= 5.5,
  isHostile: (candidate) => candidate.team === "party",
  getPreferredAttackHexes: () => [],
});

assert.equal(plan.type, "approach");
assert.equal(plan.target.id, partyNear.id, "nearest out-of-range hostile should be retained as movement target");
assert.ok(plan.position, "out-of-range target selection should produce an approach destination");
assert.ok(distance(plan.position, positions[partyNear.id]) < distance(positions[enemy.id], positions[partyNear.id]));

console.log("enemy out-of-range target selection movement tests passed");
