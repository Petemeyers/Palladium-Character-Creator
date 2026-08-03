import assert from "node:assert/strict";
import { createTacticalPostParryRuntime, openTacticalPostParryWindow, progressTacticalPostParryWindows } from "../src/utils/combat/tacticalPostParryWindow.js";
import { defense, fighters, offer, openScenario, assertOne } from "./tactical-post-parry-test-helpers.mjs";

const runtime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1 });
for (const invalid of [
  defense("parry_dominant", { parrySucceeded: false }),
  defense("parry_success"),
  defense("parry_dominant", { parryAttempted: false }),
]) assert.equal(openTacticalPostParryWindow({ runtime, defenseResult: invalid, canonicalOffer: offer(), pulseIndex: 1, fighters: fighters() }).accepted, false);
const scenario = openScenario();
assert.equal(scenario.opened.window.openedAtPulse, 6);
assert.equal(scenario.opened.window.responseDeadlinePulse, 7);
assert.equal(scenario.opened.window.state, "awaiting-selection");
assertOne(scenario.events, "tactical-post-parry-window-created");
assertOne(scenario.events, "tactical-post-parry-response-offered");
await progressTacticalPostParryWindows({ runtime: scenario.runtime, pulseIndex: 7, fighters: scenario.roster, executeCanonicalResponse: () => ({ accepted: true }), onEvent: (event) => scenario.events.push(event) });
assertOne(scenario.events, "tactical-post-parry-window-expired");
assert.equal(scenario.runtime.responderOwnership.size, 0);
console.log("tactical post-parry lifecycle tests passed");
