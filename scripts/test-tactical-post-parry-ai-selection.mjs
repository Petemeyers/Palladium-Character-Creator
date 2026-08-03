import assert from "node:assert/strict";
import { openScenario } from "./tactical-post-parry-test-helpers.mjs";
const first = openScenario({ controlMode: "ai" });
const second = openScenario({ controlMode: "ai" });
assert.equal(first.opened.window.selectedResponseType, "riposte");
assert.equal(second.opened.window.selectedResponseType, first.opened.window.selectedResponseType);
assert.equal(first.runtime.executionKeys.size, 0, "AI selection does not execute in offer stack");
console.log("tactical post-parry AI selection tests passed");
