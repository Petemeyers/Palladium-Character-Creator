import assert from "node:assert/strict";
import { findSurvivalIntentDestination } from "../src/utils/routingSystem.js";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const leader = { id: "captain", name: "Captain", aiRole: "commander" };
const result = chooseSurvivalIntent({
  fighter: { id: "soldier", state: { moraleState: "routed" } },
  routed: true,
  nearbyLeader: leader,
  nearbyAllies: [leader],
});
assert.equal(result.intent, SURVIVAL_INTENTS.FALL_BACK_TO_LEADER);
const currentPos = { x: 10, y: 10 };
const leaderPos = { x: 14, y: 10 };
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const move = findSurvivalIntentDestination({
  intent: result.intent,
  context: { nearbyLeader: leader },
  positions: { [leader.id]: leaderPos },
  currentPos,
  threatPositions: [{ x: 8, y: 10 }],
  maxSteps: 3,
  isHexOccupied: (x, y) => x === leaderPos.x && y === leaderPos.y,
  getHexNeighbors: (x, y) => [
    { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
  ],
  isValidPosition: (x, y) => x >= 0 && x < 40 && y >= 0 && y < 30,
  calculateDistance: distance,
});
assert.ok(move?.position, "reachable leader produces a fallback destination");
assert.ok(distance(move.position, leaderPos) < distance(currentPos, leaderPos));
console.log("survival intent leader fallback test passed");
