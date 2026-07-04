import assert from "node:assert/strict";
import { chooseSurvivalIntent, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const ally = { id: "goblin-2", name: "Goblin Warrior #2" };
const result = chooseSurvivalIntent({
  fighter: { id: "goblin-1", state: { moraleState: "routed" } },
  routed: true,
  nearbyAllies: [ally],
  isolated: false,
});

assert.equal(result.intent, SURVIVAL_INTENTS.REGROUP_WITH_ALLY);
assert.notEqual(result.intent, SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE);
console.log("survival intent nearby-ally regroup test passed");
