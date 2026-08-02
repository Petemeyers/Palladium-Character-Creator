import assert from "node:assert/strict";
import { planDefaultTacticalMovement } from "../src/utils/combat/tacticalMovementIntent.js";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";

const actor = { _id: "legacy-actor", team: "party", currentStamina: 4 };
const target = { _id: "legacy-target", team: "enemy", currentStamina: 4 };
const positions = { "legacy-actor": { x: 0, y: 0 }, "legacy-target": { x: 5, y: 0 } };
const planned = planDefaultTacticalMovement({
  actor, fighters: [actor, target], positions, pulseIndex: 1, generationId: 31,
});
assert.equal(planned.accepted, true);
assert.equal(planned.intent.actorId, "legacy-actor");
assert.equal(planned.intent.targetActorId, "legacy-target");
assert.equal(planned.intent.mode, "walk");
assert.ok(planned.intent.path.length > 1);

const moved = await resolveTacticalPulse({
  runtime: createTacticalPulseRuntime({ generationId: 31, combatSession: 5 }),
  fighters: [actor, target], positions,
  isCombatCapable: (candidate) => candidate._id === "legacy-actor",
  planIntent: planDefaultTacticalMovement,
});
assert.equal(moved.accepted, true);
assert.equal(moved.intents[0].actorId, "legacy-actor");
assert.equal(moved.intents[0].targetActorId, "legacy-target");
assert.deepEqual(moved.fighters.find((candidate) => candidate._id === "legacy-actor").position, moved.positions["legacy-actor"]);
assert.equal(moved.events.filter((entry) => entry.eventType === "tactical-step-committed").length, 1);

const historyRuntime = createTacticalPulseRuntime({ generationId: 32, combatSession: 5 });
for (let pulse = 0; pulse < 20; pulse += 1) {
  const result = await resolveTacticalPulse({
    runtime: historyRuntime,
    fighters: [{ id: "holder", team: "party", currentStamina: 1 }],
    positions: { holder: { x: 0, y: 0 } },
    planIntent: ({ generationId, pulseIndex }) => ({
      intentId: `${generationId}:${pulseIndex}:hold`, generationId, actorId: "holder", mode: "hold",
      reason: "hold", path: [], createdAtPulse: pulseIndex,
    }),
  });
  assert.equal(result.accepted, true);
}
assert.ok(historyRuntime.completedOwnershipKeys.size <= 12);
assert.equal(historyRuntime.staminaChargeKeys.size, 0);

console.log("tactical pulse default-walk, canonical identity, and bounded-history tests passed");
