import assert from "node:assert/strict";
import fs from "node:fs";
import { dispatchOwnedSurvivalAction } from "../src/utils/ownedSurvivalAction.js";
import { SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
for (const marker of ["player-turn-start", "player-ai-routing", "enemy-routing"]) {
  assert.match(
    source,
    new RegExp(`source: "${marker}"[\\s\\S]{0,180}dispatch: \\(\\) => fraidereRoutingFleeAction`),
    `${marker} uses the owned survival dispatcher`,
  );
}

const start = source.indexOf("const fraidereRoutingFleeAction");
const end = source.indexOf("const preserveTrainingWithstamina", start);
const sharedHandler = source.slice(start, end);
assert.match(sharedHandler, /chooseRoutingSurvivalIntent/);
assert.match(sharedHandler, /findSurvivalIntentDestination/);
assert.match(sharedHandler, /setPositions\(nextPositions\)/);

for (const sourceName of ["player-ai-routing", "enemy-routing"]) {
  const actor = { id: `${sourceName}:actor`, moraleState: { status: "ROUTED" } };
  const action = { actionType: "route-move", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE };
  const dispatched = dispatchOwnedSurvivalAction({
    actor,
    actionToken: `${sourceName}:turn`,
    activeActionToken: `${sourceName}:turn`,
    source: sourceName,
    dispatch: () => action,
  });
  assert.equal(dispatched.accepted, true);
  assert.equal(dispatched.actorId, actor.id);
  assert.equal(dispatched.result, action);
}

assert.equal(dispatchOwnedSurvivalAction({
  actor: { id: "cower" },
  actionToken: "turn:1",
  activeActionToken: "turn:1",
  dispatch: () => ({ actionType: "cower", positionPreserved: true }),
}).result.positionPreserved, true);
assert.equal(dispatchOwnedSurvivalAction({
  actor: { id: "stale" },
  actionToken: "turn:old",
  activeActionToken: "turn:new",
  dispatch: () => ({ actionType: "route-move" }),
}).reason, "stale-action-token");
for (const terminal of [
  { dead: true },
  { isCaptured: true },
  { hasSurrendered: true },
]) {
  assert.equal(dispatchOwnedSurvivalAction({
    actor: { id: "terminal", ...terminal },
    actionToken: "turn:1",
    activeActionToken: "turn:1",
    dispatch: () => ({ actionType: "route-move" }),
  }).reason, "actor-terminal");
}
console.log("survival intent enemy and player browser paths coverage test passed");
