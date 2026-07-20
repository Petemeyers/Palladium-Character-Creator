import assert from "node:assert/strict";

import {
  consumeActionContinuationReceipt,
  createActionContinuationReceipt,
  fireActionContinuationReceipt,
  validateActionContinuationAdmission,
} from "../src/utils/combat/actionContinuationReceipt.js";

for (const consumingActionType of ["attack", "grapple", "movement", "morale", "pass"]) {
  const created = createActionContinuationReceipt({
    continuationId: `receipt-${consumingActionType}`,
    continuationKey: `key-${consumingActionType}`,
    generationId: "generation",
    initiativeTurnId: "turn",
    actorId: "knight",
    completedActionToken: `turn:1:${consumingActionType}`,
    completedActionType: "attack",
    completedActionSequence: 1,
    remainingActions: 1,
    createdAt: 10,
  });
  assert.equal(created.ok, true);
  const fired = fireActionContinuationReceipt(created.record, 20);
  assert.equal(fired.ok, true);
  const continuationAuthorization = Object.freeze(fired.record);
  const validation = validateActionContinuationAdmission({
    record: continuationAuthorization,
    receipt: continuationAuthorization,
    generationId: "generation",
    initiativeTurnId: "turn",
    actorId: "knight",
    requestedActionSequence: 2,
    remainingActions: 1,
    combatActive: true,
    actorCapable: true,
    actionLegal: true,
    completedActionCanonical: true,
  });
  assert.equal(validation.ok, true);
  const consumingActionToken = `turn:2:${consumingActionType}`;
  const consumed = consumeActionContinuationReceipt(continuationAuthorization, {
    actionToken: consumingActionToken,
    actionType: consumingActionType,
    consumedAt: 30,
  });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.record.state, "consumed");
  assert.equal(consumed.record.consumedByActionToken, consumingActionToken);
  assert.equal(consumed.record.consumedByActionType, consumingActionType);
  assert.equal(consumed.record.nextActionSequence, 2);
}

console.log("✅ Phase 3B1 action-neutral receipt consumption runtime fixtures passed");
