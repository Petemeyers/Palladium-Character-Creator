import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const start = source.indexOf("const fraidereRoutingFleeAction");
const end = source.indexOf("const preserveTrainingWithstamina", start);
const handler = source.slice(start, end);

const resolveIndex = handler.indexOf("findSurvivalIntentDestination({");
const movementIndex = handler.indexOf("commitAuthoritativeCombatPosition(fighter.id, destination");
const cowerIndex = handler.indexOf("cannot find a safe ${fallbackLabel} path and cowers in place");
assert.ok(resolveIndex >= 0 && resolveIndex < movementIndex, "browser route resolves a destination before movement");
assert.ok(movementIndex < cowerIndex, "reachable movement executes before the cower fallback");
assert.match(handler, /executedSurvivalIntent === SURVIVAL_INTENTS\.REGROUP_WITH_ALLY/);
assert.match(handler, /falls back toward \$\{allyName \|\| "the nearest ally"\}/);
assert.match(handler, /moves \$\{Math\.round\(survivalMove\.distanceFeet\)\}ft toward ally support/);
assert.doesNotMatch(handler, /isValidPosition\(x, y, combatTerrain\)/);
console.log("survival intent regroup browser-path movement test passed");
