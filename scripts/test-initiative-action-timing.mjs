import assert from "node:assert/strict";
import {
  INITIATIVE_ACTIONS_MODE,
  allowsSameActorActionContinuation,
  canTakeInitiativeActionPass,
  getInitiativeActionPassIndex,
  isInitiativeActionsMode,
} from "../src/utils/combat/initiativeActionTiming.js";

assert.equal(isInitiativeActionsMode(INITIATIVE_ACTIONS_MODE), true);
assert.equal(isInitiativeActionsMode("sequential"), false);
assert.equal(allowsSameActorActionContinuation(INITIATIVE_ACTIONS_MODE), false);
assert.equal(allowsSameActorActionContinuation("sequential"), true);
assert.equal(getInitiativeActionPassIndex({ actionsPerRound: 2, remainingActions: 2 }), 1);
assert.equal(getInitiativeActionPassIndex({ actionsPerRound: 2, remainingActions: 1 }), 2);
assert.equal(getInitiativeActionPassIndex({ actionsPerRound: 3, remainingActions: 1 }), 3);
assert.equal(canTakeInitiativeActionPass({ remainingActions: 1 }, () => true), true);
assert.equal(canTakeInitiativeActionPass({ remainingActions: 0 }, () => true), false);
assert.equal(canTakeInitiativeActionPass({ remainingActions: 1 }, () => false), false);

console.log("initiative action timing regression: passed");
