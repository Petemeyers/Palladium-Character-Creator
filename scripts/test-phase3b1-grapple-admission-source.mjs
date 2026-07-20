import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/CombatPage.jsx", "utf8");
const player = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemy = readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");

assert.match(page, /const consumeGrappleContinuationAuthorization = useCallback/);
assert.match(page, /consumeActionContinuationReceipt\(entry/);
assert.match(page, /continuationKey: continuationAuthorization\?\.continuationKey/);
assert.match(page, /eventType: "grapple-continuation-authorization-consumed"/);
assert.match(page, /completedActionCanonical: previousCompletionFound/);
assert.doesNotMatch(page, /entry\.opponentId !== opponentId/);
assert.match(player, /const continuationKey = context\.continuationKey \|\| null/);
assert.match(enemy, /continuationKey: context\.continuationKey \|\| null/);
assert.match(page, /const launchedGrapple = executeCanonicalGrappleAction\(\{[\s\S]*?actionType: preferredAction,[\s\S]*?continuationAuthorization: admission\?\.continuationAuthorization \|\| null/);

console.log("✅ Phase 3B1 grapple admission source tests passed");
