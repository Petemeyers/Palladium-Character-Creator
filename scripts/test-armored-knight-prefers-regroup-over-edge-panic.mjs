import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const result = chooseSurvivalIntent({ fighter: { state: { moraleState: "routed" }, armorClass: 18, currentStamina: 12, maxStamina: 12 }, routed: true, mythicTerror: true, nearbyAllies: [{ id: "knight-ally" }] });
assert.equal(result.intent, SURVIVAL_INTENTS.REGROUP_WITH_ALLY);
console.log("armored fresh knight regroup preference test passed");
