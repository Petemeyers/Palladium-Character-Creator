import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const start = source.indexOf("const fraidereRoutingFleeAction");
const end = source.indexOf("const preserveTrainingWithstamina", start);
const handler = source.slice(start, end);

assert.match(handler, /executedSurvivalIntent === SURVIVAL_INTENTS\.WITHDRAW_TO_TEAM_CENTER/);
assert.match(handler, /withdraws toward allied formation/);
assert.match(handler, /moves \$\{Math\.round\(survivalMove\.distanceFeet\)\}ft toward team center/);
assert.ok(
  handler.indexOf("findSurvivalIntentDestination({") < handler.indexOf("withdraws toward allied formation"),
  "team-center browser path resolves and executes its destination",
);
assert.match(handler, /setPositions\(nextPositions\)/);
console.log("survival intent team-center browser-path movement test passed");
