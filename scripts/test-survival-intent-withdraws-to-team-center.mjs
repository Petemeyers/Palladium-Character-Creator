import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const result = chooseSurvivalIntent({
  fighter: { id: "soldier", state: { moraleState: "routed" } },
  routed: true,
  nearbyAllies: [],
  isolated: false,
  teamCenter: { x: 8, y: 8 },
});
assert.equal(result.intent, SURVIVAL_INTENTS.WITHDRAW_TO_TEAM_CENTER);
console.log("survival intent team-center withdrawal test passed");
