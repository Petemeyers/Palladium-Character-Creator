import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /const scheduleTurnEnd = scheduleEndTurnRef\.current \|\| scheduleEndTurn;\s*scheduleTurnEnd\(0, "enemy-ai-unresolved-turn-fallback"\);/,
  "unresolved no-action enemy turn should schedule enemy-ai-unresolved-turn-fallback",
);
assert.match(
  source,
  /unresolvedEnemyTurnStartKeyRef\.current = null;[\s\S]*processingEnemyTurnRef\.current = false;[\s\S]*const scheduleTurnEnd/,
  "unresolved fallback should clear unresolved/processing state before finalizing",
);
assert.match(
  source,
  /!enemyActionCommittedThisSliceRef\.current[\s\S]*!enemyTurnTimerRef\.current[\s\S]*!pendingTurnAdvanceRef\.current[\s\S]*!isActionBusy\(\)/,
  "unresolved fallback should only fire when no enemy work is pending",
);

console.log("enemy unresolved turn fallback finalizer tests passed");
