import assert from "node:assert/strict";
import { cleanupTacticalPostParryRuntime, progressTacticalPostParryWindows } from "../src/utils/combat/tacticalPostParryWindow.js";
import { openScenario } from "./tactical-post-parry-test-helpers.mjs";
for (const actorOverrides of [{ defender: { currentHP: 0 } }, { attacker: { currentHP: 0 } }]) {
  const scenario = openScenario();
  scenario.roster = scenario.roster.map((actor) => actor.id === Object.keys(actorOverrides)[0] ? { ...actor, ...Object.values(actorOverrides)[0] } : actor);
  await progressTacticalPostParryWindows({ runtime: scenario.runtime, pulseIndex: 7, fighters: scenario.roster, executeCanonicalResponse: () => assert.fail("terminal response executed") });
  assert.equal(scenario.runtime.terminalHistory.at(-1).state, "invalidated");
}
const scenario = openScenario();
const cleanup = cleanupTacticalPostParryRuntime(scenario.runtime, "combat-ended");
assert.equal(cleanup.data.matches, true);
assert.equal(cleanup.data.responseOwnershipCount, 1);
assert.equal((await progressTacticalPostParryWindows({ runtime: scenario.runtime, pulseIndex: 7, fighters: scenario.roster })).accepted, false);
assert.equal(scenario.runtime.postTerminalExecutionsBlocked, 1);
assert.equal(scenario.runtime.executionKeys.size, 0);
assert.equal(scenario.runtime.windowBySourceResponse.size, 0);
console.log("tactical post-parry terminal cleanup tests passed");
