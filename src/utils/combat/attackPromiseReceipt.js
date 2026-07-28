const TERMINAL_STATES = new Set(["completed", "canceled", "ignored"]);

export function createAttackPromiseReceipt({
  generationId,
  initiativeTurnId,
  actorId,
  targetId,
  executionKey,
  actionSequence,
  source,
} = {}) {
  if (!generationId || !actorId || !executionKey) {
    throw new TypeError("Attack completion receipts require generation, actor, and execution identity");
  }
  return Object.freeze({
    generationId,
    initiativeTurnId: initiativeTurnId ?? null,
    actorId,
    targetId: targetId ?? null,
    executionKey,
    actionSequence: Number(actionSequence) || 1,
    source: source || "attack",
    state: "pending",
  });
}

export function settleAttackPromiseReceipt(registry, receipt, {
  generationId,
  initiativeTurnId,
  activeActorId,
  combatActive = true,
  finalizerOwned = false,
} = {}) {
  if (!(registry instanceof Map) || !receipt?.executionKey) {
    return { accepted: false, ignored: true, reason: "missing-receipt-registry" };
  }
  const current = registry.get(receipt.executionKey) || receipt;
  if (TERMINAL_STATES.has(current.state)) {
    return { accepted: false, ignored: true, reason: "receipt-already-settled", receipt: current };
  }
  let reason = null;
  if (current.generationId !== generationId) reason = "generation-changed";
  else if (current.initiativeTurnId && current.initiativeTurnId !== initiativeTurnId) reason = "initiative-turn-changed";
  else if (activeActorId && current.actorId !== activeActorId) reason = "active-actor-changed";
  else if (!combatActive) reason = "combat-ended";
  else if (finalizerOwned) reason = "completion-already-owned";
  const next = Object.freeze({
    ...current,
    state: reason ? "ignored" : "completed",
    completionReason: reason || "current-completion",
  });
  registry.set(receipt.executionKey, next);
  return reason
    ? { accepted: false, ignored: true, reason, receipt: next }
    : { accepted: true, ignored: false, reason: "current-completion", receipt: next };
}
