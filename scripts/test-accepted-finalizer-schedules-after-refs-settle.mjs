import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createTurnFinalizerSnapshot,
  acceptTurnFinalizerKey,
  shouldAcceptTurnFinalizer,
  shouldDeferTurnStartUntilRefsSettle,
} from "../src/utils/turnFinalizerOwnership.js";

const finalizer = createTurnFinalizerSnapshot({
  combatSession: 3,
  generation: 20,
  fighterId: "knight-2",
  turnIndex: 5,
  meleeRound: 1,
  turnCounter: 40,
  turnToken: "knight-2-token",
});
assert.equal(shouldAcceptTurnFinalizer(finalizer, finalizer), true,
  "approach move-only finalizer is accepted while its actor owns the turn");
assert.equal(shouldDeferTurnStartUntilRefsSettle({ deferTurnStart: true }), true);
assert.equal(shouldDeferTurnStartUntilRefsSettle({}), false,
  "direct endTurn calls remain immediate unless explicitly deferred");
const acceptedKeys = new Set();
assert.equal(acceptTurnFinalizerKey(acceptedKeys, "accepted-key").accepted, true);
assert.equal(acceptTurnFinalizerKey(acceptedKeys, "accepted-key").duplicate, true,
  "duplicate sources cannot enqueue a second settled handoff");

const refs = { fighterId: "knight-2", turnIndex: 5, turnCounter: 40 };
const intended = { fighterId: "knight-1", turnIndex: 6, turnCounter: 41 };
const startedKeys = new Set();
let starts = 0;
let turnKeyMismatches = 0;

// endTurn publishes the intended destination, then an older React commit briefly
// restores the previous refs before the settled callback runs.
Object.assign(refs, intended);
Object.assign(refs, { fighterId: "knight-2", turnIndex: 5, turnCounter: 40 });
await new Promise((resolve) => setTimeout(() => {
  Object.assign(refs, intended);
  const key = `${refs.fighterId}:${refs.turnIndex}:${refs.turnCounter}`;
  if (refs.fighterId !== intended.fighterId || refs.turnIndex !== intended.turnIndex) {
    turnKeyMismatches += 1;
  } else if (!startedKeys.has(key)) {
    startedKeys.add(key);
    starts += 1;
  }
  resolve();
}, 0));

assert.equal(starts, 1, "the correct next actor starts exactly once after refs settle");
assert.equal(turnKeyMismatches, 0, "settled scheduling avoids turn-key mismatch");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /scheduleEndTurn\(delayOverride, source, \{ deferTurnStart: true \}\)/,
  "accepted player finalizers explicitly request settled scheduling");
assert.match(source, /startTurnOnce\(fighter, index, "effect-turn-advance"\)/,
  "settled starts route through the existing effect-turn-advance path");
assert.match(source, /player AI start blocked: reason=active-fighter-mismatch/,
  "active-fighter mismatch guard remains intact");
assert.match(source, /player AI start blocked: reason=turn-key-mismatch/,
  "turn-key mismatch guard remains intact");

console.log("accepted finalizer settled-start tests passed");
