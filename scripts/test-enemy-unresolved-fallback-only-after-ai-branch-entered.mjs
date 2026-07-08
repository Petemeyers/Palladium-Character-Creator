import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const entryIndex = source.indexOf("enemyTurnEnteredAIBranchKeyRef.current = key");
const handleIndex = source.indexOf("handleEnemyTurnRef.current?.", entryIndex);
const latchCheckIndex = source.indexOf("enemyTurnEnteredAIBranchKeyRef.current === requestedTurnStartKey");
const fallbackIndex = source.indexOf('scheduleTurnEnd(0, "enemy-ai-unresolved-turn-fallback")', latchCheckIndex);

assert.ok(entryIndex >= 0, "AI branch-entry latch should be set");
assert.ok(handleIndex > entryIndex, "branch-entry latch should be set immediately before handleEnemyTurn");
assert.ok(fallbackIndex > latchCheckIndex, "unresolved fallback should only be reachable inside the branch-entry latch path");
assert.match(
  source,
  /enemyTurnEnteredAIBranchKeyRef\.current === requestedTurnStartKey/,
  "unresolved fallback should check the branch-entry latch",
);

console.log("enemy unresolved fallback AI-branch-entry tests passed");
