import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const ally = { id: "ally" };
const result = chooseSurvivalIntent({
  fighter: { state: { moraleState: "routed" }, armorClass: 18, currentStamina: 10, maxStamina: 10 },
  routed: true,
  mythicTerror: true,
  nearbyAllies: [ally],
});
assert.equal(result.staminaProfile.band, "fresh");
assert.equal(result.staminaProfile.panicModifier, -1);
assert.equal(result.intent, SURVIVAL_INTENTS.REGROUP_WITH_ALLY);
console.log("fresh-stamina routing control test passed");
