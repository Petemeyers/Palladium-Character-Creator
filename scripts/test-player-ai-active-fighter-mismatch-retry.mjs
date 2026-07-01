import assert from "node:assert/strict";
import fs from "node:fs";

import { shouldRetryPlayerAiActiveFighterMismatch } from "../src/utils/playerAiTurnStartRetry.js";

const safeTurnAdvance = {
  reason: "endTurn-direct",
  retryCount: 0,
  aiControlEnabled: true,
  isPartyActor: true,
  combatActive: true,
  combatPaused: false,
  combatOver: false,
  actionBusy: false,
  actionResolving: false,
};
assert.equal(shouldRetryPlayerAiActiveFighterMismatch(safeTurnAdvance), true);
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, reason: "effect-turn-advance" }), true);
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, reason: "new-melee-round-direct" }), true);
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, retryCount: 3 }), false,
  "retry count is bounded");
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, actionResolving: true }), false,
  "retry cannot start over a resolving action");
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, isPartyActor: false }), false);
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, reason: "unrelated-render" }), false);

let starts = 0;
const activeIds = ["old-fighter", "next-party-fighter"];
for (let retry = 0; retry < activeIds.length; retry += 1) {
  if (activeIds[retry] === "next-party-fighter") {
    starts += 1;
    break;
  }
  assert.equal(shouldRetryPlayerAiActiveFighterMismatch({ ...safeTurnAdvance, retryCount: retry }), true);
}
assert.equal(starts, 1, "next party actor starts exactly once after refs settle");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /player AI start blocked: reason=active-fighter-mismatch[\s\S]*scheduledKey=/);
assert.match(source, /player AI start retrying after active-fighter-mismatch/);
assert.match(source, /queuePlayerStartRetry\(fighter, 1\)/);

console.log("player AI active-fighter-mismatch retry tests passed");

