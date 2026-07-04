import assert from "node:assert/strict";
import { chooseSurvivalIntent } from "../src/utils/survivalIntent.js";

const context = { routed: true, badlyWounded: true, isolated: true };
const unarmored = chooseSurvivalIntent({ ...context, fighter: { state: { moraleState: "routed" }, armorClass: 10, currentStamina: 10, maxStamina: 10 } });
const armored = chooseSurvivalIntent({ ...context, fighter: { state: { moraleState: "routed" }, armorClass: 18, currentStamina: 10, maxStamina: 10 } });
assert.equal(unarmored.panicScore - armored.panicScore, 1);
console.log("armor physical-panic relief test passed");
