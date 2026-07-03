import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createPlayerAiContinuationOwnership,
  shouldPlayerAiContinuationWatchdogFire,
} from "../src/utils/playerAiContinuation.js";

const current = {
  fighterId: "knight-3",
  turnIndex: 2,
  turnCounter: 17,
  turnToken: "turn-17-knight-3",
};
const ownership = createPlayerAiContinuationOwnership({
  ...current,
  claimedAt: 1000,
  timeoutMs: 6500,
});
assert.equal(shouldPlayerAiContinuationWatchdogFire(ownership, current, 7499), false);
assert.equal(shouldPlayerAiContinuationWatchdogFire(ownership, current, 7500), true);
assert.equal(shouldPlayerAiContinuationWatchdogFire(ownership, {
  ...current,
  turnCounter: 18,
}, 8000), false, "watchdog cannot finalize a stale turn");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /pending continuation watchdog fired fighter=.*reason=timeout/);
assert.match(source, /player-ai-flanking-continuation-timeout/);
assert.match(source, /schedulePlayerAIEndTurn\(0, timeoutSource\)/);
assert.match(source, /if \(!shouldPlayerAiContinuationWatchdogFire\(pending, liveCurrent, Date\.now\(\)\)\) return;/,
  "watchdog validates live ownership before finalizing");

console.log("player AI continuation-watchdog tests passed");
