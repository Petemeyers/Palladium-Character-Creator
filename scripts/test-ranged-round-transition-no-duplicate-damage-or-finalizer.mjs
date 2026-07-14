import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyTurnAI = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(combatPage, /duplicate endTurn ignored key=\$\{endTurnAdvanceKey\}/);
assert.match(combatPage, /duplicate turn finalizer ignored fighter=\$\{liveEnemy\.name\} source=\$\{finalizerSource\}/);
assert.match(combatPage, /clearAttackExecutionState\(`finalizer-settled:\$\{finalizerMeta\?\.source \|\| "unknown"\}`\)/);
assert.match(combatPage, /clearAttackExecutionState\(`new-melee-round:\$\{nextRoundNumber\}`\)/);
assert.match(combatPage, /active-fighter-mismatch/);
assert.match(combatPage, /execution-key-round-stale/);

const rangedAttackIndex = enemyTurnAI.indexOf('source: "enemy-turn-ai-ranged-attack"');
const processingClearIndex = enemyTurnAI.indexOf("processingEnemyTurnRef.current = false", rangedAttackIndex);
const scheduleIndex = enemyTurnAI.indexOf("scheduleEndTurn", rangedAttackIndex);
assert.ok(rangedAttackIndex !== -1 && processingClearIndex > rangedAttackIndex);
assert.ok(
  scheduleIndex === -1 || scheduleIndex > processingClearIndex,
  "ranged callback should not schedule a duplicate finalizer immediately after attack invocation",
);

console.log("ranged round transitions guard duplicate damage/finalizer/skipped actor");
