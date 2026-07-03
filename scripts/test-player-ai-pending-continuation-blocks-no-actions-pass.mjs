import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createPlayerAiContinuationOwnership,
  doesPlayerAiContinuationOwnTurn,
} from "../src/utils/playerAiContinuation.js";

const pending = createPlayerAiContinuationOwnership({
  fighterId: "knight-1",
  turnIndex: 1,
  turnCounter: 9,
  turnToken: "knight-1-turn-9",
  source: "player-ai-flanking-continuation",
});
assert.equal(doesPlayerAiContinuationOwnTurn(pending, {
  fighterId: "knight-1",
  turnIndex: 1,
  turnCounter: 9,
  turnToken: "knight-1-turn-9",
}), true);
assert.match(pending.continuationKey, /knight-1.*player-ai-flanking-continuation/);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const noActionsBranch = source.indexOf("if ((currentFighter.remainingActions ?? 0) <= 0)");
const continuationGuard = source.indexOf("doesPlayerAiContinuationOwnTurn(pendingContinuation", noActionsBranch);
const deferredLog = source.indexOf("no-actions pass deferred: pending continuation owns turn", continuationGuard);
const normalPassLog = source.indexOf("has no actions remaining - passing to next fighter", deferredLog);
const directAdvance = source.indexOf("endTurn();", normalPassLog);

assert.ok(noActionsBranch >= 0);
assert.ok(continuationGuard > noActionsBranch);
assert.ok(deferredLog > continuationGuard);
assert.ok(normalPassLog > deferredLog);
assert.ok(directAdvance > normalPassLog,
  "continuation ownership returns before generic no-actions logging and direct advancement");

console.log("pending continuation no-actions deferral tests passed");
