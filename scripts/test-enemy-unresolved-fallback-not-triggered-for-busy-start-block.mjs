import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /enemyTurnEnteredAIBranchKeyRef/, "enemy turn branch-entry latch should exist");
assert.match(
  source,
  /enemy unresolved fallback skipped because turn never entered AI branch/,
  "busy pre-start blocks should log that unresolved fallback was skipped",
);
assert.match(
  source,
  /reason=busy-start-block/,
  "skipped unresolved fallback diagnostic should identify busy-start-block",
);

const skipIndex = source.indexOf("enemy unresolved fallback skipped because turn never entered AI branch");
const fallbackIndex = source.indexOf('scheduleTurnEnd(0, "enemy-ai-unresolved-turn-fallback")');
assert.ok(skipIndex >= 0 && fallbackIndex > skipIndex, "skip branch must precede unresolved fallback scheduling");

console.log("enemy unresolved fallback busy-start-block skip tests passed");
