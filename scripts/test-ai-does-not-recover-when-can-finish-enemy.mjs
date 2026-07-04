import assert from "node:assert/strict";
import { chooseAIStaminaRecovery } from "../src/utils/combatStamina.js";

const decision = chooseAIStaminaRecovery({
  fighter: { id: "knight", currentStamina: 1, maxStamina: 10 },
  enemies: [{ id: "goblin" }],
  positions: { knight: { x: 0, y: 0 }, goblin: { x: 1, y: 0 } },
  calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5,
  canFinishEnemy: true,
});
assert.equal(decision.shouldRecover, false);
assert.equal(decision.reason, "finishing-opportunity");
console.log("AI finishing-opportunity recovery avoidance tests passed");
