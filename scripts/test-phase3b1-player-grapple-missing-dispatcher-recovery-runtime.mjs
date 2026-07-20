import assert from "node:assert/strict";

import { executeMissingPlayerGrappleDispatcherRecovery } from "../src/utils/ai/playerGrappleDispatcher.js";

const actor = { id: "player-knight", name: "Player Knight", remainingActions: 2, currentHP: 30 };
const events = [];
const recoveryRegistry = new Map();
let actionSequence = 0;
let completionCalls = 0;
let continuationCount = 0;
let handoffCount = 0;
let grappleRolls = 0;
let hpMutations = 0;

const runtime = {
  recoveryRegistry,
  getActor: () => actor,
  getActionSequence: () => actionSequence,
  setActionSequence: (next) => { actionSequence = next; },
  commitPassAction: (_actorId, remainingBefore) => {
    actor.remainingActions = Math.max(0, remainingBefore - 1);
    return actor.remainingActions;
  },
  clearTransientOwnership: () => {},
  logPass: () => {},
  emitEvent: (eventType, data) => events.push({ eventType, data }),
  resolveCompletion: ({ actionResult }) => {
    completionCalls += 1;
    assert.equal(actionResult.actionType, "pass");
    assert.equal(actionResult.explicitPass, true);
    assert.doesNotMatch(actionResult.actionToken, /grapple/i);
    if (actionResult.remainingActions > 0) {
      continuationCount += 1;
      return { decision: "continuation-created" };
    }
    handoffCount += 1;
    return { decision: "handoff" };
  },
};

const first = executeMissingPlayerGrappleDispatcherRecovery({
  actorId: actor.id,
  initiativeTurnId: "initiative-player-9",
  opponentId: "enemy-knight",
  source: "fixture-first-missing-dispatcher",
  remainingActions: 2,
}, runtime);
assert.deepEqual({
  handled: first.handled,
  terminal: first.terminal,
  actionSpent: first.actionSpent,
  recovery: first.recovery,
  remainingActions: first.remainingActions,
}, {
  handled: true,
  terminal: true,
  actionSpent: true,
  recovery: "missing-grapple-dispatcher-safe-pass",
  remainingActions: 1,
});
assert.equal(continuationCount, 1);
assert.equal(handoffCount, 0);

const second = executeMissingPlayerGrappleDispatcherRecovery({
  actorId: actor.id,
  initiativeTurnId: "initiative-player-9",
  opponentId: "enemy-knight",
  source: "fixture-second-missing-dispatcher",
  remainingActions: 1,
}, runtime);
assert.equal(second.handled, true);
assert.equal(second.terminal, true);
assert.equal(second.actionSpent, true);
assert.equal(second.remainingActions, 0);
assert.equal(continuationCount, 1);
assert.equal(handoffCount, 1);
assert.equal(completionCalls, 2, "completion arbiter must run once for each pass action");
assert.equal(events.filter((event) => event.eventType === "grapple-dispatch-required-but-missing").length, 2);
assert.equal(events.filter((event) => event.eventType === "player-grapple-missing-dispatcher-recovery-completed").length, 2);
assert.equal(events.filter((event) => event.eventType === "player-ai-zero-progress-action-detected").length, 0);
assert.equal(grappleRolls, 0);
assert.equal(hpMutations, 0);

const duplicateActor = { id: "duplicate-knight", name: "Duplicate Knight", remainingActions: 2 };
const duplicateEvents = [];
const duplicateRegistry = new Map();
let duplicateSequence = 0;
let duplicateSpendCount = 0;
let duplicateCompletionCount = 0;
const duplicateRuntime = {
  recoveryRegistry: duplicateRegistry,
  getActor: () => duplicateActor,
  getActionSequence: () => duplicateSequence,
  setActionSequence: (next) => { duplicateSequence = next; },
  commitPassAction: (_actorId, remainingBefore) => {
    duplicateSpendCount += 1;
    duplicateActor.remainingActions = remainingBefore - 1;
    return duplicateActor.remainingActions;
  },
  clearTransientOwnership: () => {},
  resolveCompletion: () => {
    duplicateCompletionCount += 1;
    return { decision: "continuation-created" };
  },
  emitEvent: (eventType) => duplicateEvents.push(eventType),
};
const duplicateArgs = {
  actorId: duplicateActor.id,
  initiativeTurnId: "initiative-duplicate-1",
  remainingActions: 2,
};
const originalRecovery = executeMissingPlayerGrappleDispatcherRecovery(duplicateArgs, duplicateRuntime);
const blockedDuplicate = executeMissingPlayerGrappleDispatcherRecovery(duplicateArgs, duplicateRuntime);
assert.equal(blockedDuplicate, originalRecovery);
assert.equal(duplicateSpendCount, 1, "duplicate retry must not spend a second action");
assert.equal(duplicateCompletionCount, 1, "duplicate retry must not invoke completion twice");
assert.equal(duplicateEvents.filter((event) => event === "player-grapple-missing-dispatcher-recovery-duplicate-blocked").length, 1);

console.log("✅ Phase 3B1 missing dispatcher safe-pass runtime tests passed");
