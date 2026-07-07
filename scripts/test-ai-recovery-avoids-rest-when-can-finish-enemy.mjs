import assert from "node:assert/strict";

import { chooseAIStaminaRecovery } from "../src/utils/combatStamina.js";

const decision = chooseAIStaminaRecovery({
  fighter: { id: "minotaur", currentStamina: 1, maxStamina: 30 },
  enemies: [{ id: "knight", currentHP: 3 }],
  positions: { minotaur: { x: 0, y: 0 }, knight: { x: 1, y: 0 } },
  calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5,
  canFinishEnemy: true,
});

assert.equal(decision.shouldRecover, false);
assert.equal(decision.reason, "finishing-opportunity");

console.log("finishing-opportunity AI recovery avoidance tests passed");
