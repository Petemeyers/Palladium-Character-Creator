import assert from "node:assert/strict";
import fs from "node:fs";

import {
  acceptTurnFinalizerKey,
  createTurnFinalizerSnapshot,
  getTurnFinalizerKey,
} from "../src/utils/turnFinalizerOwnership.js";

const snapshot = createTurnFinalizerSnapshot({
  combatSession: 2,
  generation: 11,
  fighterId: "knight-1",
  turnIndex: 1,
  meleeRound: 2,
  turnCounter: 19,
  turnToken: "knight-1-turn-19",
});
const key = getTurnFinalizerKey(snapshot);
const accepted = new Set();
assert.equal(acceptTurnFinalizerKey(accepted, key).accepted, true);
assert.equal(accepted.has(key), true, "accepted blocked continuation owns its exact turn handoff");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const noActionsBranch = source.indexOf("if ((currentFighter.remainingActions ?? 0) <= 0)");
const acceptedGuard = source.indexOf("acceptedTurnFinalizerKeysRef.current.has(noActionsFinalizerKey)", noActionsBranch);
const deferredLog = source.indexOf("no-actions pass deferred: accepted finalizer owns handoff", acceptedGuard);
const normalPass = source.indexOf("has no actions remaining - passing to next fighter", deferredLog);
const directEnd = source.indexOf("endTurn();", normalPass);

assert.ok(noActionsBranch >= 0);
assert.ok(acceptedGuard > noActionsBranch);
assert.ok(deferredLog > acceptedGuard);
assert.ok(normalPass > deferredLog && directEnd > normalPass,
  "accepted-finalizer guard returns before generic no-actions logging and endTurn-direct");
assert.match(source, /formatAcceptedFinalizerSettlement\(\{/);
assert.match(source, /startTurnOnce\(fighter, index, "effect-turn-advance"\)/);

console.log("blocked continuation finalizer handoff tests passed");
