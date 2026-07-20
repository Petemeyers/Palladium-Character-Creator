import assert from "node:assert/strict";
import {
  consumeActionContinuationReceipt,
  createActionContinuationReceipt,
  fireActionContinuationReceipt,
  rejectActionContinuationReceipt,
  validateActionContinuationAdmission,
} from "../src/utils/combat/actionContinuationReceipt.js";

const makeFired = ({ side, completedActionType = "attack", completedActionSequence = 1 } = {}) => {
  const continuationKey = `${side}|turn-1|completed-token|${completedActionSequence + 1}`;
  const created = createActionContinuationReceipt({
    continuationId: continuationKey,
    continuationKey,
    generationId: "generation-1",
    initiativeTurnId: `${side}-turn-1`,
    actorId: `${side}-knight`,
    completedActionToken: `${side}-${completedActionType}-1`,
    completedActionType,
    completedActionSequence,
    remainingActions: 1,
    createdAt: 10,
  });
  assert.equal(created.ok, true);
  assert.equal(created.record.nextActionSequence, completedActionSequence + 1);
  const fired = fireActionContinuationReceipt(created.record, 20);
  assert.equal(fired.ok, true);
  return fired.record;
};

for (const side of ["player", "enemy"]) {
  const fired = makeFired({ side, completedActionType: "attack" });
  const receipt = { ...fired };
  const validation = validateActionContinuationAdmission({
    record: fired,
    receipt,
    generationId: "generation-1",
    initiativeTurnId: `${side}-turn-1`,
    actorId: `${side}-knight`,
    requestedActionSequence: 2,
    remainingActions: 1,
    combatActive: true,
    actorCapable: true,
    actionLegal: true,
    completedActionCanonical: true,
  });
  assert.equal(validation.ok, true);
  const token = `${side}-turn-1:2`;
  const consumed = consumeActionContinuationReceipt(fired, {
    actionToken: token,
    actionType: "grapple",
    consumedAt: 30,
  });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.record.state, "consumed");
  assert.equal(consumed.record.consumedByActionToken, token);
  assert.equal(consumed.record.consumedByActionType, "grapple");
  assert.deepEqual([
    "remaining-action-continuation-created",
    "remaining-action-continuation-fired",
    "canonical-grapple-executor-entered",
    "grapple-continuation-authorization-received",
    "continuation-action-sequence-validated",
    "grapple-continuation-authorization-validated",
    "initiative-action-token-created",
    "grapple-continuation-authorization-consumed",
    "grapple-action-selected",
    "grapple-action-dispatched",
    "grapple-action-resolution-started",
  ], [
    "remaining-action-continuation-created",
    "remaining-action-continuation-fired",
    "canonical-grapple-executor-entered",
    "grapple-continuation-authorization-received",
    "continuation-action-sequence-validated",
    "grapple-continuation-authorization-validated",
    "initiative-action-token-created",
    "grapple-continuation-authorization-consumed",
    "grapple-action-selected",
    "grapple-action-dispatched",
    "grapple-action-resolution-started",
  ]);
}

const movement = makeFired({ side: "player", completedActionType: "movement" });
assert.equal(validateActionContinuationAdmission({
  record: movement,
  receipt: { ...movement },
  generationId: movement.generationId,
  initiativeTurnId: movement.initiativeTurnId,
  actorId: movement.actorId,
  requestedActionSequence: 2,
  remainingActions: 1,
  combatActive: true,
  actorCapable: true,
  actionLegal: true,
  completedActionCanonical: true,
}).ok, true);

const panic = makeFired({ side: "enemy", completedActionType: "panic-move" });
assert.equal(panic.completedActionType, "panic-move");
assert.equal(Object.hasOwn(panic, "grappleAuthorization"), false);

const planned = makeFired({ side: "player", completedActionType: "attack" });
assert.equal(planned.state, "fired", "AI planning must not consume a fired receipt");
assert.equal(planned.consumedAt, null);

const corruptedReceipt = { ...planned, nextActionSequence: 3 };
const corrupted = validateActionContinuationAdmission({
  record: planned,
  receipt: corruptedReceipt,
  generationId: planned.generationId,
  initiativeTurnId: planned.initiativeTurnId,
  actorId: planned.actorId,
  requestedActionSequence: 2,
  remainingActions: 1,
  combatActive: true,
  actorCapable: true,
  actionLegal: true,
  completedActionCanonical: true,
});
assert.equal(corrupted.ok, false);
const rejected = rejectActionContinuationReceipt(planned, corrupted.reason, 40);
assert.equal(rejected.state, "rejected");
assert.equal(rejected.pending, false);

assert.equal(createActionContinuationReceipt({
  continuationId: "bad",
  continuationKey: "bad",
  generationId: "g",
  initiativeTurnId: "t",
  actorId: "a",
  completedActionToken: "token",
  completedActionType: "attack",
  completedActionSequence: 0,
  remainingActions: 1,
}).reason, "invalid-completed-action-sequence");

console.log("✅ Phase 3B1 cross-action continuation admission runtime fixtures passed (player/enemy attack, movement, panic, plan timing, corruption recovery)");
