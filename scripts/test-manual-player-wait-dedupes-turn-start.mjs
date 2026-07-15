import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const isManualWaitingPath =[\s\S]*isPlayableTurnFighter[\s\S]*!usesPlayerAIPath[\s\S]*\(controlMode === "manual" \|\| controlMode === "player"\)/);
assert.match(source, /manualPlayerWaitTurnKeyRef\.current === requestedTurnStartKey/);
assert.match(source, /manual player turn already waiting: actor=/);
assert.match(source, /return false;[\s\S]*usesEnemyAIPath &&[\s\S]*unresolvedEnemyTurnStartKeyRef/);
assert.match(source, /manualPlayerWaitTurnKeyRef\.current = manualTurnKey/);

console.log("manual player wait turn-start dedupe tests passed");
