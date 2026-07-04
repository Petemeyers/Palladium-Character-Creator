import assert from "node:assert/strict";
import { calculateDefenseStaminaCost } from "../src/utils/combatStamina.js";

const defender = { currentHP: 20 };
const block = calculateDefenseStaminaCost({ defender, defenseType: "block" });
const evade = calculateDefenseStaminaCost({ defender, defenseType: "evade" });
assert.equal(block, 1);
assert.equal(evade, 2);
assert.ok(evade > block);
console.log("evade versus block stamina tests passed");
