import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  preserveLatestPositionAcrossStores,
} from "../src/utils/combat/noMovePositionPreservation.js";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const result = preserveLatestPositionAcrossStores({
  fighterId: "party-knight",
  staleActor: { id: "party-knight", name: "Knight [party]", position: { x: 22, y: 15 }, x: 22, y: 15 },
  updatedFighters: [
    { id: "party-knight", name: "Knight [party]", position: { x: 22, y: 15 }, hex: { x: 22, y: 15 } },
  ],
  positions: { "party-knight": { x: 20, y: 15 } },
  lastKnownPositions: { "party-knight": { x: 20, y: 15 } },
  patch: {
    x: 22,
    y: 15,
    position: { x: 22, y: 15 },
    remainingActions: 0,
    attacksRemaining: 0,
    meta: { horrorLostActionConsumedKey: "minotaur:1" },
  },
});

assert.deepEqual(result.positions["party-knight"], { x: 20, y: 15 });
assert.deepEqual(result.fighters[0].position, { x: 20, y: 15 });
assert.equal(result.fighters[0].remainingActions, 0);
assert.equal(result.fighters[0].meta.horrorLostActionConsumedKey, "minotaur:1");

assert.match(combatPageSource, /Dread response consumes the action; scheduling turn advance/);
assert.match(combatPageSource, /horror-action-consumed/);
assert.match(combatPageSource, /source: "horror-action-consumed"/);
assert.match(combatPageSource, /finalizeNoMovePreservingPosition\(\{\s+fighterId: updated\[liveIndex\]\.id/);
assert.match(combatPageSource, /source: "burnFailedAutomatedActionAndEnd"/);

console.log("horror action consumed preserves position tests passed");
