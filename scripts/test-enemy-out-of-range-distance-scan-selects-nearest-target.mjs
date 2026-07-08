import assert from "node:assert/strict";

import { chooseEnemyMovementFallback } from "../src/utils/enemyMovementFallback.js";

const enemy = {
  id: "enemy-knight-1",
  name: "Knight #1",
  team: "enemy",
  attacks: [{ name: "Long Sword", type: "melee", range: 5.5 }],
};
const partyA = { id: "party-knight-1", name: "Knight #1", team: "party" };
const partyB = { id: "party-knight-2", name: "Knight #2", team: "party" };
const positions = {
  [enemy.id]: { x: 32, y: 14 },
  [partyA.id]: { x: 9, y: 15 },
  [partyB.id]: { x: 17, y: 15 },
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
  hostileCandidates: [partyA, partyB],
  positions,
  currentPosition: positions[enemy.id],
  maxHexes: 5,
  getNeighbors,
  isLegalCenter: (position) => position.x >= 0 && position.y >= 0 && position.x < 40 && position.y < 30,
  getDistance,
  isHostile: (candidate) => candidate.team === "party",
  canAttackFrom: (position, candidate) => getDistance(position, positions[candidate.id]) <= 5.5,
});

assert.equal(plan.target.id, partyB.id, "nearest valid hostile should be selected after distance scan");
assert.equal(plan.type, "approach", "out-of-range scan should produce an approach plan");
assert.ok(plan.position, "approach plan should include a movement destination");
assert.ok(
  getDistance(plan.position, positions[partyB.id]) < getDistance(positions[enemy.id], positions[partyB.id]),
  "movement destination should close distance to nearest hostile",
);

console.log("enemy out-of-range distance scan nearest-target tests passed");
