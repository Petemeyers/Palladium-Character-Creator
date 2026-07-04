import assert from "node:assert/strict";
import { calculateEffectiveRoutedMovement } from "../src/utils/combatStamina.js";

const movement = (band) => calculateEffectiveRoutedMovement({ fighter: { currentStamina: 1, maxStamina: 10 }, baseDistanceFeet: 30, movementType: "panic", staminaProfile: { band: "exhausted" }, armorProfile: { band } });
assert.ok(movement("heavy").distanceFeet < movement("light").distanceFeet);
assert.equal(movement("heavy").armorPenaltyApplied, true);
console.log("exhausted heavy armor panic slowdown test passed");
