import assert from "node:assert/strict";
import { spendStamina } from "../src/utils/combatStamina.js";
import {
  calculateRoutedMovementStaminaCost,
  resolvePanicFleeStaminaSpend,
  SURVIVAL_INTENTS,
} from "../src/utils/survivalIntent.js";

const fighter = { currentStamina: 10, maxStamina: 10 };
const cost = calculateRoutedMovementStaminaCost({ fighter, distanceFeet: 30, movementType: "panic-run", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE });
const result = spendStamina(fighter, cost);
assert.equal(cost, 3);
assert.equal(result.currentStamina, 7);
const compatibilityResult = spendStamina({
  staminaAuthority: "legacy-current",
  fatigueState: { currentStamina: 6, maxStamina: 8 },
  currentstamina: 6,
  maxstamina: 8,
}, 3);
assert.equal(compatibilityResult.currentStamina, 3);
assert.equal(compatibilityResult.updated.fatigueState.currentStamina, 3);
assert.equal(compatibilityResult.updated.currentstamina, 3);

const committed = resolvePanicFleeStaminaSpend({
  fighter,
  distanceFeet: 30,
  movementCommitted: true,
  actionToken: "turn:1",
  activeActionToken: "turn:1",
});
assert.equal(committed.accepted, true);
assert.equal(committed.cost, 3);
assert.equal(committed.spent, 3);
assert.equal(committed.updated.currentStamina, 7, "successful flee spends once");

const noMovement = resolvePanicFleeStaminaSpend({
  fighter,
  distanceFeet: 30,
  movementCommitted: false,
  actionToken: "turn:1",
  activeActionToken: "turn:1",
});
assert.equal(noMovement.spent, 0, "failed flee and cower spend no movement stamina");
assert.equal(noMovement.updated, fighter);

const edgeMovement = resolvePanicFleeStaminaSpend({
  fighter,
  distanceFeet: 60,
  movementCommitted: true,
  actionToken: "turn:2",
  activeActionToken: "turn:2",
});
assert.equal(edgeMovement.spent, edgeMovement.cost, "edge-reaching flee spends exactly once");

const stale = resolvePanicFleeStaminaSpend({
  fighter,
  distanceFeet: 30,
  movementCommitted: true,
  actionToken: "turn:old",
  activeActionToken: "turn:new",
});
assert.equal(stale.reason, "stale-action-token");
assert.equal(stale.spent, 0);

const collapseSpend = resolvePanicFleeStaminaSpend({
  fighter: { currentStamina: 3, maxStamina: 10 },
  distanceFeet: 30,
  movementCommitted: true,
  actionToken: "turn:3",
  activeActionToken: "turn:3",
});
assert.equal(collapseSpend.updated.currentStamina, 0, "collapse observes post-spend stamina");
console.log("panic flee stamina spending test passed");
