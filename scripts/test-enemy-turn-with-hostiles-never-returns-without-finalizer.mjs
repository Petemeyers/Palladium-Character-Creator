import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(source, /if \(needsToMoveCloser\) \{/);
assert.match(source, /const noMoveSource = "enemy-ai-no-move-fallback"/);
assert.match(source, /scheduleEndTurn\(0, noMoveSource\)/);
assert.match(source, /return;\s*\}\s*if \(!combatActive\)/);

console.log("enemy turn hostiles finalizer fallback tests passed");
