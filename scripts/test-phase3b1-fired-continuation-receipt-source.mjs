import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/CombatPage.jsx", "utf8");
const player = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemy = readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");

assert.match(page, /const continuationAuthorization = Object\.freeze\(/);
assert.match(page, /completedActionToken: firedEntry\.completedActionToken/);
assert.match(page, /continuationAuthorization,\s*source/);
assert.match(page, /continuationAuthorization: meta\?\.continuationAuthorization \|\| null/);
assert.match(player, /const continuationAuthorization = context\.continuationAuthorization \|\| null/);
assert.match(enemy, /continuationAuthorization: context\.continuationAuthorization \|\| null/);
assert.match(page, /validateActionContinuationAdmission\(\{/);
assert.match(page, /consumeActionContinuationReceipt\(entry/);
assert.match(page, /actionType,/);

console.log("✅ Phase 3B1 fired continuation receipt source tests passed");
