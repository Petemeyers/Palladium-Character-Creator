import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const base = { state: { moraleState: "routed" }, armorClass: 18, maxStamina: 10 };
const fresh = chooseSurvivalIntent({ fighter: { ...base, currentStamina: 10 }, routed: true, badlyWounded: true, isolated: true });
const exhausted = chooseSurvivalIntent({ fighter: { ...base, currentStamina: 0 }, routed: true, badlyWounded: true, isolated: true });
assert.equal(exhausted.staminaProfile.band, "exhausted");
assert.ok(exhausted.panicScore > fresh.panicScore);
assert.equal(exhausted.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);
console.log("exhausted-stamina panic pressure test passed");
