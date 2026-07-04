import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /fraidereRoutingFleeAction\(latestFighter, liveFighters, "player-turn-start"\)/);
assert.match(source, /fraidereRoutingFleeAction\(latestPlayer, liveFightersForPlayerAI, "player-ai-routing"\)/);
assert.match(source, /fraidereRoutingFleeAction\(liveEnemy, fightersSnapshot, "enemy-routing"\)/);

const start = source.indexOf("const fraidereRoutingFleeAction");
const end = source.indexOf("const preserveTrainingWithstamina", start);
const sharedHandler = source.slice(start, end);
assert.match(sharedHandler, /chooseRoutingSurvivalIntent/);
assert.match(sharedHandler, /findSurvivalIntentDestination/);
assert.match(sharedHandler, /setPositions\(nextPositions\)/);

for (const marker of ["player-turn-start", "player-ai-routing", "enemy-routing"]) {
  const call = source.indexOf(`, "${marker}")`);
  const finalizer = source.indexOf("Dread response consumes the action; scheduling turn advance.", call);
  assert.ok(call >= 0 && finalizer > call, `${marker} retains the routed-action finalizer after shared movement`);
}
console.log("survival intent enemy and player browser paths coverage test passed");
