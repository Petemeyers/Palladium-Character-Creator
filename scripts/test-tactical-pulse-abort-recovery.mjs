import assert from "node:assert/strict";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";

const fighter = { id: "walker", team: "party", currentStamina: 5 };
const positions = { walker: { x: 0, y: 0 } };
const planWalk = ({ generationId, pulseIndex }) => createTacticalMovementIntent({
  intentId: `${generationId}:${pulseIndex}:walk`, generationId, actorId: "walker", mode: "walk",
  reason: "approach", destination: { x: 1, y: 0 }, path: [{ x: 1, y: 0 }], createdAtPulse: pulseIndex,
});

const runtime = createTacticalPulseRuntime({ generationId: 21, combatSession: 4 });
const rejected = await resolveTacticalPulse({
  runtime, fighters: [fighter], positions, planIntent: planWalk,
  commitPosition: () => ({ accepted: false, reason: "test-external-rejection" }),
});
assert.equal(rejected.accepted, false);
assert.equal(rejected.reason, "test-external-rejection");
assert.equal(rejected.clock.state, "planning");
assert.equal(rejected.clock.pulseIndex, 0);
assert.equal(rejected.clock.elapsedSeconds, 0);
assert.equal(rejected.clock.cycleIndex, 1);
assert.equal(runtime.ownership, null);
assert.equal(runtime.staminaChargeKeys.size, 0);
assert.equal(rejected.events.filter((entry) => entry.eventType === "tactical-pulse-aborted").length, 1);
assert.ok(rejected.intents.every((intent) => ["canceled", "blocked", "completed"].includes(intent.state)));

const retried = await resolveTacticalPulse({ runtime, fighters: [fighter], positions, planIntent: planWalk });
assert.equal(retried.accepted, true);
assert.equal(retried.clock.elapsedSeconds, 1);

const thrownRuntime = createTacticalPulseRuntime({ generationId: 22, combatSession: 4 });
const thrown = await resolveTacticalPulse({
  runtime: thrownRuntime, fighters: [fighter], positions,
  planIntent: () => { throw new Error("planner exploded"); },
});
assert.equal(thrown.reason, "tactical-pulse-execution-threw");
assert.equal(thrown.clock.state, "planning");
assert.equal(thrown.clock.elapsedSeconds, 0);

const lifecycleRuntime = createTacticalPulseRuntime({ generationId: 23, combatSession: 4 });
const rejectedLifecycle = await resolveTacticalPulse({
  runtime: lifecycleRuntime, fighters: [fighter], positions, planIntent: planWalk,
  transitionClock: (clock) => ({ accepted: false, reason: "test-transition-rejected", clock }),
});
assert.equal(rejectedLifecycle.reason, "test-transition-rejected");
assert.equal(rejectedLifecycle.clock.state, "planning");
assert.equal(rejectedLifecycle.events.some((entry) => entry.eventType === "tactical-pulse-completed"), false);

const completionRuntime = createTacticalPulseRuntime({ generationId: 24, combatSession: 4 });
const rejectedCompletion = await resolveTacticalPulse({
  runtime: completionRuntime, fighters: [fighter], positions, planIntent: planWalk,
  completeClock: (clock) => ({ accepted: false, reason: "test-completion-rejected", clock }),
});
assert.equal(rejectedCompletion.reason, "test-completion-rejected");
assert.equal(rejectedCompletion.clock.state, "planning");
assert.equal(rejectedCompletion.clock.elapsedSeconds, 0);

const internalRuntime = createTacticalPulseRuntime({ generationId: 25, combatSession: 4 });
const rejectedInternal = await resolveTacticalPulse({
  runtime: internalRuntime, fighters: [fighter], positions, planIntent: planWalk,
  commitInternalPosition: () => ({ accepted: false, reason: "test-internal-rejection" }),
});
assert.equal(rejectedInternal.reason, "test-internal-rejection");
assert.equal(rejectedInternal.clock.state, "planning");
assert.equal(rejectedInternal.events.filter((entry) => entry.eventType === "tactical-step-commit-rejected").length, 1);

console.log("tactical pulse abort recovery and lifecycle rejection tests passed");
