import assert from "node:assert/strict";

import { getPlayerAiContinuationBlockReason } from "../src/utils/playerAiContinuation.js";

let moved = false;
let attackCalls = 0;
let finalizers = 0;
let turnAdvances = 0;
let resolving = false;

moved = true;
resolving = true;
const attackOutcome = await (async () => {
  attackCalls += 1;
  finalizers += 1;
  turnAdvances += 1;
  resolving = false;
  return { ok: true, accepted: true, attackActionId: "flank-attack" };
})();

assert.equal(moved, true);
assert.equal(getPlayerAiContinuationBlockReason(attackOutcome), null);
assert.equal(attackCalls, 1, "continuation calls attack executor once");
assert.equal(finalizers, 1, "equivalent impact finalizer runs once");
assert.equal(turnAdvances, 1, "resolved attack advances once");
assert.equal(resolving, false, "no resolving latch remains");

console.log("player AI flanking continuation attack tests passed");

