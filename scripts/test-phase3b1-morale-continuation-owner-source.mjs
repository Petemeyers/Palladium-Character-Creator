import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(
  combatPage,
  /const ensureContinuationExecutionOwnership = useCallback[\s\S]*?state:\s*"active"[\s\S]*?executionOwner:\s*expectedOwner[\s\S]*?executionStarted:\s*true/,
  "continuation ownership helper should restore active player-ai execution ownership.",
);

assert.match(
  combatPage,
  /eventType:\s*"continuation-execution-owner-restored"/,
  "continuation owner restoration should be logged.",
);

const restoreCalls = [...combatPage.matchAll(/ensureContinuationExecutionOwnership\(\{/g)].length;
assert.ok(restoreCalls >= 2, "both completion-arbiter and attack-spend continuation paths should restore ownership.");

assert.match(
  combatPage,
  /handlePlayerAITurnRef\.current\?\.\(liveActor,\s*\{[\s\S]*?initiativeTurnId:\s*continuationInitiativeTurnId/,
  "player continuation re-entry should preserve initiativeTurnId.",
);

assert.match(
  combatPage,
  /eventType:\s*"continuation-creation-rejected"/,
  "failed continuation owner restoration should reject continuation creation.",
);

console.log("✅ Phase 3B1 morale continuation owner source tests passed");
