import assert from "node:assert/strict";
import fs from "node:fs";
import {
  calculateAttackStaminaCost,
  spendCombatStamina,
  spendStamina,
} from "../src/utils/combatStamina.js";

const fighter = { currentStamina: 10, maxStamina: 10 };
const cost = calculateAttackStaminaCost({ fighter, weapon: { name: "Long Sword", type: "melee" } });
const result = spendStamina(fighter, cost);
assert.equal(cost, 2);
assert.equal(result.spent, 2);
assert.equal(result.currentStamina, 8);

const canonicalSpend = spendCombatStamina({
  fighter: { currentStamina: 1, maxStamina: 10 },
  amount: cost,
  reason: "attack",
  allowOverexertion: true,
});
assert.equal(canonicalSpend.accepted, true);
assert.equal(canonicalSpend.spent, 2);
assert.equal(canonicalSpend.nextStamina, -1);
assert.equal(canonicalSpend.overexertionApplied, true);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /calculateAttackStaminaCost\(\{/);
assert.match(source, /spendCombatStamina\(\{/);
assert.match(source, /const overexertionPolicy = resolveAttackOverexertionPolicy\(\{/);
assert.match(source, /allowOverexertion: overexertionPolicy\.allowOverexertion/);
assert.match(source, /staminaChargedAttackKeysRef\.current\.add\(staminaChargeKey\)/);
assert.match(source, /attack-stamina-spend-rejected/);
console.log("attack stamina spending tests passed");
