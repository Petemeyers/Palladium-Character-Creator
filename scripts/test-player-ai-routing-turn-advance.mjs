import assert from "node:assert/strict";

import { shouldRetryPlayerAiActiveFighterMismatch } from "../src/utils/playerAiTurnStartRetry.js";
import {
  createPlayerAiActionResult,
  didPlayerAiAct,
  summarizePlayerAiResult,
} from "../src/utils/playerAiTurnResult.js";

const common = {
  retryCount: 0,
  aiControlEnabled: true,
  isPartyActor: true,
  combatActive: true,
  combatPaused: false,
  combatOver: false,
  actionBusy: false,
  actionResolving: false,
};
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({
  ...common,
  reason: "endTurn-direct",
}), true, "routing handoff can recover a transient next-actor mismatch");
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({
  ...common,
  reason: "new-melee-round-direct",
}), true, "new-round handoff can recover a transient mismatch");
assert.equal(shouldRetryPlayerAiActiveFighterMismatch({
  ...common,
  reason: "horror-action-consumed",
}), true, "routed/horror action handoff remains eligible");
assert.equal(didPlayerAiAct(createPlayerAiActionResult("routed-move")), true,
  "routed player movement owns the action before turn advancement");
assert.equal(didPlayerAiAct(createPlayerAiActionResult("routed-blocked")), true,
  "a routed blocked fallback still resolves and advances safely");
assert.equal(summarizePlayerAiResult(createPlayerAiActionResult("routed-move")), "routed-move");

console.log("player AI routing turn-advance tests passed");
