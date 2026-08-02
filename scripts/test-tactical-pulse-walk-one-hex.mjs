import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";

const actor = { id: "walker", team: "party", initiative: 10, currentStamina: 5 };
const runtime = createTacticalPulseRuntime({ generationId: 1, combatSession: 1 });
const result = await resolveTacticalPulse({
  runtime, fighters: [actor], positions: { walker: { x: 0, y: 0 } },
  planIntent: ({ pulseIndex, generationId }) => createTacticalMovementIntent({
    intentId: `${generationId}:${pulseIndex}:walker`, generationId, actorId: "walker", mode: "walk",
    reason: "approach", destination: { x: 3, y: 0 }, path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], createdAtPulse: pulseIndex,
  }),
});
assert.equal(result.accepted, true);
assert.deepEqual(result.positions.walker, { x: 1, y: 0 });
assert.equal(result.events.filter((entry) => entry.eventType === "tactical-step-committed").length, 1);
assert.ok(result.intents[0].path.length > 0);
assert.equal(result.clock.elapsedSeconds, 1);
console.log("tactical pulse walk one-hex tests passed");
