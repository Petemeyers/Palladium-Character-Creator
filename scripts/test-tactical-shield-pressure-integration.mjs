import assert from "node:assert/strict";
import { createDominantControlState, DOMINANT_CONTROL_TYPES } from "../src/utils/combat/dominantOpeningResolution.js";
import { offer, openScenario, selectAndResolve } from "./tactical-post-parry-test-helpers.mjs";
const control = createDominantControlState({ type: DOMINANT_CONTROL_TYPES.SHIELD_PRESSURE, opportunity: offer(), controllerId: "defender", controlledActorId: "attacker" });
assert.equal(control.attackPenalty, -2);
const scenario = openScenario();
assert.equal((await selectAndResolve(scenario, "shield-pressure")).executions.length, 1);
console.log("tactical shield pressure integration tests passed");
