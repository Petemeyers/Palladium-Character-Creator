import assert from "node:assert/strict";
import fs from "node:fs";

import {
  acceptTurnFinalizerKey,
  createTurnFinalizerSnapshot,
  getTurnFinalizerKey,
} from "../src/utils/turnFinalizerOwnership.js";

const registry = new Set();
const blockedFlank = createTurnFinalizerSnapshot({
  combatSession: 1,
  generation: 8,
  fighterId: "spearman-1",
  turnIndex: 0,
  meleeRound: 1,
  turnCounter: 6,
  turnToken: "spearman-1-token",
});
const key = getTurnFinalizerKey(blockedFlank);
let handoffs = 0;

const first = acceptTurnFinalizerKey(registry, key);
if (first.accepted) handoffs += 1;
const duplicate = acceptTurnFinalizerKey(registry, key);
if (duplicate.accepted) handoffs += 1;

assert.deepEqual(first, { accepted: true, duplicate: false });
assert.deepEqual(duplicate, { accepted: false, duplicate: true });
assert.equal(handoffs, 1, "blocked flanking continuation schedules exactly one handoff");

registry.clear();
const laterKey = getTurnFinalizerKey(createTurnFinalizerSnapshot({
  combatSession: 1,
  generation: 9,
  fighterId: "goblin-2",
  turnIndex: 5,
  meleeRound: 1,
  turnCounter: 7,
  turnToken: "goblin-2-token",
}));
assert.equal(acceptTurnFinalizerKey(registry, laterKey).accepted, true,
  "a valid later actor can finalize after generation cleanup");

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /acceptedTurnFinalizerKeysRef/);
assert.match(combatPage, /duplicate turn finalizer ignored fighter=/);
assert.match(combatPage, /acceptedTurnFinalizerKeysRef\.current\.clear\(\)/);
assert.doesNotMatch(
  combatPage,
  /while \(nextFighter\.remainingActions <= 0[\s\S]{0,1200}has no actions remaining - passing to next fighter in initiative order/,
  "initiative scanning no longer emits misleading previous-actor no-actions logs",
);
assert.match(
  combatPage,
  /if \(!canFinalizeEnemyTurn\("legacy-enemy-no-actions"\)\)[\s\S]{0,500}has no actions remaining - passing to next fighter in initiative order/,
  "legacy enemy no-actions logging is protected by finalizer ownership",
);
assert.match(
  combatPage,
  /if \(staleNoActionSlot\)[\s\S]{0,900}stale no-actions finalizer ignored[\s\S]{0,900}has no actions remaining - passing to next fighter in initiative order/,
  "effect no-actions logging rejects stale turn slots before scheduling",
);
assert.match(
  combatPage,
  /deferTurnStart: options\?\.deferTurnStart !== false/,
  "scheduled handoffs settle authoritative refs before starting the next actor",
);

const playerAi = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAi, /player-ai-flanking-continuation-blocked/,
  "blocked flanking uses one canonical finalizer source");
assert.match(playerAi, /player-ai-flanking-continuation-resolved/,
  "successful flanking continuation identifies its resolved finalizer");

console.log("turn-finalizer idempotency tests passed");
