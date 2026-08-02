import assert from "node:assert/strict";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent, planDefaultTacticalMovement } from "../src/utils/combat/tacticalMovementIntent.js";

const modeCosts = { hold: 0, walk: 0, run: 1, sprint: 2, charge: 2 };
let exactStaminaSpent = 0;
for (const [mode, expectedCost] of Object.entries(modeCosts)) {
  let calls = 0;
  const pathLength = mode === "hold" ? 0 : mode === "walk" ? 1 : mode === "run" ? 2 : 3;
  const path = Array.from({ length: pathLength }, (_, index) => ({ x: index + 1, y: 0 }));
  const result = await resolveTacticalPulse({
    runtime: createTacticalPulseRuntime({ generationId: 70 + calls, combatSession: 1 }),
    fighters: [{ id: `mode-${mode}`, team: "party", currentStamina: 10 }],
    positions: { [`mode-${mode}`]: { x: 0, y: 0 } },
    planIntent: ({ generationId, pulseIndex }) => createTacticalMovementIntent({
      intentId: `mode-${mode}`, generationId, actorId: `mode-${mode}`, mode,
      reason: mode === "hold" ? "hold" : `explicit-${mode}`,
      destination: path.at(-1), path, createdAtPulse: pulseIndex,
    }),
    spendStamina: ({ actor, amount }) => {
      calls += 1;
      exactStaminaSpent += amount;
      return { accepted: true, spent: amount, previousStamina: 10, nextStamina: 10 - amount, updated: { ...actor, currentStamina: 10 - amount } };
    },
  });
  assert.equal(calls, expectedCost > 0 ? 1 : 0, `${mode} stamina callback count`);
  assert.equal(result.events.filter((entry) => entry.eventType === "tactical-movement-stamina-spend-requested").length, expectedCost > 0 ? 1 : 0);
  assert.equal(result.events.filter((entry) => entry.eventType === "tactical-movement-stamina-spend-resolved").length, expectedCost > 0 ? 1 : 0);
  assert.equal(result.events.filter((entry) => entry.eventType === "tactical-movement-stamina-evaluated").length, expectedCost === 0 ? 1 : 0);
}
assert.equal(exactStaminaSpent, 5);

const lowStamina = await resolveTacticalPulse({
  runtime: createTacticalPulseRuntime({ generationId: 8, combatSession: 1 }),
  fighters: [{ id: "tired", team: "party", initiative: 1, currentStamina: 1 }],
  positions: { tired: { x: 0, y: 0 } },
  planIntent: ({ generationId, pulseIndex }) => createTacticalMovementIntent({
    intentId: "tired-sprint", generationId, actorId: "tired", mode: "sprint", reason: "approach",
    destination: { x: 3, y: 0 }, path: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], createdAtPulse: pulseIndex,
  }),
});
assert.equal(lowStamina.events.filter((entry) => entry.eventType === "tactical-movement-mode-downgraded").length, 1);
assert.equal(lowStamina.events.find((entry) => entry.eventType === "tactical-movement-mode-downgraded").data.movementMode, "run");
assert.deepEqual(lowStamina.positions.tired, { x: 2, y: 0 });

const closeRuntime = createTacticalPulseRuntime({ generationId: 9, combatSession: 1 });
const close = await resolveTacticalPulse({
  runtime: closeRuntime,
  fighters: [
    { id: "ready", team: "party", initiative: 2, currentStamina: 3, attacks: [{ reachFeet: 5 }] },
    { id: "target", team: "enemy", initiative: 1, currentStamina: 3, attacks: [{ reachFeet: 5 }] },
  ],
  positions: { ready: { x: 0, y: 0 }, target: { x: 1, y: 0 } },
  planIntent: planDefaultTacticalMovement,
});
assert.equal(close.events.filter((entry) => entry.eventType === "tactical-attack-opportunity-detected").length, 2);
assert.equal(close.events.filter((entry) => entry.eventType === "tactical-step-committed").length, 0);
assert.deepEqual(close.positions, { ready: { x: 0, y: 0 }, target: { x: 1, y: 0 } });

let releasePlanner;
const gate = new Promise((resolve) => { releasePlanner = resolve; });
let spendCalls = 0;
const duplicateRuntime = createTacticalPulseRuntime({ generationId: 10, combatSession: 1 });
const first = resolveTacticalPulse({
  runtime: duplicateRuntime,
  fighters: [{ id: "runner", team: "party", initiative: 1, currentStamina: 3 }],
  positions: { runner: { x: 0, y: 0 } },
  planIntent: async ({ generationId, pulseIndex }) => {
    await gate;
    return createTacticalMovementIntent({ intentId: "one-charge", generationId, actorId: "runner", mode: "run", reason: "approach", destination: { x: 2, y: 0 }, path: [{ x: 1, y: 0 }, { x: 2, y: 0 }], createdAtPulse: pulseIndex });
  },
  spendStamina: ({ actor, amount }) => {
    spendCalls += 1;
    return { accepted: true, spent: amount, previousStamina: 3, nextStamina: 2, updated: { ...actor, currentStamina: 2 } };
  },
});
const duplicate = await resolveTacticalPulse({ runtime: duplicateRuntime, fighters: [], positions: {} });
assert.equal(duplicate.reason, "pulse-ownership-overlap");
releasePlanner();
await first;
assert.equal(spendCalls, 1);
console.log("tactical pulse stamina, duplicate callback, and attack-boundary tests passed");
