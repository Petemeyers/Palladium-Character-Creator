import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  chooseEnemyMovementFallback,
  isValidEnemyMovementTarget,
} from "../src/utils/enemyMovementFallback.js";
import { getCombatantFootprintHexes } from "../src/utils/enemyClosingMovement.js";

const offsets = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const getNeighbors = (x, y) => offsets.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
const getDistance = (a, b) => (
  (Math.abs(a.x - b.x) + Math.abs(a.x + a.y - b.x - b.y) + Math.abs(a.y - b.y)) / 2
) * 5;
const bounds = { width: 12, height: 10 };
const inBounds = (hex) => hex.x >= 0 && hex.x < bounds.width && hex.y >= 0 && hex.y < bounds.height;
const enemy = { id: "goblin", team: "enemy", size: "medium" };
const hostile = (target) => target.team !== enemy.team;

function makeOptions({ targets, positions, occupied = new Set(), maxHexes = 3, preferred = {} }) {
  const isLegalCenter = (center) => getCombatantFootprintHexes(enemy, center).every((cell) => (
    inBounds(cell) && !occupied.has(`${cell.x},${cell.y}`)
  ));
  return {
    enemy,
    hostileCandidates: targets,
    positions,
    currentPosition: positions[enemy.id],
    maxHexes,
    getNeighbors,
    isLegalCenter,
    getDistance,
    isHostile: hostile,
    canAttackFrom: (position, target, targetPosition) => getDistance(position, targetPosition) <= 5,
    getPreferredAttackHexes: (target) => preferred[target.id] || [],
  };
}

const adjacent = { id: "adjacent", team: "party", HP: 10 };
let plan = chooseEnemyMovementFallback(makeOptions({
  targets: [adjacent],
  positions: { goblin: { x: 2, y: 2 }, adjacent: { x: 3, y: 2 } },
}));
assert.equal(plan.type, "attack-now", "an adjacent enemy attacks normally");

const blocked = { id: "blocked", team: "party", HP: 10 };
const reachable = { id: "reachable", team: "party", HP: 10 };
const blockedRing = new Set(getNeighbors(3, 2).map((hex) => `${hex.x},${hex.y}`));
plan = chooseEnemyMovementFallback(makeOptions({
  targets: [blocked, reachable],
  positions: { goblin: { x: 0, y: 2 }, blocked: { x: 3, y: 2 }, reachable: { x: 1, y: 6 } },
  occupied: blockedRing,
  maxHexes: 5,
}));
assert.equal(plan.target.id, "reachable", "reachable attack target outranks a blocked closer target");
assert.equal(plan.type, "attack-position");

const flankTarget = { id: "champion", team: "party", HP: 20 };
plan = chooseEnemyMovementFallback(makeOptions({
  targets: [flankTarget],
  positions: { goblin: { x: 1, y: 3 }, champion: { x: 4, y: 3 } },
  occupied: new Set(["3,3"]),
  preferred: { champion: [{ x: 3, y: 3 }] },
  maxHexes: 3,
}));
assert.equal(plan.type, "attack-position", "blocked flank falls back to a normal attack hex");
assert.equal(plan.usedFlankFallback, true);
assert.notDeepEqual(plan.position, { x: 3, y: 3 });

const far = { id: "far", team: "party", HP: 10 };
plan = chooseEnemyMovementFallback(makeOptions({
  targets: [far],
  positions: { goblin: { x: 1, y: 1 }, far: { x: 10, y: 1 } },
  occupied: new Set(["2,1"]),
  maxHexes: 3,
}));
assert.equal(plan.type, "approach", "enemy advances when no attack hex is reachable this action");
assert.ok(getDistance(plan.position, { x: 10, y: 1 }) < getDistance({ x: 1, y: 1 }, { x: 10, y: 1 }));
assert.notDeepEqual(plan.position, { x: 2, y: 1 }, "approach uses a validated detour");

plan = chooseEnemyMovementFallback(makeOptions({
  targets: [far],
  positions: { goblin: { x: 1, y: 1 }, far: { x: 10, y: 1 } },
  occupied: new Set(getNeighbors(1, 1).map((hex) => `${hex.x},${hex.y}`)),
  maxHexes: 3,
}));
assert.equal(plan.type, "hold", "enemy holds only when no legal step exists");

for (const invalid of [
  { id: "dead", team: "party", HP: 0 },
  { id: "defeated", team: "party", defeated: true },
  { id: "fled", team: "party", fled: true },
  { id: "passive", team: "party", controlMode: "passive" },
  { id: "ally", team: "enemy", HP: 10 },
  { id: "unconscious", team: "party", unconscious: true },
]) {
  assert.equal(isValidEnemyMovementTarget(invalid, { isHostile: hostile }), false, `${invalid.id} is not targeted`);
}

const largeEnemy = { ...enemy, size: "large" };
const largeObstacle = new Set(["4,2"]);
const largeOptions = makeOptions({
  targets: [far],
  positions: { goblin: { x: 1, y: 3 }, far: { x: 10, y: 3 } },
  maxHexes: 3,
});
largeOptions.enemy = largeEnemy;
largeOptions.isLegalCenter = (center) => getCombatantFootprintHexes(largeEnemy, center)
  .every((cell) => inBounds(cell) && !largeObstacle.has(`${cell.x},${cell.y}`));
plan = chooseEnemyMovementFallback(largeOptions);
assert.ok(plan.position, "large enemy finds a movement fallback");
assert.equal(
  getCombatantFootprintHexes(largeEnemy, plan.position).some((cell) => largeObstacle.has(`${cell.x},${cell.y}`)),
  false,
  "large footprint never overlaps a blocked cell",
);

const enemyAiSource = await readFile(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
assert.match(enemyAiSource, /cannot attack this action, closing distance/);
assert.match(enemyAiSource, /cannot find a legal path and holds position/);
const playerAiSource = await readFile(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAiSource, /computeBeeDetour/);
assert.match(playerAiSource, /follows BeeLine path/);
const combatPageSource = await readFile(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPageSource, /chooseLegacyMovementPlan/);
assert.match(combatPageSource, /redirects toward/);

console.log("enemy movement fallback tests passed");
