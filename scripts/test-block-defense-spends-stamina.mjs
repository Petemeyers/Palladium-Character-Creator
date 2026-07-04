import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateDefenseStaminaCost, spendStamina } from "../src/utils/combatStamina.js";

const defender = { currentStamina: 8, maxStamina: 10, currentHP: 20 };
const cost = calculateDefenseStaminaCost({ defender, defenseType: "block" });
const result = spendStamina(defender, cost);
assert.equal(cost, 1);
assert.equal(result.currentStamina, 7);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /spendActiveDefenseStamina\(defenseType\)/);
console.log("block defense stamina tests passed");
