import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const wounded = chooseSurvivalIntent({
  fighter: { id: "isolated", state: { moraleState: "routed" } },
  routed: true,
  badlyWounded: true,
  isolated: true,
});
assert.equal(wounded.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);

const terrified = chooseSurvivalIntent({
  fighter: { id: "terrified", state: { moraleState: "routed" } },
  routed: true,
  mythicTerror: true,
  nearbyAllies: [{ id: "ally" }],
});
assert.equal(terrified.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);
console.log("survival intent isolated and mythic-terror panic tests passed");
