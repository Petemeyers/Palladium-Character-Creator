import assert from "node:assert/strict";

import {
  createTurnFinalizerSnapshot,
  getTurnFinalizerKey,
  getTurnFinalizerStaleReason,
  shouldAcceptTurnFinalizer,
  shouldDeferTurnStartUntilRefsSettle,
} from "../src/utils/turnFinalizerOwnership.js";

const snapshot = (fighterId, turnIndex, turnCounter, generation = turnCounter) =>
  createTurnFinalizerSnapshot({
    combatSession: 4,
    generation,
    fighterId,
    turnIndex,
    meleeRound: 5,
    turnCounter,
    turnToken: `token:${fighterId}:${turnCounter}`,
  });

const delayedFinalizers = [
  snapshot("knight-2", 1, 46),
  snapshot("minotaur", 2, 47),
  snapshot("goblin-2", 3, 48),
  snapshot("knight-1", 4, 49),
];
const current = snapshot("knight-3", 0, 50);
let scheduledAdvances = 0;
let staleIgnored = 0;

for (const finalizer of [...delayedFinalizers, current]) {
  if (!shouldAcceptTurnFinalizer(finalizer, current)) {
    staleIgnored += 1;
    continue;
  }
  scheduledAdvances += 1;
}

assert.equal(staleIgnored, 4, "all previous-actor finalizers are ignored");
assert.equal(scheduledAdvances, 1, "only the current actor can schedule advancement");
assert.equal(getTurnFinalizerStaleReason(delayedFinalizers[0], current), "generation-changed");
assert.equal(getTurnFinalizerStaleReason(current, current), null);
assert.notEqual(getTurnFinalizerKey(delayedFinalizers[0]), getTurnFinalizerKey(current));
assert.equal(shouldDeferTurnStartUntilRefsSettle({ deferTurnStart: true }), true,
  "accepted async player finalizers wait one settled tick without reviving stale ones");

console.log("stale no-actions finalizer ownership tests passed");
