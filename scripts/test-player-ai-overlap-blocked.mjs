import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const playerAIExecutionRef = useRef\(null\)/);
assert.match(source, /const executionOwnership = createPlayerAiExecutionOwnership\(/);
assert.match(source, /if \(playerAIExecutionRef\.current\?\.executionKey\) \{/);
assert.match(source, /if \(prior\.fighterId === startFighterId\) \{/);
assert.match(source, /player AI overlap blocked: actor=\$\{playerAiActingActorLabel\} existing=\$\{prior\.executionKey\} attempted=\$\{executionOwnership\.executionKey\}/);
assert.match(source, /processingPlayerAIRef\.current = false;\s+if \(playerTurnInFlightKeyRef\.current === turnKey\) playerTurnInFlightKeyRef\.current = null;\s+return;/);
assert.match(source, /prior\.settle\?\.\(\{ kind: "superseded", reason: "newer-execution" \}\)/);
assert.match(source, /stale player AI execution ignored fighter=/);

const overlapIndex = source.indexOf("player AI overlap blocked:");
const runIndex = source.indexOf("handlePlayerAITurn before runPlayerTurnAI", overlapIndex);
assert.ok(overlapIndex > -1, "overlap diagnostic should exist");
assert.ok(runIndex > overlapIndex, "overlap guard should run before runPlayerTurnAI starts");

console.log("player AI overlap block tests passed");
