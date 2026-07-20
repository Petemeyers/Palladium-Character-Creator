import assert from "node:assert/strict";

import {
  auditSettledActionContinuationReceipts,
  consumeActionContinuationReceipt,
  createActionContinuationReceipt,
  fireActionContinuationReceipt,
} from "../src/utils/combat/actionContinuationReceipt.js";

const makeFired = (key) => {
  const created = createActionContinuationReceipt({
    continuationId: key,
    continuationKey: key,
    generationId: "generation",
    initiativeTurnId: "turn",
    actorId: "knight",
    completedActionToken: "turn:1",
    completedActionType: "attack",
    completedActionSequence: 1,
    remainingActions: 1,
  });
  return fireActionContinuationReceipt(created.record).record;
};

const registry = new Map([["left-fired", makeFired("left-fired")]]);
let settledAudit = null;
await Promise.resolve().then(() => undefined).finally(() => {
  settledAudit = auditSettledActionContinuationReceipts(registry, {
    initiativeTurnId: "turn",
    actorId: "knight",
  });
});
assert.equal(settledAudit.activeFired, 1);
assert.equal(settledAudit.ok, false);

const consumedRegistry = new Map([["consumed", makeFired("consumed")]]);
const consumed = consumeActionContinuationReceipt(consumedRegistry.get("consumed"), {
  actionToken: "turn:2",
  actionType: "attack",
});
consumedRegistry.set("consumed", consumed.record);
const healthyAudit = await Promise.resolve().then(() => (
  auditSettledActionContinuationReceipts(consumedRegistry, {
    initiativeTurnId: "turn",
    actorId: "knight",
  })
));
assert.equal(healthyAudit.activeFired, 0);
assert.equal(healthyAudit.consumed, 1);
assert.equal(healthyAudit.exactIdentityMismatches, 0);
assert.equal(healthyAudit.ok, true);

console.log("✅ Phase 3B1 asynchronous fired-receipt settlement watchdog fixture passed");
