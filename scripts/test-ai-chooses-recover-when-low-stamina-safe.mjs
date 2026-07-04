import assert from "node:assert/strict";
import fs from "node:fs";
import { chooseAIStaminaRecovery } from "../src/utils/combatStamina.js";

const fighter = { id: "knight", currentStamina: 2, maxStamina: 10 };
const enemy = { id: "goblin" };
const ally = { id: "guard" };
const decision = chooseAIStaminaRecovery({
  fighter,
  enemies: [enemy],
  allies: [ally],
  positions: { knight: { x: 0, y: 0 }, guard: { x: 2, y: 0 }, goblin: { x: 10, y: 0 } },
  calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5,
});
assert.equal(decision.shouldRecover, true);
assert.equal(decision.reason, "low-stamina-covered");
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /playerRecoveryDecision\.shouldRecover/);
assert.match(source, /enemyRecoveryDecision\.shouldRecover/);
console.log("safe low-stamina AI recovery tests passed");
