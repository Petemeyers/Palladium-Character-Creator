import assert from "node:assert/strict";
import fs from "node:fs";
import { findSurvivalIntentDestination } from "../src/utils/routingSystem.js";
import { SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const calculateDistance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const getHexNeighbors = (x, y) => [
  { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
];
const isValidPosition = (x, y, width = 40, height = 30) => x >= 0 && x < width && y >= 0 && y < height;

const currentPos = { x: 20, y: 12 };
const teamCenter = { x: 14, y: 12 };
const move = findSurvivalIntentDestination({
  intent: SURVIVAL_INTENTS.WITHDRAW_TO_TEAM_CENTER,
  context: { teamCenter },
  positions: {},
  currentPos,
  threatPositions: [{ x: 22, y: 12 }],
  maxSteps: 5,
  isHexOccupied: () => false,
  getHexNeighbors,
  isValidPosition: (x, y) => isValidPosition(x, y),
  calculateDistance,
});

assert.ok(move?.position, "reachable allied formation produces a movement destination");
assert.ok(calculateDistance(move.position, teamCenter) < calculateDistance(currentPos, teamCenter));
assert.ok(move.distanceFeet > 0);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /withdraws toward allied formation/);
assert.match(combatPage, /moves \$\{Math\.round\(survivalMove\.distanceFeet\)\}ft toward team center/);
console.log("survival intent team-center movement execution test passed");
