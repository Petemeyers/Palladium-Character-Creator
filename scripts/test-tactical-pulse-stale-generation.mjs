import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";

const runtime = createTacticalPulseRuntime({ generationId: 5, combatSession: 1 });
let commits = 0;
const first = resolveTacticalPulse({
  runtime, fighters: [{ id: "actor", team: "party", initiative: 1, currentStamina: 2 }], positions: { actor: { x: 0, y: 0 } },
  planIntent: async ({ generationId, pulseIndex }) => {
    await Promise.resolve();
    runtime.generationId = 6;
    return createTacticalMovementIntent({ intentId: "stale", generationId, actorId: "actor", mode: "walk", reason: "approach", destination: { x: 1, y: 0 }, path: [{ x: 1, y: 0 }], createdAtPulse: pulseIndex });
  },
  commitPosition: () => { commits += 1; return { accepted: true }; },
});
const duplicate = await resolveTacticalPulse({ runtime, fighters: [], positions: {} });
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.reason, "pulse-ownership-overlap");
const stale = await first;
assert.equal(stale.accepted, false);
assert.equal(stale.reason, "stale-pulse-ownership");
assert.equal(commits, 0);
assert.equal(stale.clock.state, "planning");
assert.equal(stale.clock.elapsedSeconds, 0);
assert.equal(stale.events.filter((entry) => entry.eventType === "tactical-pulse-aborted").length, 1);
assert.equal(runtime.ownership, null);
assert.equal(runtime.staminaChargeKeys.size, 0);
console.log("tactical pulse stale-generation and overlap tests passed");
