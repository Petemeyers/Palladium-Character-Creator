import assert from "node:assert/strict";
import { submitTacticalPostParryResponse, progressTacticalPostParryWindows } from "../src/utils/combat/tacticalPostParryWindow.js";
import { openScenario } from "./tactical-post-parry-test-helpers.mjs";

for (const [field, value, reason] of [["generationId", 2, "stale-generation"], ["combatSession", 2, "stale-combat-session"]]) {
  const scenario = openScenario();
  const window = scenario.opened.window;
  const submitted = submitTacticalPostParryResponse({ runtime: scenario.runtime, tacticalPostParryWindowId: window.tacticalPostParryWindowId, responderId: "defender", responseType: "bind", pulseIndex: 6, generationId: 1, combatSession: 1, [field]: value });
  assert.equal(submitted.reason, reason);
  assert.equal(window.selectedResponseType, null);
}
const changed = openScenario();
const selected = submitTacticalPostParryResponse({ runtime: changed.runtime, tacticalPostParryWindowId: changed.opened.window.tacticalPostParryWindowId, responderId: "defender", responseType: "bind", pulseIndex: 6 });
assert.equal(selected.accepted, true);
let executions = 0;
let canonicalInvalidations = 0;
await progressTacticalPostParryWindows({ runtime: changed.runtime, pulseIndex: 7, fighters: changed.roster, validateResponse: () => ({ valid: false, reason: "parrying-weapon-changed" }), executeCanonicalResponse: (admission) => { if (admission.invalidation) canonicalInvalidations += 1; else executions += 1; return { accepted: true }; } });
assert.equal(executions, 0);
assert.equal(canonicalInvalidations, 1, "invalid selection terminates the canonical offer");
assert.equal(changed.runtime.terminalHistory.at(-1).terminalReason, "parrying-weapon-changed");
assert.equal(submitTacticalPostParryResponse({ runtime: changed.runtime, tacticalPostParryWindowId: changed.opened.window.tacticalPostParryWindowId, responderId: "defender", responseType: "riposte", pulseIndex: 7 }).accepted, false, "consumed offer grants no replacement choice");
console.log("tactical post-parry stale ownership tests passed");
