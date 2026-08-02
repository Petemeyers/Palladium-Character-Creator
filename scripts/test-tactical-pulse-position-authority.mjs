import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";

const result = await resolveTacticalPulse({
  runtime: createTacticalPulseRuntime({ generationId: 4, combatSession: 1 }),
  fighters: [{ id: "actor", team: "party", initiative: 1, currentStamina: 2, x: 0, y: 0, position: { x: 0, y: 0 } }],
  positions: { actor: { x: 0, y: 0 } }, committedPositions: { actor: { x: 0, y: 0 } },
  planIntent: ({ generationId, pulseIndex }) => createTacticalMovementIntent({ intentId: "position-audit", generationId, actorId: "actor", mode: "walk", reason: "approach", destination: { x: 1, y: 0 }, path: [{ x: 1, y: 0 }], createdAtPulse: pulseIndex }),
  readPositionAuthorities: () => ({
    fighterPosition: { x: 1, y: 0 },
    positionsRefPosition: { x: 1, y: 0 },
    renderedStatePosition: { x: 1, y: 0 },
    committedPosition: { x: 1, y: 0 },
  }),
});
const audit = result.events.find((entry) => entry.eventType === "tactical-pulse-position-authority-audit");
assert.equal(audit.data.matches, true);
assert.equal(audit.data.authorityScope, "external");
assert.equal(audit.data.actors.length, 1);
for (const field of ["fighterPosition", "positionsRefPosition", "renderedStatePosition", "committedPosition"]) {
  assert.deepEqual(audit.data.actors[0][field], { x: 1, y: 0 });
}
assert.notEqual(audit.data.actors[0].positionsRefPosition, audit.data.actors[0].renderedStatePosition);
assert.deepEqual(result.fighters[0].position, result.positions.actor);
assert.deepEqual(result.committedPositions.actor, result.positions.actor);
console.log("tactical pulse position-authority tests passed");
