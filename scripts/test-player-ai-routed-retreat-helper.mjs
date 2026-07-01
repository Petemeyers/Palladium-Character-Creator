import assert from "node:assert/strict";
import fs from "node:fs";

import { findBestRetreatHex } from "../src/utils/routingSystem.js";
import {
  createPlayerAiActionResult,
  summarizePlayerAiResult,
} from "../src/utils/playerAiTurnResult.js";

const neighbors = (x, y) => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * 5;
const currentPos = { x: 4, y: 4 };
const threat = { x: 5, y: 4 };
const retreat = findBestRetreatHex({
  currentPos,
  threatPositions: [threat],
  maxSteps: 3,
  isHexOccupied: () => false,
  getHexNeighbors: neighbors,
  isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 10 && y < 10,
  calculateDistance: distance,
  gridWidth: 10,
  gridHeight: 10,
});

assert.ok(retreat?.position, "shared routing helper selects a retreat destination");
assert.ok(distance(retreat.position, threat) > distance(currentPos, threat),
  "routed actor moves farther from the threat");

let movedTo = null;
let turnAdvances = 0;
movedTo = retreat.position;
const actionResult = createPlayerAiActionResult("routed-move", { destination: movedTo });
turnAdvances += 1;
assert.equal(summarizePlayerAiResult(actionResult), "routed-move");
assert.equal(actionResult.result, "routed-move", "routed result includes an explicit result string");
assert.equal(summarizePlayerAiResult({ ok: true, acted: true, actionTaken: true }), "acted",
  "result normalization safely handles a missing result/action field");
assert.deepEqual(movedTo, retreat.position);
assert.equal(turnAdvances, 1, "routed movement schedules one turn advance");

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const handlerStart = combatPageSource.indexOf("const handlePlayerAITurn = useCallback");
const handlerEnd = combatPageSource.indexOf("// AI execution adapters", handlerStart);
const playerHandler = combatPageSource.slice(handlerStart, handlerEnd);
assert.match(playerHandler, /getEquistaminadWeapons,\s*findRetreatDestination,/,
  "player AI receives the same live retreat adapter used by combat routing");
assert.match(combatPageSource, /findBestRetreatHex\([\s\S]*calculateDistance,/,
  "live retreat adapter supplies the routing helper's distance dependency");
assert.match(combatPageSource, /movementInfo\?\.action \|\| movementInfo\?\.movementType \|\| "move"/,
  "movement labels safely normalize missing action metadata");

const playerAiSource = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAiSource, /typeof findRetreatDestination !== "function"/,
  "missing retreat dependency resolves through a safe blocked fallback");
assert.match(playerAiSource, /createPlayerAiActionResult\("routed-move"/);
assert.match(playerAiSource, /action: "RETREAT"/,
  "routed movement supplies the action field expected by live movement logging");
assert.match(playerAiSource, /player routed AI flee target selected=/);
assert.equal(playerAiSource.includes("result=failed error=findRetreatDestination is not a function"), false);
assert.equal(playerAiSource.includes("Cannot read properties of undefined (reading 'toLowerCase')"), false);

console.log("player AI routed-retreat helper tests passed");
