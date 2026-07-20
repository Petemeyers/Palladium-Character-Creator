import assert from "node:assert/strict";

import {
  createCanonicalGrappleAdmission,
  createCanonicalGrappleExecutionKey,
  transitionCanonicalGrappleExecutionRecord,
} from "../src/utils/combat/canonicalGrappleExecution.js";
import {
  createArmoredActionPlanRegistry,
  markArmoredActionPlanDispatched,
  markArmoredActionPlanTerminal,
  registerArmoredActionPlan,
} from "../src/utils/combat/armoredActionPlanRegistry.js";

const generationId = "fixture-generation";
const initiativeTurnId = "fixture-turn";
const actionToken = `${initiativeTurnId}:2`;
const planId = "armored-plan-17";
const planExecutionKey = "armored-plan-execution|17";

const plans = createArmoredActionPlanRegistry();
assert.equal(registerArmoredActionPlan(plans, {
  planId,
  planExecutionKey,
  actorId: "knight-a",
  targetId: "knight-b",
  selectedTechnique: "grapple",
}).ok, true);
assert.equal(markArmoredActionPlanDispatched(plans, planId).ok, true);

const keyResult = createCanonicalGrappleExecutionKey({
  generationId,
  initiativeTurnId,
  actionToken,
  actorId: "knight-a",
  opponentId: "knight-b",
  actionSequence: 2,
});
assert.equal(keyResult.ok, true);
assert.notEqual(keyResult.executionKey, planId);
assert.notEqual(keyResult.executionKey, planExecutionKey);

let execution = {
  executionKey: keyResult.executionKey,
  generationId,
  initiativeTurnId,
  actionToken,
  actionSequence: 2,
  actorId: "knight-a",
  opponentId: "knight-b",
  actionType: "grapple",
  state: "created",
};
assert.equal(markArmoredActionPlanTerminal(plans, planId, "consumed", {
  consumedByCanonicalActionToken: actionToken,
}).ok, true);
assert.equal(plans.get(planId).state, "consumed");
assert.equal(execution.state, "created", "plan consumption cannot terminalize canonical execution");

for (const state of ["selected", "dispatched", "resolving", "roll-claimed", "committed", "completed"]) {
  const transitioned = transitionCanonicalGrappleExecutionRecord(execution, state, 100);
  assert.equal(transitioned.ok, true, `${execution.state} -> ${state}`);
  execution = transitioned.record;
}
assert.equal(execution.state, "completed");

const admissionResult = createCanonicalGrappleAdmission({
  generationId,
  initiativeTurnId,
  actionToken,
  actionSequence: 2,
  actorId: "knight-a",
  opponentId: "knight-b",
  actionType: "grapple",
  executionKey: keyResult.executionKey,
  continuationAuthorizationId: "receipt-17",
  continuationKey: "continuation-17",
  source: "fixture",
  admittedAt: 100,
}, { freeze: true });
assert.equal(admissionResult.ok, true);
assert.equal(Object.isFrozen(admissionResult.admission), true);
assert.equal(admissionResult.admission.actionSequence, 2);
assert.equal(admissionResult.admission.actionToken, actionToken);
assert.equal(admissionResult.admission.executionKey, keyResult.executionKey);

console.log("✅ Phase 3B1 tactical-plan/canonical-execution identity runtime fixture passed");
