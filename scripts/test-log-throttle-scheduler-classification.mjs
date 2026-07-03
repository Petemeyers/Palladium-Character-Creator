import assert from "node:assert/strict";
import fs from "node:fs";

import { shouldLogTurnSchedulerClassification } from "../src/utils/turnSchedulerLogThrottle.js";

assert.equal(shouldLogTurnSchedulerClassification(null, "turn-1|ai|player"), true);
assert.equal(shouldLogTurnSchedulerClassification("turn-1|ai|player", "turn-1|ai|player"), false);
assert.equal(shouldLogTurnSchedulerClassification("turn-1|ai|player", "turn-2|ai|player"), true);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /shouldLogTurnSchedulerClassification\(/);
assert.match(source, /lastTurnSchedulerClassificationKeyRef\.current = schedulerClassificationKey/);
assert.match(source, /handlePlayerAITurn before runPlayerTurnAI fighter=/,
  "classification throttling does not remove executor traces");
assert.match(source, /sanitizeCombatLogMessage\(message\)/,
  "scheduler and executor traces pass through the readable browser-log boundary");

console.log("scheduler-classification log-throttle tests passed");
