import assert from "node:assert/strict";
import { calculateRoutedMovementStaminaCost, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const input = { distanceFeet: 30, movementType: "panic-run", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE };
const light = calculateRoutedMovementStaminaCost({ ...input, fighter: { armorClass: 11 } });
const heavy = calculateRoutedMovementStaminaCost({ ...input, fighter: { armorClass: 18 } });
assert.equal(light, 3);
assert.equal(heavy, 5);
assert.ok(heavy > light);
console.log("heavy-armor panic-run stamina cost test passed");
