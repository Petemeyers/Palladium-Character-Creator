const integer = (value) => Number.isInteger(Number(value)) ? Number(value) : null;

export function getNextContinuationActionSequence(completedActionSequence) {
  const completed = integer(completedActionSequence);
  if (completed == null || completed < 1) {
    return { ok: false, reason: "invalid-completed-action-sequence" };
  }
  return { ok: true, completedActionSequence: completed, nextActionSequence: completed + 1 };
}

export function createActionContinuationReceipt({
  continuationId,
  continuationKey,
  generationId,
  initiativeTurnId,
  actorId,
  completedActionToken,
  completedActionType,
  completedActionSequence,
  remainingActions,
  source = "combat-action-completion",
  createdAt = Date.now(),
} = {}) {
  const sequence = getNextContinuationActionSequence(completedActionSequence);
  const id = continuationId || continuationKey;
  if (!sequence.ok || !id || !continuationKey || !generationId || !initiativeTurnId || !actorId || !completedActionToken) {
    return { ok: false, reason: sequence.reason || "incomplete-continuation-identity" };
  }
  return {
    ok: true,
    record: {
      continuationId: id,
      // Compatibility alias while AI entry points still name this value authorizationId.
      authorizationId: id,
      continuationKey,
      generationId,
      combatSession: generationId,
      initiativeTurnId,
      actorId,
      completedActionToken,
      completedActionType: completedActionType || "unknown",
      completedActionSequence: sequence.completedActionSequence,
      nextActionSequence: sequence.nextActionSequence,
      remainingActions: Math.max(0, Number(remainingActions) || 0),
      remainingActionsAtCreation: Math.max(0, Number(remainingActions) || 0),
      source,
      pending: true,
      state: "created",
      createdAt,
      firedAt: null,
      consumedAt: null,
      consumedByActionToken: null,
      consumedByActionType: null,
    },
  };
}

export function fireActionContinuationReceipt(record, firedAt = Date.now()) {
  if (!record || record.state !== "created" || record.continuationId !== (record.authorizationId || record.continuationId)) {
    return { ok: false, reason: "continuation-not-created" };
  }
  return { ok: true, record: { ...record, state: "fired", pending: false, firedAt } };
}

export function validateActionContinuationAdmission({
  record,
  receipt,
  generationId,
  initiativeTurnId,
  actorId,
  requestedActionSequence,
  remainingActions,
  combatActive,
  actorCapable,
  actionLegal,
  completedActionCanonical,
} = {}) {
  const receiptId = receipt?.continuationId || receipt?.authorizationId;
  const recordId = record?.continuationId || record?.authorizationId;
  const expectedSequence = getNextContinuationActionSequence(record?.completedActionSequence);
  const valid = Boolean(
    record && receipt && record.state === "fired" &&
    recordId && receiptId === recordId &&
    receipt.continuationKey === record.continuationKey &&
    receipt.generationId === generationId && record.generationId === generationId &&
    receipt.initiativeTurnId === initiativeTurnId && record.initiativeTurnId === initiativeTurnId &&
    receipt.actorId === actorId && record.actorId === actorId &&
    receipt.completedActionToken === record.completedActionToken &&
    receipt.completedActionSequence === record.completedActionSequence &&
    expectedSequence.ok && expectedSequence.nextActionSequence === requestedActionSequence &&
    receipt.nextActionSequence === requestedActionSequence && record.nextActionSequence === requestedActionSequence &&
    Number(remainingActions) > 0 && combatActive === true && actorCapable === true && actionLegal === true &&
    completedActionCanonical === true
  );
  return valid
    ? { ok: true, accepted: true, authorizationRecord: record, actionSequence: requestedActionSequence }
    : { ok: false, accepted: false, reason: expectedSequence.ok ? "missing-or-invalid-fired-continuation" : expectedSequence.reason, authorizationRecord: record || null };
}

export function consumeActionContinuationReceipt(record, {
  actionToken,
  actionType,
  consumedAt = Date.now(),
} = {}) {
  if (!record || record.state !== "fired" || !actionToken || !actionType) {
    return { ok: false, reason: "continuation-not-consumable", record: record || null };
  }
  return {
    ok: true,
    record: {
      ...record,
      state: "consumed",
      pending: false,
      consumedAt,
      consumedByActionToken: actionToken,
      consumedByActionType: actionType,
      // Compatibility fields used by existing lifecycle audits.
      authorizedActionToken: actionToken,
      authorizedActionSequence: record.nextActionSequence,
      authorizationConsumedAt: consumedAt,
    },
  };
}

export function rejectActionContinuationReceipt(record, reason, rejectedAt = Date.now()) {
  if (!record || !["created", "fired"].includes(record.state)) return record || null;
  return {
    ...record,
    state: "rejected",
    pending: false,
    terminalReason: reason || "continuation-admission-rejected",
    rejectedAt,
  };
}

export function auditSettledActionContinuationReceipts(records, {
  initiativeTurnId,
  actorId,
} = {}) {
  const entries = Array.from(records?.entries?.() || []).filter(([, record]) => (
    record?.initiativeTurnId === initiativeTurnId && record?.actorId === actorId
  ));
  const activeFired = entries.filter(([, record]) => record?.state === "fired");
  const exactIdentityMismatches = entries.filter(([key, record]) => key !== record?.continuationKey).length;
  return {
    ok: activeFired.length === 0 && exactIdentityMismatches === 0,
    initiativeTurnId,
    actorId,
    created: entries.filter(([, record]) => Boolean(record?.createdAt)).length,
    fired: entries.filter(([, record]) => Boolean(record?.firedAt)).length,
    consumed: entries.filter(([, record]) => record?.state === "consumed").length,
    rejected: entries.filter(([, record]) => record?.state === "rejected").length,
    canceled: entries.filter(([, record]) => String(record?.state || "").startsWith("canceled")).length,
    activeFired: activeFired.length,
    activeFiredEntries: activeFired,
    exactIdentityMismatches,
  };
}
