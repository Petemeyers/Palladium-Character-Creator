import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /approachFinalizerSource === "enemy-ai-no-move-fallback"[\s\S]*\? 0[\s\S]*Math\.max\(0,/,
  "no-move fallback should zero remaining actions while normal movement spends one action",
);
assert.match(
  source,
  /const noMoveSource = "enemy-ai-no-move-fallback"[\s\S]*remainingActions: 0[\s\S]*scheduleEnemyAIEndTurn\(0, noMoveSource\)/,
  "planner error no-move fallback should zero actions and finalize",
);
assert.match(
  source,
  /Knight \[enemy\] cannot find a movement path and holds position|cannot find a movement path and holds position/,
  "no-move fallback should log hold-position behavior",
);

console.log("enemy no-move fallback consumes action/end-turn tests passed");
