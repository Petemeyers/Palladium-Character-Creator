import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/CombatPage.jsx", "utf8");
const player = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemy = readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");
const canonical = readFileSync("src/utils/combat/canonicalGrappleExecution.js", "utf8");

assert.match(canonical, /export function createCanonicalGrappleExecutionKey/);
assert.match(page, /const canonicalExecutionKeyResult = createCanonicalGrappleExecutionKey\(/);
assert.match(page, /createGrappleActionExecutionRecord\(\{[\s\S]*executionKey: canonicalExecutionKey/);
assert.match(page, /grapple-plan-canonical-identity-separated/);
assert.match(page, /grapple-plan-canonical-execution-identity-collision-blocked/);
assert.match(page, /record\.opponentId === targetId/);
assert.doesNotMatch(page, /record\.targetId === targetId/);
assert.match(page, /const resolvedActionSequence = Number\([\s\S]*continuationAuthorization\?\.nextActionSequence[\s\S]*requestedActionSequence/);
assert.match(page, /grapple-admission-action-sequence-mutated-blocked/);
assert.match(page, /consumeAuthoritativeActionContinuationReceipt/);
assert.match(page, /fired-continuation-left-pending-after-action-settled/);
assert.match(page, /action-continuation-receipt-turn-audit/);
assert.match(page, /action-continuation-receipt-hop/);
assert.match(player, /dispatchGrappleTurnAction\(player, target, null, armoredAction\.armoredActionPlan, \{/);
assert.match(player, /continuationAuthorization,/);
assert.match(enemy, /executeGrapple\(enemy, target, null, armoredAction\.armoredActionPlan, \{/);
assert.match(enemy, /continuationAuthorization: context\.continuationAuthorization \|\| null/);
assert.doesNotMatch(page, /const inboundContinuationEntry =/);
assert.doesNotMatch(page, /const inboundAttackContinuation =/);

console.log("✅ Phase 3B1 tactical-plan/receipt integration source fixture passed");
