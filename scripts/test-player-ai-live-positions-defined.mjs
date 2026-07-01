import assert from "node:assert/strict";
import fs from "node:fs";

import { canTargetForAction } from "../src/utils/factionDisposition.js";
import { resolvePlayerAiLivePositions } from "../src/utils/playerAiLivePositions.js";
import { createPlayerAiActionResult, summarizePlayerAiResult } from "../src/utils/playerAiTurnResult.js";

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const handlerStart = combatPageSource.indexOf("const handlePlayerAITurn = useCallback");
const handlerEnd = combatPageSource.indexOf("// AI execution adapters", handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "player AI handler source is present");
const playerAiHandlerSource = combatPageSource.slice(handlerStart, handlerEnd);
assert.equal(/\blivePositions\b/.test(playerAiHandlerSource), false,
  "player AI handler contains no undefined enemy-scope livePositions reference");
assert.match(playerAiHandlerSource, /resolvePlayerAiLivePositions\(positionsRef\.current, positions\)/);
assert.match(playerAiHandlerSource, /positions:\s*positionsForAI/);
assert.match(playerAiHandlerSource, /await awaitPlayerAiTurnResult\(/,
  "player AI startup awaits its executor before evaluating completion");
assert.equal(playerAiHandlerSource.includes("[object Promise]"), false);
assert.equal(playerAiHandlerSource.includes("occText is not defined"), false);

const staleDeployment = {
  "party-spearman": { x: 0, y: 0 },
  "enemy-knight": { x: 8, y: 8 },
};
const liveBoard = {
  "party-spearman": { x: 4, y: 4 },
  "enemy-knight": { x: 5, y: 4 },
};
const positions = resolvePlayerAiLivePositions(liveBoard, staleDeployment);
assert.equal(positions, liveBoard, "player AI receives the authoritative live position map");
assert.equal(Object.keys(positions).length, 2, "player AI position payload is non-empty");

const spearman = { id: "party-spearman", team: "party", type: "player" };
const knight = { id: "enemy-knight", team: "enemy", type: "enemy" };
assert.equal(canTargetForAction(spearman, knight, "attack"), true);
const distanceFeet = Math.hypot(
  positions[spearman.id].x - positions[knight.id].x,
  positions[spearman.id].y - positions[knight.id].y,
) * 5;
assert.equal(distanceFeet, 5, "live positions expose a legal adjacent attack decision");

let aiExecutions = 0;
let turnAdvances = 0;
if (canTargetForAction(spearman, knight, "attack") && distanceFeet <= 5) {
  aiExecutions += 1;
  turnAdvances += 1;
}
assert.equal(aiExecutions, 1);
assert.equal(turnAdvances, 1, "a legal player AI action can hand off to turn advancement");
assert.equal(
  summarizePlayerAiResult(createPlayerAiActionResult("move", { movement: "approach" })),
  "move",
  "a live-position approach move cannot be mislabeled no-action",
);

console.log("player AI live-position tests passed");
