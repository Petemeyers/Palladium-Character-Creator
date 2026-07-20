export const CANONICAL_GRAPPLE_EXECUTION_TRANSITIONS = Object.freeze({
  created: Object.freeze(["selected", "rejected"]),
  selected: Object.freeze(["dispatched", "rejected"]),
  dispatched: Object.freeze(["resolving", "rejected"]),
  resolving: Object.freeze(["roll-claimed", "committed", "rejected", "canceled-combat-ended"]),
  "roll-claimed": Object.freeze(["committed", "canceled-combat-ended"]),
  committed: Object.freeze(["completed"]),
  completed: Object.freeze([]),
  rejected: Object.freeze([]),
  "canceled-combat-ended": Object.freeze([]),
});

const requiredAdmissionFields = [
  "generationId",
  "initiativeTurnId",
  "actionToken",
  "actionSequence",
  "actorId",
  "opponentId",
  "actionType",
  "executionKey",
  "source",
  "admittedAt",
];

export function createCanonicalGrappleExecutionKey({
  generationId,
  initiativeTurnId,
  actionToken,
  actorId,
  opponentId,
  actionSequence,
} = {}) {
  const sequence = Number(actionSequence);
  if (!generationId || !initiativeTurnId || !actionToken || !actorId || !opponentId || !Number.isInteger(sequence) || sequence < 1) {
    return { ok: false, reason: "incomplete-canonical-grapple-execution-identity" };
  }
  return {
    ok: true,
    executionKey: [
      "canonical-grapple-execution",
      generationId,
      initiativeTurnId,
      actionToken,
      actorId,
      opponentId,
      sequence,
    ].join("|"),
  };
}

export function createCanonicalGrappleAdmission(input = {}, { freeze = false } = {}) {
  const admission = {
    generationId: input.generationId,
    initiativeTurnId: input.initiativeTurnId,
    actionToken: input.actionToken,
    actionSequence: Number(input.actionSequence),
    actorId: input.actorId,
    opponentId: input.opponentId,
    actionType: input.actionType,
    weaponId: input.weaponId || null,
    attackMode: input.attackMode || null,
    executionKey: input.executionKey,
    continuationAuthorizationId: input.continuationAuthorizationId || null,
    continuationKey: input.continuationKey || null,
    source: input.source,
    admittedAt: input.admittedAt,
  };
  const missing = requiredAdmissionFields.filter((field) => (
    field === "actionSequence"
      ? !Number.isInteger(admission.actionSequence) || admission.actionSequence < 1
      : admission[field] == null || admission[field] === ""
  ));
  if (missing.length) return { ok: false, reason: "incomplete-canonical-grapple-admission", missing };
  if (admission.actionSequence === 1 && (admission.continuationAuthorizationId || admission.continuationKey)) {
    return { ok: false, reason: "synthetic-grapple-continuation-authorization-blocked" };
  }
  if (admission.actionSequence > 1 && (!admission.continuationAuthorizationId || !admission.continuationKey)) {
    return { ok: false, reason: "missing-grapple-continuation-authorization" };
  }
  return { ok: true, admission: freeze ? Object.freeze(admission) : admission };
}

export function transitionCanonicalGrappleExecutionRecord(record, nextState, at = Date.now()) {
  if (!record) return { ok: false, reason: "missing-grapple-execution-record" };
  const allowed = CANONICAL_GRAPPLE_EXECUTION_TRANSITIONS[record.state] || [];
  if (!allowed.includes(nextState)) {
    return { ok: false, reason: "illegal-grapple-execution-transition", from: record.state, to: nextState };
  }
  const timestampField = {
    selected: "selectedAt",
    dispatched: "dispatchedAt",
    resolving: "resolvingAt",
    "roll-claimed": "rollClaimedAt",
    committed: "committedAt",
    completed: "completedAt",
    rejected: "rejectedAt",
    "canceled-combat-ended": "completedAt",
  }[nextState];
  return { ok: true, record: { ...record, state: nextState, ...(timestampField ? { [timestampField]: at } : {}) } };
}
