import assert from "node:assert/strict";
import { calculateEffectiveRoutedMovement } from "../src/utils/combatStamina.js";

const fresh = calculateEffectiveRoutedMovement({ fighter: { currentStamina: 10, maxStamina: 10 }, baseDistanceFeet: 30, movementType: "panic", staminaProfile: { band: "fresh" }, armorProfile: { band: "light" } });
const tired = calculateEffectiveRoutedMovement({ fighter: { currentStamina: 3, maxStamina: 10 }, baseDistanceFeet: 30, movementType: "panic", staminaProfile: { band: "tired" }, armorProfile: { band: "light" } });
assert.equal(fresh.distanceFeet, 30);
assert.ok(tired.distanceFeet < fresh.distanceFeet);
console.log("low stamina routed movement slowdown test passed");
