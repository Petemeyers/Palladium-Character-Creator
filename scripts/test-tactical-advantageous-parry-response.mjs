import assert from "node:assert/strict";
import { openScenario, selectAndResolve } from "./tactical-post-parry-test-helpers.mjs";
const scenario = openScenario({ quality: "parry_advantage" });
assert.deepEqual(scenario.opened.window.legalResponseTypes, ["riposte", "decline"]);
const result = await selectAndResolve(scenario, "riposte");
assert.equal(result.executions.length, 1);
assert.equal(result.executions[0].canonicalResponseType, "riposte");
console.log("tactical advantageous parry response tests passed");
