import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /\} catch \(error\) \{[\s\S]*const noMoveSource = "enemy-ai-no-move-fallback"[\s\S]*enemy approach movement planner error/,
  "approach planner catch should log targeted planner error",
);
assert.match(
  source,
  /commitEnemyAction\(noMoveSource\)[\s\S]*remainingActions: 0[\s\S]*scheduleEnemyAIEndTurn\(0, noMoveSource\)/,
  "approach planner catch should consume/pass and finalize no-move fallback",
);

console.log("enemy approach planner error fallback tests passed");
