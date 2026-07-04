import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const ally = { id: "ally" };
const fresh = chooseSurvivalIntent({ fighter: { state: { moraleState: "routed" }, armorClass: 18, currentStamina: 10, maxStamina: 10 }, routed: true, mythicTerror: true, nearbyAllies: [ally] });
const exhausted = chooseSurvivalIntent({ fighter: { state: { moraleState: "routed" }, armorClass: 18, currentStamina: 0, maxStamina: 10 }, routed: true, mythicTerror: true, nearbyAllies: [ally] });
assert.equal(fresh.armorPanicRelief, 1);
assert.equal(fresh.intent, SURVIVAL_INTENTS.REGROUP_WITH_ALLY);
assert.equal(exhausted.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);
console.log("heavy armor mythic-terror softening without immunity test passed");
