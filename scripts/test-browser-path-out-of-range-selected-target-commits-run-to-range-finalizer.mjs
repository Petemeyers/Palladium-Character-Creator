import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /executeLegacyClosingMovementPlan\([\s\S]*isFlightMovement \? "FLY_TO_RANGE" : "RUN_TO_RANGE"[\s\S]*\)/,
  "RUN/FLY approach path should execute through the safe movement planner",
);
assert.match(
  source,
  /enemy approach movement committed:[\s\S]*source=\$\{finalizerSource\}/,
  "approach movement should log its committed finalizer source",
);
assert.match(
  source,
  /scheduleEnemyAIEndTurn\(getMoveDurationMs\(distanceMoved\), finalizerSource\)/,
  "safe movement planner finish should use the accepted enemy finalizer",
);
assert.match(
  source,
  /scheduleEnemyAIEndTurn\(getMoveDurationMs\(distanceMoved\), isFlightMovement \? "FLY_TO_RANGE" : "RUN_TO_RANGE"\)/,
  "direct run fallback should finalize with RUN_TO_RANGE",
);

console.log("browser selected target commits RUN_TO_RANGE finalizer tests passed");
