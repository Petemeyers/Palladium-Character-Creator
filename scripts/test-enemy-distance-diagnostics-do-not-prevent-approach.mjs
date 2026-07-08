import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(source, /const movementEnemyLabel = formatCombatActorLabel\(enemy/);
assert.match(source, /analyzes movement toward \$\{movementTargetLabel\}/);
assert.match(source, /needsToMoveCloser[\s\S]*chooseEnemyMovementFallback/);
assert.match(source, /cannot attack this action[\s\S]*so it advances/);
assert.match(source, /commitEnemyAction\("RUN_TO_RANGE"\)[\s\S]*scheduleEndTurn\(16, "RUN_TO_RANGE"\)/);

console.log("enemy distance diagnostics approach tests passed");
