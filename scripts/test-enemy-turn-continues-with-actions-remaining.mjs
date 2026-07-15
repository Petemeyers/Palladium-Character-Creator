import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const completeCanonicalEnemyAction = \(\{/);
assert.match(source, /remainingActions > 0[\s\S]*authoritativeActive[\s\S]*!explicitPass[\s\S]*!turnEndingEffect[\s\S]*!fighterIncapacitated/);
assert.match(source, /canonical enemy action completion: actor=/);
assert.match(source, /const scheduleCanonicalEnemyContinuation = \(\{/);
assert.match(source, /enemy continuation scheduled: actor=/);
assert.match(source, /enemy continuation deduped: actor=/);
assert.match(source, /buildEnemyContinuationKey\(\{[\s\S]*actorId[\s\S]*turnToken[\s\S]*remainingActionsRevision: remainingActions[\s\S]*recoverySource: source/);
assert.match(source, /enemyActionLockRef\.current = null/);
assert.match(source, /enemy action lock released for canonical continuation/);
assert.match(source, /handleEnemyTurnRef\.current\?\.\(latestFighter, "remaining-action-continuation"/);
assert.match(source, /blockStaleAction\(latestFighter, turnToken, "enemy-remaining-action-continuation"\)/);
assert.match(source, /explicitPassOrTerminalSource = \/pass\|no-actions\|no-action\|no-target\|no-move/);

console.log("enemy turn canonical continuation tests passed");
