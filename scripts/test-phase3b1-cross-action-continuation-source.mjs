import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/CombatPage.jsx", "utf8");
const receipt = readFileSync("src/utils/combat/actionContinuationReceipt.js", "utf8");
const player = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");

assert.match(page, /createActionContinuationReceipt\(\{/);
assert.match(page, /completedActionType: canonicalResult\.actionType/);
assert.match(page, /completedActionType: "attack"/);
assert.match(page, /continuationAuthorization,/);
assert.match(page, /canonical-grapple-admission-accepted/);
assert.match(page, /canonical-grapple-admission-rejected/);
assert.match(page, /canonical-grapple-admission-recovery-completed/);
assert.match(page, /fired-continuation-left-pending-after-action-return/);
assert.match(page, /non-grapple-grapple-receipt-creation-blocked/);
assert.match(page, /continuation-action-sequence-validated/);
assert.match(page, /continuation-action-sequence-mismatch/);
assert.match(page, /createFiredActionContinuationReceipt:/);
assert.match(page, /completedActionType:\s*"movement"|completedActionType,/);
assert.doesNotMatch(page, /entry\.opponentId !== opponentId/);
assert.doesNotMatch(page, /receipt\?\.opponentId !== opponentId/);
assert.doesNotMatch(page, /const previousExecution = Array\.from\(grappleActionExecutionRegistryRef/);
assert.doesNotMatch(page, /player-grapple-generic-continuation-path-blocked/);
assert.match(receipt, /nextActionSequence: completed \+ 1/);
assert.match(receipt, /consumedByActionToken/);
assert.match(receipt, /consumedByActionType/);
assert.match(receipt, /completedActionCanonical === true/);
assert.match(player, /createFiredActionContinuationReceipt\?\.\(\{/);
assert.match(player, /completedActionType:\s*"movement"/);
assert.match(player, /movementContinuationAdmission/);
assert.match(player, /flankingArmoredAction\.armoredActionPlan,[\s\S]{0,100}movementContinuationAdmission/);

console.log("✅ Phase 3B1 cross-action continuation integration source tests passed");
