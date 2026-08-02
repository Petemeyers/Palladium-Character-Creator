import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";

const fighters = [];
const positions = {};
for (let index = 0; index < 42; index += 1) {
  const id = `actor-${String(index).padStart(2, "0")}`;
  const column = Math.floor(index / 6) * 5;
  const row = (index % 6) * 4;
  fighters.push({ id, team: index % 2 ? "enemy" : "party", initiative: 42 - index, currentStamina: 10 });
  positions[id] = { x: column, y: row };
}
let staminaCalls = 0;
const result = await resolveTacticalPulse({
  runtime: createTacticalPulseRuntime({ generationId: 11, combatSession: 2 }), fighters, positions,
  planIntent: ({ actor, generationId, pulseIndex }) => {
    const from = positions[actor.id];
    return createTacticalMovementIntent({
      intentId: `${generationId}:${pulseIndex}:${actor.id}`, generationId, actorId: actor.id, mode: "run", reason: "approach",
      destination: { x: from.x + 2, y: from.y }, path: [{ x: from.x + 1, y: from.y }, { x: from.x + 2, y: from.y }], createdAtPulse: pulseIndex,
    });
  },
  spendStamina: ({ actor, amount }) => {
    staminaCalls += 1;
    return { accepted: true, spent: amount, previousStamina: 10, nextStamina: 9, updated: { ...actor, currentStamina: 9 } };
  },
});
assert.equal(result.accepted, true);
assert.equal(result.intents.length, 42);
assert.equal(result.events.filter((entry) => entry.eventType === "tactical-step-committed").length, 84);
assert.equal(staminaCalls, 42);
assert.equal(result.events.filter((entry) => entry.eventType === "tactical-movement-stamina-spend-requested").length, 42);
assert.equal(result.events.filter((entry) => entry.eventType === "tactical-movement-stamina-spend-resolved").length, 42);
assert.equal(result.events.filter((entry) => entry.eventType === "tactical-pulse-position-authority-audit")[0].data.matches, true);
assert.equal(result.clock.elapsedSeconds, 1);
for (const fighter of fighters) {
  const from = positions[fighter.id];
  const to = result.positions[fighter.id];
  assert.equal(Math.abs(to.x - from.x), 2, `${fighter.id} must move only two 5-foot hexes`);
}
console.log("tactical pulse 42-actor ownership tests passed");
