import assert from "node:assert/strict";
import fs from "node:fs";
import {
  chooseRoutingSurvivalIntent,
  findSurvivalIntentDestination,
} from "../src/utils/routingSystem.js";
import { SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const fighter = { id: "goblin-1", name: "Goblin #1", team: "goblins", state: { moraleState: "routed" } };
const ally = { id: "goblin-2", name: "Goblin #2", team: "goblins", currentHP: 8, maxHP: 8 };
const enemy = { id: "knight", name: "Knight", team: "party", aggression: "hostile", currentHP: 20, maxHP: 20 };
const positions = {
  [fighter.id]: { x: 5, y: 5 },
  [ally.id]: { x: 7, y: 5 },
  [enemy.id]: { x: 4, y: 5 },
};
const calculateDistance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const result = chooseRoutingSurvivalIntent({ actor: fighter, fighters: [fighter, ally, enemy], positions, calculateDistance });
assert.equal(result.intent, SURVIVAL_INTENTS.REGROUP_WITH_ALLY);
const getHexNeighbors = (x, y) => [
  { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
];
const destination = findSurvivalIntentDestination({
  intent: result.intent,
  context: result.context,
  positions,
  currentPos: positions[fighter.id],
  threatPositions: [positions[enemy.id]],
  maxSteps: 2,
  isHexOccupied: (x, y) => x === positions[ally.id].x && y === positions[ally.id].y,
  getHexNeighbors,
  isValidPosition: (x, y) => x >= 0 && x < 12 && y >= 0 && y < 12,
  calculateDistance,
});
assert.ok(destination.position.x > positions[fighter.id].x, "regroup movement heads toward the ally");
assert.ok(destination.position.x > 0 && destination.position.x < 11, "regroup does not select a map edge");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("const fraidereRoutingFleeAction"), source.indexOf("const preserveTrainingWithstamina"));
assert.ok(handler.indexOf("chooseRoutingSurvivalIntent") < handler.indexOf("getClosestEscapeEdgeHex"));
assert.match(handler, /survivalIntent !== SURVIVAL_INTENTS\.PANIC_FLEE_TO_EDGE/);
console.log("routing survival-intent-before-map-edge test passed");
