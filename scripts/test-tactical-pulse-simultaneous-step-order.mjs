import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";

const fighters = [
  { id: "runner-a", team: "party", initiative: 10, currentStamina: 5 },
  { id: "runner-b", team: "enemy", initiative: 9, currentStamina: 5 },
  { id: "sprinter", team: "party", initiative: 8, currentStamina: 5 },
  { id: "charger", team: "enemy", initiative: 7, currentStamina: 5 },
];
const paths = {
  "runner-a": [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  "runner-b": [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 13, y: 2 }],
  sprinter: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }],
  charger: [{ x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }],
};
const modes = { "runner-a": "run", "runner-b": "run", sprinter: "sprint", charger: "charge" };
const positions = { "runner-a": { x: 0, y: 0 }, "runner-b": { x: 10, y: 2 }, sprinter: { x: 0, y: 4 }, charger: { x: 10, y: 6 } };
const result = await resolveTacticalPulse({
  runtime: createTacticalPulseRuntime({ generationId: 2, combatSession: 1 }), fighters, positions,
  planIntent: ({ actor, generationId, pulseIndex }) => createTacticalMovementIntent({
    intentId: `${generationId}:${pulseIndex}:${actor.id}`, generationId, actorId: actor.id, mode: modes[actor.id], reason: "approach",
    destination: paths[actor.id].at(-1), path: paths[actor.id], createdAtPulse: pulseIndex,
  }),
});
const committed = result.events.filter((entry) => entry.eventType === "tactical-step-committed");
assert.equal(committed.filter((entry) => entry.data.actorId === "runner-a").length, 2);
assert.equal(committed.filter((entry) => entry.data.actorId === "runner-b").length, 2);
assert.equal(committed.filter((entry) => entry.data.actorId === "sprinter").length, 3);
assert.equal(committed.filter((entry) => entry.data.actorId === "charger").length, 3);
const lastPassOne = Math.max(...committed.map((entry, index) => entry.data.stepPass === 1 ? index : -1));
const firstPassTwo = committed.findIndex((entry) => entry.data.stepPass === 2);
assert.ok(firstPassTwo > lastPassOne);
console.log("tactical pulse simultaneous step-order tests passed");
