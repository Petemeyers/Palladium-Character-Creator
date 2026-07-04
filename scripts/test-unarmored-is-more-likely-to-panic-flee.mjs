import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const context = { routed: true, badlyWounded: true, isolated: true };
const unarmored = chooseSurvivalIntent({ ...context, fighter: { state: { moraleState: "routed" }, armorClass: 10, currentStamina: 10, maxStamina: 10 } });
const armored = chooseSurvivalIntent({ ...context, fighter: { state: { moraleState: "routed" }, armorClass: 18, currentStamina: 10, maxStamina: 10 } });
assert.equal(unarmored.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);
assert.notEqual(armored.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);
console.log("unarmored physical-panic comparison test passed");
