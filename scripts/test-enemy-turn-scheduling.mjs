import assert from "node:assert/strict";

import {
  buildEnemyTurnSlotKey,
  shouldCoalesceBlockedEnemyTurn,
  shouldDedupeEnemyTurnStart,
  shouldSkipBlockedEnemyTurnStart,
} from "../src/utils/enemyTurnScheduling.js";

const turnKey = buildEnemyTurnSlotKey({
  fighterId: "enemy-longbowman",
  fighterType: "enemy",
  round: 2,
  turnIndex: 4,
  turnCounter: 8,
});

assert.equal(turnKey, "enemy-longbowman|enemy|2|4|8", "turn slot key should match CombatPage turn-start key shape");

assert.equal(
  shouldSkipBlockedEnemyTurnStart(
    {
      combatSession: 3,
      fighterId: "enemy-longbowman",
      turnKey,
    },
    {
      combatSession: 3,
      fighterId: "enemy-longbowman",
      turnKey,
    }
  ),
  true,
  "blocked enemy extra action should skip the same effect turn start"
);

assert.equal(
  shouldSkipBlockedEnemyTurnStart(
    {
      combatSession: 3,
      fighterId: "enemy-longbowman",
      turnKey,
    },
    {
      combatSession: 3,
      fighterId: "enemy-longbowman",
      turnKey: buildEnemyTurnSlotKey({
        fighterId: "enemy-longbowman",
        fighterType: "enemy",
        round: 2,
        turnIndex: 5,
        turnCounter: 9,
      }),
    }
  ),
  false,
  "blocked enemy skip should not leak into a later turn slot"
);

assert.equal(
  shouldDedupeEnemyTurnStart({
    pendingKey: turnKey,
    nextKey: turnKey,
    hasTimer: true,
    isProcessing: false,
  }),
  true,
  "duplicate enemy turn-start requests for the same key should be deduped while a timer is pending"
);

assert.equal(
  shouldDedupeEnemyTurnStart({
    pendingKey: turnKey,
    nextKey: turnKey,
    hasTimer: false,
    isProcessing: true,
  }),
  true,
  "duplicate enemy turn-start requests for the same key should be deduped while processing"
);

assert.equal(
  shouldDedupeEnemyTurnStart({
    pendingKey: turnKey,
    nextKey: "other",
    hasTimer: true,
    isProcessing: false,
  }),
  false,
  "different enemy turn-start keys should not be deduped"
);

assert.equal(
  shouldCoalesceBlockedEnemyTurn({
    stillCurrent: true,
    combatActive: true,
    combatOver: false,
    alreadyClaimedAndActive: false,
  }),
  true,
  "valid blocked duplicate can coalesce when no handoff is already active"
);

assert.equal(
  shouldCoalesceBlockedEnemyTurn({
    stillCurrent: true,
    combatActive: true,
    combatOver: false,
    alreadyClaimedAndActive: true,
  }),
  false,
  "blocked duplicate should not coalesce when the same turn is already claimed"
);

assert.equal(
  shouldSkipBlockedEnemyTurnStart({ turnKey, fighterId: "enemy-longbowman" }, null),
  false,
  "null current turn slot should not throw or skip"
);

console.log("enemy turn scheduling tests passed");
