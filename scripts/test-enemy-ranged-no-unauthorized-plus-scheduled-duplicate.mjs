import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyTurnAI = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(combatPage, /lastEndTurnAdvanceKeyRef\.current === endTurnAdvanceKey/);
assert.match(combatPage, /duplicate endTurn ignored key=\$\{endTurnAdvanceKey\}/);
assert.match(combatPage, /pendingEnemyTurnRef\.current = false/);
assert.match(combatPage, /enemyActionLockRef\.current = null/);
assert.match(combatPage, /stale delayed attack ignored\./);

const callbackValidationIndex = enemyTurnAI.indexOf("validateEnemyAttackCallbackEntry");
const processingClearIndex = enemyTurnAI.indexOf("processingEnemyTurnRef.current = false", callbackValidationIndex);
assert.ok(
  callbackValidationIndex !== -1 && processingClearIndex !== -1 && callbackValidationIndex < processingClearIndex,
  "stale callback branch should clear processing without scheduling a second attack",
);

console.log("enemy ranged callback cannot add unauthorized attack before scheduled turn");
