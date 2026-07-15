import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const recoverAbortedEnemyAction = \(\{/);
assert.match(source, /clearGrapple = false/);
assert.match(source, /grapple continuation aborted: actor=/);
assert.match(source, /reason=\$\{reason\} remainingActions=\$\{remainingActions\} actionLock=/);
assert.match(source, /enemy action recovery: actor=/);
assert.match(source, /\? "retry-action"/);
assert.match(source, /enemyActionLockRef\.current = null/);
assert.match(source, /enemyActionCommittedThisSliceRef\.current = false/);
assert.match(source, /unresolvedEnemyTurnStartKeyRef\.current = null/);
assert.match(source, /enemyTurnEnteredAIBranchKeyRef\.current = null/);
assert.match(source, /scheduleEnemyAIEndTurn\(0, "enemy-action-retry-after-aborted-grapple"\)/);
assert.match(source, /scheduleEnemyAIEndTurn\(0, "enemy-action-aborted-zero-actions"\)/);
assert.match(source, /scheduleEnemyAIEndTurn\(0, "enemy-action-aborted-explicit-pass"\)/);
assert.match(source, /enemy continuation scheduled: actor=/);
assert.match(source, /enemy continuation deduped: actor=/);
assert.match(source, /enemy duplicate pre-action rejected without turn advance: actor=/);
assert.match(source, /String\(callbackValidation\.reason \|\| ""\)\.includes\("target-invalid"\)/);
assert.match(source, /source: "enemy-grapple-finish-callback"[\s\S]*clearGrapple: true/);
assert.match(source, /source: "enemy-grapple-maul-callback"[\s\S]*clearGrapple: true/);

console.log("hawk invalid grapple target recovery tests passed");
