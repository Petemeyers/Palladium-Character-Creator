import assert from "node:assert/strict";

import {
  applyCombatPosture,
  applyDefensivePosture,
  applyDefensiveReserve,
  canUseDefensiveReserveForReaction,
  clearExpiredPostures,
  consumeDefensiveReserve,
  createCombatPosture,
  createDefensivePosture,
  getDefensiveReserve,
} from "../src/utils/combatPosture.js";
import { endManualTurnActions } from "../src/utils/combatCommandStateCleanup.js";

const baseFighter = {
  id: "fighter-1",
  name: "Lenlora",
  type: "player",
  remainingActions: 1,
  actionsPerRound: 2,
};
const snapshot = JSON.stringify(baseFighter);

const blockPosture = createCombatPosture({ type: "blocking", round: 1, turnIndex: 0 });
const blocking = applyDefensiveReserve(
  {
    ...applyCombatPosture(baseFighter, blockPosture),
    remainingActions: 0,
  },
  "block",
  1
);
const afterEndTurn = endManualTurnActions([blocking], blocking)[0];
assert.equal(afterEndTurn.remainingActions, 0, "End Turn ends active actions");
assert.deepEqual(
  getDefensiveReserve(afterEndTurn),
  { active: true, type: "block", actions: 1 },
  "held block reserve remains after End Turn"
);
assert.equal(
  canUseDefensiveReserveForReaction(afterEndTurn, "Block"),
  true,
  "held block can be used even when active actions are 0"
);
assert.equal(
  canUseDefensiveReserveForReaction(afterEndTurn, "Evade"),
  false,
  "held block does not satisfy held evade"
);

const consumedBlock = consumeDefensiveReserve(afterEndTurn);
assert.deepEqual(
  getDefensiveReserve(consumedBlock),
  { active: false, type: "block", actions: 0 },
  "held block reserve is consumed after use"
);
assert.equal(consumedBlock.remainingActions, 0, "using held block does not restore active actions");

const evading = applyDefensiveReserve(
  {
    ...applyCombatPosture(baseFighter, createCombatPosture({ type: "evading", round: 1, turnIndex: 0 })),
    remainingActions: 0,
  },
  "evade",
  1
);
assert.deepEqual(
  getDefensiveReserve(evading),
  { active: true, type: "evade", actions: 1 },
  "held evade reserve is recorded"
);

const defending = applyDefensiveReserve(
  {
    ...applyDefensivePosture(baseFighter, createDefensivePosture({ round: 1, turnIndex: 0 })),
    remainingActions: 0,
  },
  "defend",
  1
);
assert.deepEqual(
  getDefensiveReserve(defending),
  { active: true, type: "defend", actions: 1 },
  "held defense reserve is recorded"
);

const evadeThenBlock = applyDefensiveReserve(evading, "block", 1);
assert.deepEqual(
  getDefensiveReserve(evadeThenBlock),
  { active: true, type: "block", actions: 1 },
  "changing Evade to Block replaces the old reserve"
);

const expired = clearExpiredPostures(afterEndTurn, 2, 0);
assert.deepEqual(
  getDefensiveReserve(expired),
  { active: false, type: "", actions: 0 },
  "unused held reserve expires at the fighter next turn slot"
);

const noReserve = {
  ...baseFighter,
  remainingActions: 0,
};
assert.deepEqual(
  getDefensiveReserve(noReserve),
  { active: false, type: "", actions: 0 },
  "fighter without reserve stays without reserve"
);
assert.equal(
  canUseDefensiveReserveForReaction(noReserve, "Block"),
  false,
  "fighter without reserve cannot use held block"
);

assert.equal(JSON.stringify(baseFighter), snapshot, "reserve helpers do not mutate source fighter");

console.log("defensive posture end-turn tests passed");
