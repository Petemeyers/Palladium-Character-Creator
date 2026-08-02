import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";

const fighters = [
  { id: "alpha", team: "party", initiative: 99, initiativeTotal: 8, initiativeRank: 2, currentStamina: 3 },
  { id: "bravo", team: "enemy", initiative: 1, initiativeTotal: 12, initiativeRank: 1, currentStamina: 3 },
];
const positions = { alpha: { x: 0, y: 0 }, bravo: { x: 2, y: 0 } };
const result = await resolveTacticalPulse({
  runtime: createTacticalPulseRuntime({ generationId: 3, combatSession: 1 }), fighters, positions,
  planIntent: ({ actor, generationId, pulseIndex }) => createTacticalMovementIntent({
    intentId: `${generationId}:${pulseIndex}:${actor.id}`, generationId, actorId: actor.id, mode: "walk", reason: "approach",
    destination: { x: 1, y: 0 }, path: [{ x: 1, y: 0 }], createdAtPulse: pulseIndex,
  }),
});
assert.deepEqual(result.positions.alpha, { x: 0, y: 0 });
assert.deepEqual(result.positions.bravo, { x: 1, y: 0 });
const conflict = result.events.find((entry) => entry.eventType === "tactical-step-conflict");
assert.equal(conflict.data.winnerActorId, "bravo");
assert.equal(result.events.filter((entry) => entry.eventType === "tactical-step-blocked").length, 1);
console.log("tactical pulse movement-conflict tests passed");
