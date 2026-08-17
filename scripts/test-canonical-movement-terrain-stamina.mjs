import assert from "node:assert/strict";
import {
  commitCanonicalMovement,
  createCanonicalMovementRegistry,
} from "../src/utils/combat/canonicalMovementStamina.js";

const actor = {
  id: "slope-test-actor",
  name: "Slope Test Actor",
  currentStamina: 12,
  maxStamina: 12,
};
const registry = createCanonicalMovementRegistry();
const result = commitCanonicalMovement({
  registry,
  actor,
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  path: [{ x: 1, y: 0 }],
  distanceFt: 10,
  movementMode: "walk",
  staminaCost: 2,
  terrainStaminaCost: 1,
  executionKey: "8c6d-terrain-stamina-test",
  spendStamina: ({ actor: current, amount }) => ({
    accepted: true,
    spent: amount,
    previousStamina: current.currentStamina,
    nextStamina: current.currentStamina - amount,
    updated: { ...current, currentStamina: current.currentStamina - amount },
  }),
  commit: () => ({ accepted: true }),
});

assert.equal(result.accepted, true);
assert.equal(result.record.baseStaminaCost, 2);
assert.equal(result.record.terrainStaminaCost, 1);
assert.equal(result.record.staminaCost, 3);
assert.equal(result.record.spent, 3);
assert.equal(result.record.nextStamina, 9);
console.log("PASS canonical movement terrain stamina surcharge");
