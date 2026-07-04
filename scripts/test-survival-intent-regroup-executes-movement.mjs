import assert from "node:assert/strict";
import fs from "node:fs";
import { findSurvivalIntentDestination } from "../src/utils/routingSystem.js";
import { SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const calculateDistance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const getHexNeighbors = (x, y) => [
  { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
];
const isValidPosition = (x, y, width = 40, height = 30) => x >= 0 && x < width && y >= 0 && y < height;

const currentPos = { x: 10, y: 10 };
const allyPos = { x: 14, y: 10 };
const threatPos = { x: 8, y: 10 };
const move = findSurvivalIntentDestination({
  intent: SURVIVAL_INTENTS.REGROUP_WITH_ALLY,
  context: { nearbyAllies: [{ id: "ally", name: "Goblin Warrior #1" }] },
  positions: { ally: allyPos },
  currentPos,
  threatPositions: [threatPos],
  maxSteps: 4,
  isHexOccupied: (x, y) => x === allyPos.x && y === allyPos.y,
  getHexNeighbors,
  isValidPosition: (x, y) => isValidPosition(x, y),
  calculateDistance,
});

assert.ok(move?.position, "reachable ally support produces a movement destination");
assert.ok(calculateDistance(move.position, allyPos) < calculateDistance(currentPos, allyPos));
assert.ok(move.distanceFeet > 0, "regroup consumes actual movement distance");

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /moves \$\{Math\.round\(survivalMove\.distanceFeet\)\}ft toward ally support/);
const routingHandler = combatPage.slice(combatPage.indexOf("const fraidereRoutingFleeAction"), combatPage.indexOf("const preserveTrainingWithstamina"));
assert.doesNotMatch(routingHandler, /isValidPosition: \(x, y\) => isValidPosition\(x, y, combatTerrain\)/);
console.log("survival intent regroup movement execution test passed");
