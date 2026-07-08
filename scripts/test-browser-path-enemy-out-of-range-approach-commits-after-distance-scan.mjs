import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /enemy out-of-range target selected for approach: actor=\$\{enemyLogLabel\} target=\$\{targetLogLabel\} distance=\$\{Math\.round\(currentDistance\)\}ft/,
  "browser path should log selected approach target immediately after out-of-range diagnostics",
);
assert.match(
  source,
  /enemy out-of-range hold overridden for approach:[\s\S]*type: "move"[\s\S]*target: nearestVisibleHostileByDistance\.target/,
  "browser path should not let a selector hold swallow visible hostile approach movement",
);
assert.match(
  source,
  /executeLegacyClosingMovementPlan\([\s\S]*isFlightMovement \? "FLY_TO_RANGE" : "RUN_TO_RANGE"[\s\S]*\)/,
  "browser path should execute approach movement with RUN_TO_RANGE source",
);
assert.match(
  source,
  /scheduleEnemyAIEndTurn\(getMoveDurationMs\(distanceMoved\), isFlightMovement \? "FLY_TO_RANGE" : "RUN_TO_RANGE"\)/,
  "browser path committed run movement should finalize with RUN_TO_RANGE",
);

console.log("browser-path enemy out-of-range approach commit tests passed");
