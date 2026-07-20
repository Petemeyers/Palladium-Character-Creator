export function normalizePlayerGrappleDispatcherContext(rawContext = {}) {
  const dispatchGrappleTurnAction = rawContext.dispatchGrappleTurnAction;
  return {
    ...rawContext,
    dispatchGrappleTurnAction:
      typeof dispatchGrappleTurnAction === "function" ? dispatchGrappleTurnAction : null,
    dispatcherChain: {
      ...(rawContext.dispatcherChain || {}),
      normalizedDispatcherPresent: typeof dispatchGrappleTurnAction === "function",
    },
  };
}

export function hasPlayerAiActionProgress(before = {}, after = {}, signals = {}) {
  return Boolean(
    Number(after.remainingActions) < Number(before.remainingActions) ||
    after.actionToken !== before.actionToken ||
    after.authoritativeExecution !== before.authoritativeExecution ||
    after.pendingContinuation !== before.pendingContinuation ||
    after.activeActorId !== before.activeActorId ||
    signals.turnHandoffStarted ||
    signals.actionScheduled ||
    signals.combatEnded
  );
}

export function executeMissingPlayerGrappleDispatcherRecovery({
  actorId,
  initiativeTurnId,
  opponentId = null,
  source = "player-ai-active-grapple",
  remainingActions = null,
} = {}, runtime = {}) {
  if (!actorId || !initiativeTurnId) {
    return { accepted: false, handled: false, terminal: true, reason: "missing-identity" };
  }

  const failureReason = "missing-grapple-dispatcher";
  const liveActor = runtime.getActor?.(actorId) || null;
  const remainingBefore = Number(remainingActions ?? liveActor?.remainingActions ?? 0) || 0;
  const registry = runtime.recoveryRegistry || new Map();
  const existingRecovery = Array.from(registry.values()).find((entry) => (
    entry?.initiativeTurnId === initiativeTurnId &&
    entry?.actorId === actorId &&
    entry?.failureReason === failureReason &&
    entry?.remainingActionsBefore === remainingBefore
  ));

  if (existingRecovery) {
    runtime.emitEvent?.("player-grapple-missing-dispatcher-recovery-duplicate-blocked", {
      initiativeTurnId,
      actorId,
      opponentId,
      source,
      recoveryKey: existingRecovery.recoveryKey,
      actionSequence: existingRecovery.actionSequence,
      existingRecovery,
    });
    return existingRecovery.result;
  }

  const actionSequence = (Number(runtime.getActionSequence?.() ?? 0) || 0) + 1;
  const recoveryKey = [initiativeTurnId, actorId, actionSequence, failureReason].join("|");
  runtime.emitEvent?.("grapple-dispatch-required-but-missing", {
    actorId,
    opponentId,
    initiativeTurnId,
    source,
    dispatcherPresent: false,
    grappleRollStarted: false,
    hpMutationApplied: false,
  });

  const actionSpent = remainingBefore > 0;
  const committedRemaining = actionSpent
    ? Number(runtime.commitPassAction?.(actorId, remainingBefore) ?? Math.max(0, remainingBefore - 1))
    : Math.max(0, remainingBefore);
  if (actionSpent) runtime.logPass?.(liveActor, source, remainingBefore, committedRemaining);
  runtime.setActionSequence?.(actionSequence);
  runtime.clearTransientOwnership?.();

  const pendingResult = {
    handled: true,
    terminal: true,
    accepted: true,
    actionSpent,
    recovery: "missing-grapple-dispatcher-safe-pass",
    remainingActions: committedRemaining,
  };
  const registryEntry = {
    recoveryKey,
    initiativeTurnId,
    actorId,
    actionSequence,
    failureReason,
    remainingActionsBefore: remainingBefore,
    result: pendingResult,
    completedAt: null,
  };
  registry.set(recoveryKey, registryEntry);

  const actionResult = {
    accepted: true,
    completed: true,
    actionType: "pass",
    actionSpent,
    actionsSpent: actionSpent ? 1 : 0,
    explicitPass: true,
    explicitTurnEndingEffect: false,
    remainingActions: committedRemaining,
    reason: failureReason,
    source: "player-grapple-missing-dispatcher-recovery",
    initiativeTurnId,
    actionToken: `${initiativeTurnId}:pass:${actionSequence}`,
    executionKey: recoveryKey,
  };
  const completionDecision = runtime.resolveCompletion?.({
    actorId,
    opponentId,
    executionKey: recoveryKey,
    source: "player-grapple-missing-dispatcher-recovery",
    actionResult,
  });
  const continuationScheduled = completionDecision?.decision === "continuation-created";
  const result = {
    ...pendingResult,
    completionDecision,
  };
  registry.set(recoveryKey, {
    ...registryEntry,
    result,
    completedAt: runtime.now?.() ?? Date.now(),
  });
  runtime.emitEvent?.("player-grapple-missing-dispatcher-recovery-completed", {
    initiativeTurnId,
    actorId,
    opponentId,
    source: "player-grapple-missing-dispatcher-recovery",
    remainingActionsBefore: remainingBefore,
    remainingActionsAfter: committedRemaining,
    actionSpent,
    continuationScheduled,
    handoffRequested: !continuationScheduled,
    completionArbiterCalled: completionDecision !== undefined,
    completionDecision: completionDecision?.decision || null,
  });
  return result;
}
