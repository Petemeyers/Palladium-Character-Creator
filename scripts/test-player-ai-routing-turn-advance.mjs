import assert from "node:assert/strict";

import { shouldRetryPlayerAiActiveFighterMismatch } from "../src/utils/playerAiTurnStartRetry.js";
import {
  createPlayerAiActionResult,
  didPlayerAiAct,
  summarizePlayerAiResult,
} from "../src/utils/playerAiTurnResult.js";
import {
  createTurnFinalizerSnapshot,
  acceptTurnFinalizerKey,
  shouldAcceptTurnFinalizer,
  shouldDeferTurnStartUntilRefsSettle,
} from "../src/utils/turnFinalizerOwnership.js";

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
const routedCurrent = createTurnFinalizerSnapshot({ generation: 12, fighterId: "routed-knight", turnIndex: 1 });
const previousActor = createTurnFinalizerSnapshot({ generation: 11, fighterId: "old-knight", turnIndex: 0 });
assert.equal(shouldAcceptTurnFinalizer(previousActor, routedCurrent), false,
  "a previous actor cannot interrupt the current routed turn");
assert.equal(shouldAcceptTurnFinalizer(routedCurrent, routedCurrent), true,
  "the routed current actor can still advance normally");
assert.equal(shouldDeferTurnStartUntilRefsSettle({ deferTurnStart: true }), true,
  "accepted routed player finalizers can hand off after refs settle");
const routingFinalizers = new Set();
assert.equal(acceptTurnFinalizerKey(routingFinalizers, "routed-turn").accepted, true);
assert.equal(acceptTurnFinalizerKey(routingFinalizers, "routed-turn").duplicate, true,
  "routed turn cannot be interrupted by a duplicate prior handoff");

console.log("player AI routing turn-advance tests passed");
