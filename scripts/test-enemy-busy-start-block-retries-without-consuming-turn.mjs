import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const skipBlockStart = source.indexOf("if (!enemyTurnEnteredAIBranch)");
const skipBlockEnd = source.indexOf("} else {", skipBlockStart);
const skipBlock = source.slice(skipBlockStart, skipBlockEnd);

assert.ok(skipBlockStart >= 0, "pre-AI unresolved skip branch should exist");
assert.match(skipBlock, /unresolvedEnemyTurnStartKeyRef\.current = null/);
assert.match(skipBlock, /lastEnemyScheduleTurnKeyRef\.current = null/);
assert.match(skipBlock, /processingEnemyTurnRef\.current = false/);
assert.doesNotMatch(
  skipBlock,
  /remainingActions:\s*0|enemy-ai-unresolved-turn-fallback/,
  "busy-start skip must not consume actions or schedule unresolved fallback",
);

console.log("enemy busy-start block retry/no-consume tests passed");
