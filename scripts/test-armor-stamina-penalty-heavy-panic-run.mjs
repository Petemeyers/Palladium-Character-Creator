import assert from "node:assert/strict";
import { getArmorStaminaBurden } from "../src/utils/combatStamina.js";
import { calculateRoutedMovementStaminaCost, getRoutingArmorProfile, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const heavy = { armorClass: 18 };
const light = { armorClass: 11 };
const heavyProfile = getRoutingArmorProfile(heavy);
assert.deepEqual(getArmorStaminaBurden(heavy, heavyProfile), {
  armorClass: "heavy", controlledMovePenalty: 1, panicMovePenalty: 2, longMovePenalty: 1, shieldPenalty: 0,
});
const panic = (fighter) => calculateRoutedMovementStaminaCost({
  fighter, distanceFeet: 30, movementType: "panic-run", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE,
});
assert.equal(panic(light), 3);
assert.equal(panic(heavy), 5);
assert.equal(panic({ ...heavy, equippedShield: "heater shield" }), 6);
console.log("heavy armor and shield panic-run burden test passed");
