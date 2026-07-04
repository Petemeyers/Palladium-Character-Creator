import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateEffectiveRoutedMovement } from "../src/utils/combatStamina.js";

const spent = calculateEffectiveRoutedMovement({ fighter: { currentStamina: 0, maxStamina: 10 }, baseDistanceFeet: 30, movementType: "panic", staminaProfile: { band: "exhausted" }, armorProfile: { band: "heavy" } });
assert.equal(spent.distanceFeet, 0);
assert.equal(spent.spent, true);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /too exhausted to keep fleeing and cowers in place/);
console.log("spent routed fighter cower test passed");
