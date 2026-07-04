import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateAttackStaminaCost, spendStamina } from "../src/utils/combatStamina.js";

const fighter = { currentStamina: 10, maxStamina: 10 };
const cost = calculateAttackStaminaCost({ fighter, weapon: { name: "Long Sword", type: "melee" } });
const result = spendStamina(fighter, cost);
assert.equal(cost, 2);
assert.equal(result.spent, 2);
assert.equal(result.currentStamina, 8);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /calculateAttackStaminaCost\(\{/);
assert.match(source, /spendStamina\(attackerInArray \|\| effectiveAttacker, attackStaminaCost\)/);
console.log("attack stamina spending tests passed");
