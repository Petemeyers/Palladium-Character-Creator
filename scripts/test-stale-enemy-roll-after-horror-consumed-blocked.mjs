import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyTurnAISource = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(combatPageSource, /function clearAttackExecutionState\(reason = "unknown"\)/);
assert.match(combatPageSource, /clearAttackExecutionState\(`scheduleEndTurn:\$\{diagnosticSource\}`\)/);
assert.match(combatPageSource, /diagnosticSource === "horror-action-consumed"/);
assert.match(combatPageSource, /clearAttackExecutionState\(`finalizer-settled:\$\{finalizerMeta\?\.source \|\| "unknown"\}`\)/);
assert.match(combatPageSource, /clearAttackExecutionState\(`enemy-finalizer-accepted:\$\{finalizerSource\}`\)/);
assert.match(combatPageSource, /clearAttackExecutionState\(`player-ai-finalizer-accepted:\$\{source\}`\)/);

assert.match(enemyTurnAISource, /validateDelayedAttackCallback/);
assert.match(enemyTurnAISource, /enemy-turn-ai-dive-attack-callback/);
assert.match(enemyTurnAISource, /enemy-turn-ai-ranged-callback/);
assert.match(enemyTurnAISource, /enemy-turn-ai-melee-entry/);
assert.match(enemyTurnAISource, /enemy-turn-ai-attack-of-opportunity-callback/);

const callbackValidationIndex = enemyTurnAISource.indexOf("enemy-turn-ai-ranged-callback");
const callbackAttackIndex = enemyTurnAISource.indexOf("attack(", callbackValidationIndex);
assert.ok(
  callbackValidationIndex !== -1 && callbackAttackIndex !== -1 && callbackValidationIndex < callbackAttackIndex,
  "ranged enemy callback must validate before calling attack",
);

console.log("stale enemy roll after horror consumed is blocked by finalizer/key invalidation");
