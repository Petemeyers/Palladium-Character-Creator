import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /if \(needsToMoveCloser\) \{[\s\S]*const noMoveSource = "enemy-ai-no-move-fallback"[\s\S]*scheduleEnemyAIEndTurn\(0, noMoveSource\)[\s\S]*return;/,
  "inline browser branch should have a no-move fallback finalizer after failed movement planning",
);
assert.match(
  source,
  /if \(!closingHex\) \{[\s\S]*const noMoveSource = "enemy-ai-no-move-fallback"[\s\S]*scheduleEnemyAIEndTurn\(0, noMoveSource\)[\s\S]*return false;/,
  "closing movement with no legal path should finalize as enemy-ai-no-move-fallback",
);
assert.doesNotMatch(
  source,
  /needsToMoveCloser[\s\S]{0,600}scheduleEndTurn\(\)/,
  "out-of-range live branch should avoid generic no-source finalizers near movement fallback",
);

console.log("enemy out-of-range live branch finalizer tests passed");
