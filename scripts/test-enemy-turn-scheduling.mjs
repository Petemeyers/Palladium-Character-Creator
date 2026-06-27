import assert from "node:assert/strict";

import {
  buildEnemyTurnSlotKey,
  shouldCoalesceBlockedEnemyTurn,
  shouldDedupeEnemyTurnStart,
  shouldSkipBlockedEnemyTurnStart,
  spendEnemyNoTargetAction,
} from "../src/utils/enemyTurnScheduling.js";
import {
  areCombatantsOnSameSide,
  getCombatHostilityState,
} from "../src/utils/combatHostilityState.js";
import { canTargetForAction } from "../src/utils/factionDisposition.js";

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

const alliedEnemies = [
  { id: "enemy-longbowman", team: "enemy", side: "enemy", type: "enemy", aggression: "hostile", HP: 10 },
  { id: "enemy-hawk", team: "enemy", side: "enemy", type: "enemy", aggression: "hostile", HP: 5 },
  { id: "enemy-minotaur", team: "enemy", side: "enemy", type: "enemy", aggression: "hostile", HP: 20 },
];
const alliedState = getCombatHostilityState(alliedEnemies);
assert.equal(alliedState.noHostileSidesRemaining, true, "one allied team should end instead of cycling no-target rounds");
assert.equal(alliedState.hasHostileSides, false);
assert.equal(areCombatantsOnSameSide(alliedEnemies[0], alliedEnemies[1]), true);
assert.equal(
  canTargetForAction(alliedEnemies[0], alliedEnemies[1], "attack", { sceneType: "combat", relations: {} }),
  false,
  "same-team actors remain invalid hostile targets"
);

const hostileFactions = [
  { id: "red-1", team: "red", factionId: "red", type: "npc", aggression: "hostile", HP: 10 },
  { id: "blue-1", team: "blue", factionId: "blue", type: "npc", aggression: "hostile", HP: 10 },
];
const hostileFactionState = getCombatHostilityState(hostileFactions);
assert.equal(hostileFactionState.hasHostileSides, true, "AI-vs-AI remains valid across hostile factions");
assert.equal(hostileFactionState.noHostileSidesRemaining, false);

const spentNoTargetAction = spendEnemyNoTargetAction(
  [{ id: "enemy-longbowman", remainingActions: 2 }, { id: "enemy-hawk", remainingActions: 1 }],
  "enemy-longbowman"
);
assert.equal(spentNoTargetAction[0].remainingActions, 1, "no-target pass spends exactly one action");
assert.equal(spentNoTargetAction[1].remainingActions, 1, "no-target pass does not change another actor");
assert.equal(
  spendEnemyNoTargetAction(spentNoTargetAction, "enemy-longbowman")[0].remainingActions,
  0,
  "later no-target turn slices may spend their own remaining action"
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
