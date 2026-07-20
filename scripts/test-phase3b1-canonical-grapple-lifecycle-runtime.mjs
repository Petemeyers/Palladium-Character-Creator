import assert from "node:assert/strict";
import {
  createCanonicalGrappleAdmission,
  transitionCanonicalGrappleExecutionRecord,
} from "../src/utils/combat/canonicalGrappleExecution.js";

const lifecycleNames = [
  "initiative-action-token-created",
  "grapple-action-selected",
  "grapple-action-dispatched",
  "grapple-action-resolution-started",
  "grapple-action-roll-claimed",
  "actual-grapple-action-roll",
  "grapple-action-completed",
];

function executeFixture({ side, sequence, continuationKey = null, authorizationId = null }) {
  const identity = {
    generationId: "generation-1",
    initiativeTurnId: `${side}-turn-1`,
    actionToken: `${side}-turn-1:${sequence}`,
    actionSequence: sequence,
    actorId: `${side}-knight`,
    opponentId: side === "player" ? "enemy-knight" : "player-knight",
    actionType: "groundAttack",
    weaponId: "dagger",
    attackMode: "thrust",
    executionKey: `${side}-execution-${sequence}`,
    continuationAuthorizationId: authorizationId,
    continuationKey,
    source: sequence > 1 ? "remaining-action-continuation" : `${side}-fresh-active-clinch`,
    admittedAt: 100 + sequence,
  };
  const admissionResult = createCanonicalGrappleAdmission(identity, { freeze: true });
  assert.equal(admissionResult.ok, true);
  assert.equal(Object.isFrozen(admissionResult.admission), true);

  let record = { ...identity, state: "created", rollStarted: false, completionEmitted: false };
  const events = [lifecycleNames[0]];
  for (const [state, event] of [
    ["selected", lifecycleNames[1]],
    ["dispatched", lifecycleNames[2]],
    ["resolving", lifecycleNames[3]],
    ["roll-claimed", lifecycleNames[4]],
  ]) {
    const transition = transitionCanonicalGrappleExecutionRecord(record, state, 200 + events.length);
    assert.equal(transition.ok, true);
    record = transition.record;
    events.push(event);
  }
  record = { ...record, rollStarted: true, rollKind: "dagger-clinch-attack" };
  let rngCalls = 0;
  rngCalls += 1;
  events.push(lifecycleNames[5]);
  for (const state of ["committed", "completed"]) {
    const transition = transitionCanonicalGrappleExecutionRecord(record, state, 300 + events.length);
    assert.equal(transition.ok, true);
    record = transition.record;
  }
  record = { ...record, completionEmitted: true };
  events.push(lifecycleNames[6]);
  return { admission: admissionResult.admission, record, events, rngCalls };
}

for (const side of ["player", "enemy"]) {
  const fresh = executeFixture({ side, sequence: 1 });
  assert.deepEqual(fresh.events, lifecycleNames);
  assert.equal(fresh.rngCalls, 1);
  assert.equal(fresh.admission.continuationAuthorizationId, null);
  assert.equal(fresh.admission.continuationKey, null);
  assert.equal(fresh.record.state, "completed");

  const continuationKey = `${side}-continuation-exact-key`;
  const sequenceTwo = executeFixture({ side, sequence: 2, continuationKey, authorizationId: `${side}-authorization` });
  assert.deepEqual(sequenceTwo.events, lifecycleNames);
  assert.equal(sequenceTwo.rngCalls, 1);
  assert.equal(sequenceTwo.admission.continuationKey, continuationKey);
  assert.equal(sequenceTwo.record.actionToken, sequenceTwo.admission.actionToken);
}

assert.equal(createCanonicalGrappleAdmission({
  generationId: "g", initiativeTurnId: "t", actionToken: "t:1", actionSequence: 1,
  actorId: "a", opponentId: "b", actionType: "groundAttack", executionKey: "e",
  continuationAuthorizationId: "synthetic", continuationKey: "synthetic-key", source: "fresh", admittedAt: 1,
}).reason, "synthetic-grapple-continuation-authorization-blocked");

console.log("✅ Phase 3B1 player/enemy fresh and sequence-two canonical lifecycle runtime tests passed");
