import assert from "node:assert/strict";

import { chooseAIStaminaRecovery } from "../src/utils/combatStamina.js";

const decision = chooseAIStaminaRecovery({
  fighter: { id: "goblin", currentStamina: 2, maxStamina: 12 },
  enemies: [{ id: "knight" }],
  allies: [{ id: "minotaur" }],
  positions: {
    goblin: { x: 0, y: 0 },
    minotaur: { x: 2, y: 0 },
    knight: { x: 10, y: 0 },
  },
  calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5,
});

assert.equal(decision.shouldRecover, true);
assert.equal(decision.reason, "low-stamina-covered");

console.log("safe low-stamina AI recovery tests passed");
