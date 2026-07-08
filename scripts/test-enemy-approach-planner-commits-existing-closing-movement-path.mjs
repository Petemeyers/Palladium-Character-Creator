import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const entry = source.indexOf("enemy approach branch entering movement planner");
const block = source.slice(entry, source.indexOf("// Use analyzeMovementAndAttack", entry));

assert.match(block, /chooseEnemyMovementFallback\(/, "approach planner should use existing movement fallback selector");
assert.match(block, /validateEnemyMovementPlan\(/, "approach planner should validate existing movement plan");
assert.match(block, /executeEnemyMovementPlan\(/, "approach planner should execute via existing movement executor");
assert.match(block, /handlePositionChange\(enemy\.id, destination/, "approach movement should persist through existing position-change path");
assert.match(block, /scheduleEnemyAIEndTurn\(getMoveDurationMs\(approachDistanceMoved\), approachFinalizerSource\)/,
  "approach movement should finish through accepted enemy finalizer");

console.log("enemy approach planner existing closing path tests passed");
