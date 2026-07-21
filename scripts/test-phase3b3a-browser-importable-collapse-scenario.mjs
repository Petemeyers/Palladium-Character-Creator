import assert from "node:assert/strict";
import { runPhase3B3ABrowserScenario } from "../src/utils/combat/phase3b3aBrowserScenario.js";

const scenario = runPhase3B3ABrowserScenario();
assert.equal(scenario.importedInBrowser, true);
assert.equal(scenario.staminaBeforeExpenditure, 1);
assert.equal(scenario.staminaAfterForcedExpenditure, 0);
assert.equal(scenario.forcedCollapse, true);
assert.equal(scenario.noVictoryAtCollapse, true);
assert.equal(scenario.grounded, true);
assert.equal(scenario.reciprocalGrapple, true);
assert.equal(scenario.dominantControl, true);
assert.deepEqual(scenario.laterInitiativeTurn, { actorId: "collapsed-knight", received: true, skippedForCollapse: true });
assert.equal(scenario.holdAndRest.canonical, true);
assert.equal(scenario.holdAndRest.recovered, 1);
assert.equal(scenario.holdAndRest.staminaAfter - scenario.holdAndRest.staminaBefore, 1);
assert.equal(scenario.holdAndRest.grappleActive, true);
assert.deepEqual(scenario.holdAndRest.events, [
  "initiative-action-token-created", "grapple-action-selected", "grapple-action-dispatched",
  "grapple-action-resolution-started", "grapple-action-committed", "grapple-action-completed",
]);
assert.equal(scenario.surrenderDemand.canDemand, true);
assert.equal(scenario.surrenderDemand.canonical, true);
assert.equal(scenario.surrenderDemand.offeredState, "offered");

console.log("Phase 3B3A browser-importable collapse scenario passed");
