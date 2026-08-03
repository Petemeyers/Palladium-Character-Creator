import {
  createTacticalActionIntent,
  buildTacticalAttackExecutionKey,
  isTacticalActionTerminal,
  transitionTacticalAction,
} from "./tacticalActionIntent.js";
import { resolveTacticalAttackIntent } from "./resolveTacticalAttackIntent.js";
import {
  admitTacticalReactionResolution,
  auditTacticalReactionOwnership,
  cleanupTacticalReactionRuntime,
  completeTacticalReactionResolution,
  createTacticalReactionRuntime,
  getTacticalReactionWindowByExecution,
  invalidateTacticalReactionWindow,
  openTacticalReactionWindow,
  progressTacticalReactionWindows,
} from "./tacticalReactionWindow.js";
import {
  auditTacticalPostParryOwnership,
  cleanupTacticalPostParryRuntime,
  createTacticalPostParryRuntime,
  openTacticalPostParryWindow,
  progressTacticalPostParryWindows,
} from "./tacticalPostParryWindow.js";

const activeActor = (fighter) => {
  const hp = fighter?.currentHP ?? fighter?.currentHp ?? fighter?.hp ?? fighter?.hitPoints?.current ?? fighter?.health;
  return Boolean(
    fighter && (hp === undefined || hp === null || hp === "" || Number(hp) > 0)
    && !fighter.dead && !fighter.isDead && !fighter.unconscious && !fighter.isUnconscious
    && !fighter.defeated && !fighter.isDefeated && !fighter.routed && fighter.canAct !== false
    && !["routed", "broken", "panicked", "surrendering", "cowering"].includes(String(
      fighter.routingState || fighter.moraleState || fighter.state?.moraleState || "",
    ).toLowerCase())
  );
};
const idOf = (fighter) => String(fighter?.id ?? fighter?._id ?? fighter?.actorId ?? "");

export function createTacticalActionRuntime({
  generationId = 0,
  combatSession = 0,
  maxTerminalHistory = 128,
  maxClaimHistory = 256,
} = {}) {
  return {
    generationId: Number(generationId),
    combatSession: Number(combatSession),
    activeActions: new Map(),
    recoveryByActor: new Map(),
    executionKeys: new Set(),
    executionKeyOrder: [],
    ammunitionReleaseKeys: new Set(),
    ammunitionReleaseKeyOrder: [],
    terminalHistory: [],
    reactionRuntime: createTacticalReactionRuntime({ generationId, combatSession, maxTerminalHistory, maxResolutionHistory: maxClaimHistory }),
    postParryRuntime: createTacticalPostParryRuntime({ generationId, combatSession, maxHistory: maxTerminalHistory, maxClaims: maxClaimHistory }),
    maxTerminalHistory: Math.max(16, Number(maxTerminalHistory) || 128),
    maxClaimHistory: Math.max(32, Number(maxClaimHistory) || 256),
    postCombatMutationsBlocked: 0,
    closed: false,
    cleanupCompleted: false,
    cleanupReason: null,
    lastCleanup: null,
  };
}

export function getTacticalActorOwnership(runtime, actorId) {
  const key = String(actorId ?? "");
  const action = runtime?.activeActions?.get(key) || null;
  const recovery = runtime?.recoveryByActor?.get(key) || null;
  const postParryWindowId = runtime?.postParryRuntime?.responderOwnership?.get(key) || null;
  const postParryWindow = postParryWindowId
    ? runtime.postParryRuntime.activeWindows.get(postParryWindowId) || null
    : null;
  return {
    actorId: key,
    state: postParryWindow ? "post-parry-response" : recovery ? "recovering" : action?.state || "unowned",
    action,
    recovery,
    postParryWindow,
  };
}

const retainTerminal = (runtime, intent) => {
  runtime.terminalHistory.push(intent);
  while (runtime.terminalHistory.length > runtime.maxTerminalHistory) runtime.terminalHistory.shift();
};

const retainClaim = (runtime, set, order, key) => {
  set.add(key);
  order.push(key);
  while (order.length > runtime.maxClaimHistory) {
    set.delete(order.shift());
  }
};

const rejectClosedRuntime = (runtime) => {
  if (!runtime?.closed) return null;
  runtime.postCombatMutationsBlocked += 1;
  return { accepted: false, reason: "tactical-action-runtime-closed" };
};

export function registerTacticalAction(runtime, input, { releaseRequested = true } = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-action-runtime-required" };
  const closed = rejectClosedRuntime(runtime);
  if (closed) return closed;
  const created = input?.state ? { accepted: true, intent: input } : createTacticalActionIntent(input);
  if (!created.accepted) return created;
  const intent = created.intent;
  if (intent.generationId !== runtime.generationId) return { accepted: false, reason: "stale-generation" };
  if (intent.combatSession !== runtime.combatSession) return { accepted: false, reason: "stale-combat-session" };
  if (runtime.activeActions.has(intent.actorId)) return { accepted: false, reason: "duplicate-action-ownership" };
  if (runtime.recoveryByActor.has(intent.actorId)) return { accepted: false, reason: "actor-recovering" };
  if (runtime.postParryRuntime?.responderOwnership?.has(intent.actorId)) {
    return { accepted: false, reason: "actor-owns-post-parry-response" };
  }
  const preparing = transitionTacticalAction(intent, "preparing", { releaseRequested: Boolean(releaseRequested) });
  if (!preparing.accepted) return preparing;
  runtime.activeActions.set(intent.actorId, preparing.intent);
  return { accepted: true, intent: preparing.intent };
}

export function requestTacticalActionRelease(runtime, actorId, expected = {}) {
  const closed = rejectClosedRuntime(runtime);
  if (closed) return closed;
  const action = runtime?.activeActions?.get(String(actorId ?? ""));
  if (!action) return { accepted: false, reason: "no-active-tactical-action" };
  if (expected.actionIntentId && action.actionIntentId !== expected.actionIntentId) {
    return { accepted: false, reason: "stale-tactical-action-intent" };
  }
  if (expected.generationId !== undefined && action.generationId !== Number(expected.generationId)) {
    return { accepted: false, reason: "stale-generation" };
  }
  if (expected.combatSession !== undefined && action.combatSession !== Number(expected.combatSession)) {
    return { accepted: false, reason: "stale-combat-session" };
  }
  if (action.state !== "ready") return { accepted: false, reason: "tactical-action-not-ready" };
  if (action.releaseRequested === true) return { accepted: false, reason: "tactical-release-already-requested" };
  const updated = Object.freeze({ ...action, releaseRequested: true });
  runtime.activeActions.set(updated.actorId, updated);
  return { accepted: true, intent: updated };
}

export function cancelTacticalAction(runtime, actorId, reason = "manual-cancel", expected = {}) {
  const closed = rejectClosedRuntime(runtime);
  if (closed) return closed;
  const key = String(actorId ?? "");
  const action = runtime?.activeActions?.get(key);
  if (!action) return { accepted: false, reason: "no-active-tactical-action" };
  if (expected.actionIntentId && action.actionIntentId !== expected.actionIntentId) {
    return { accepted: false, reason: "stale-tactical-action-intent" };
  }
  if (expected.generationId !== undefined && action.generationId !== Number(expected.generationId)) {
    return { accepted: false, reason: "stale-generation" };
  }
  if (expected.combatSession !== undefined && action.combatSession !== Number(expected.combatSession)) {
    return { accepted: false, reason: "stale-combat-session" };
  }
  if (!["planned", "preparing", "ready"].includes(action.state)) {
    return { accepted: false, reason: "tactical-action-cannot-cancel" };
  }
  const canceled = transitionTacticalAction(action, "canceled", { invalidationReason: reason });
  if (!canceled.accepted) return canceled;
  runtime.activeActions.delete(key);
  retainTerminal(runtime, canceled.intent);
  return { accepted: true, intent: canceled.intent };
}

export function claimTacticalExecution(runtime, executionKey) {
  const closed = rejectClosedRuntime(runtime);
  if (closed) return closed;
  if (!executionKey) return { accepted: false, reason: "tactical-execution-key-required" };
  if (runtime.executionKeys.has(executionKey)) return { accepted: false, reason: "duplicate-tactical-attack-execution" };
  retainClaim(runtime, runtime.executionKeys, runtime.executionKeyOrder, executionKey);
  return { accepted: true, executionKey };
}

export function claimTacticalProjectileRelease(runtime, executionKey) {
  const closed = rejectClosedRuntime(runtime);
  if (closed) return closed;
  if (!executionKey) return { accepted: false, reason: "tactical-projectile-key-required" };
  if (runtime.ammunitionReleaseKeys.has(executionKey)) {
    return { accepted: false, reason: "duplicate-ammunition-release" };
  }
  retainClaim(runtime, runtime.ammunitionReleaseKeys, runtime.ammunitionReleaseKeyOrder, executionKey);
  return { accepted: true, executionKey };
}

function validateAction({ runtime, intent, fighters, combatActive, validateAction }) {
  if (!combatActive) return { valid: false, terminal: "interrupted", reason: "combat-ended" };
  if (intent.generationId !== runtime.generationId) return { valid: false, terminal: "invalidated", reason: "stale-generation" };
  if (intent.combatSession !== runtime.combatSession) return { valid: false, terminal: "invalidated", reason: "stale-combat-session" };
  const actor = fighters.find((fighter) => idOf(fighter) === intent.actorId);
  const target = fighters.find((fighter) => idOf(fighter) === intent.targetActorId);
  if (!actor || !activeActor(actor)) return { valid: false, terminal: "interrupted", reason: "attacker-not-combat-capable" };
  if (!target || !activeActor(target) || target.team === actor.team) return { valid: false, terminal: "invalidated", reason: "target-invalid" };
  const external = validateAction?.({ intent, actor, target });
  if (external && external.valid === false) return { terminal: "invalidated", ...external };
  return { valid: true, actor, target };
}

const actionEvent = (eventType, intent, pulseIndex, data = {}) => ({
  eventType,
  actorId: intent.actorId,
  data: {
    generationId: intent.generationId,
    combatSession: intent.combatSession,
    pulseIndex,
    actorId: intent.actorId,
    targetActorId: intent.targetActorId,
    actionIntentId: intent.actionIntentId,
    weaponId: intent.weaponId,
    techniqueId: intent.techniqueId,
    executionKey: intent.executionKey,
    readyAtPulse: intent.readyAtPulse,
    releaseAtPulse: intent.releaseAtPulse,
    recoveryUntilPulse: intent.recoveryUntilPulse,
    ...data,
  },
});

export function completeTacticalRecoveryBoundaries({ runtime, pulseIndex, onEvent } = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-action-runtime-required", events: [] };
  if (runtime.closed) return { accepted: false, reason: "tactical-action-runtime-closed", events: [] };
  const events = [];
  const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  for (const [actorId, recovery] of [...runtime.recoveryByActor]) {
    if (pulseIndex < recovery.recoveryUntilPulse) continue;
    runtime.recoveryByActor.delete(actorId);
    const completed = transitionTacticalAction(recovery, "completed", { completedAtPulse: pulseIndex });
    if (completed.accepted) retainTerminal(runtime, completed.intent);
    emit(actionEvent("tactical-action-recovery-completed", completed.intent || recovery, pulseIndex, {
      previousState: "recovering",
      nextState: "completed",
    }));
  }
  return { accepted: true, events };
}

export async function advanceTacticalActionRuntime({
  runtime,
  pulseIndex,
  fighters = [],
  combatActive = true,
  validateAction: externalValidation,
  executeCanonicalAttack,
  spendCanonicalAmmunition,
  getReactionControlMode,
  selectAIReaction,
  createCanonicalPostParryOffer,
  validatePostParryResponse,
  executeCanonicalPostParryResponse,
  getPostParryControlMode,
  selectAIPostParryResponse,
  onEvent,
} = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-action-runtime-required", events: [] };
  const closed = rejectClosedRuntime(runtime);
  if (closed) return { ...closed, events: [], audit: auditTacticalActionOwnership(runtime) };
  const events = [];
  const emit = (entry) => { events.push(entry); onEvent?.(entry); };

  completeTacticalRecoveryBoundaries({ runtime, pulseIndex, onEvent: emit });
  progressTacticalReactionWindows({
    runtime: runtime.reactionRuntime,
    pulseIndex,
    fighters,
    combatActive,
    onEvent: emit,
  });
  const postParryProgress = await progressTacticalPostParryWindows({
    runtime: runtime.postParryRuntime,
    pulseIndex,
    fighters,
    combatActive,
    validateResponse: validatePostParryResponse,
    executeCanonicalResponse: executeCanonicalPostParryResponse,
    onEvent: emit,
  });
  const postParryActorsSettledThisPulse = new Set((postParryProgress.events || [])
    .filter((entry) => [
      "tactical-post-parry-resolution-completed",
      "tactical-post-parry-window-expired",
      "tactical-post-parry-window-invalidated",
      "tactical-post-parry-window-canceled",
    ].includes(entry.eventType))
    .map((entry) => String(entry.actorId || entry.data?.respondingActorId || ""))
    .filter(Boolean));

  for (const recovery of runtime.recoveryByActor.values()) {
    emit(actionEvent("tactical-action-recovery-progress", recovery, pulseIndex, {
      pulsesRemaining: Math.max(0, recovery.recoveryUntilPulse - pulseIndex),
    }));
  }

  for (const [actorId, current] of [...runtime.activeActions]) {
    let intent = current;
    if (runtime.postParryRuntime?.responderOwnership?.has(actorId) || postParryActorsSettledThisPulse.has(actorId)) {
      emit(actionEvent("tactical-action-held-for-post-parry-response", intent, pulseIndex, {
        postParryWindowId: runtime.postParryRuntime.responderOwnership.get(actorId),
      }));
      continue;
    }
    const validation = validateAction({ runtime, intent, fighters, combatActive, validateAction: externalValidation });
    if (!validation.valid) {
      if (intent.reactionWindowId) {
        invalidateTacticalReactionWindow({
          runtime: runtime.reactionRuntime,
          reactionWindowId: intent.reactionWindowId,
          pulseIndex,
          reason: validation.reason,
          onEvent: emit,
        });
      }
      const nextState = validation.terminal || "invalidated";
      const patch = nextState === "interrupted"
        ? { interruptionReason: validation.reason }
        : { invalidationReason: validation.reason };
      const terminal = transitionTacticalAction(intent, nextState, patch);
      runtime.activeActions.delete(actorId);
      if (terminal.accepted) {
        retainTerminal(runtime, terminal.intent);
        emit(actionEvent(nextState === "interrupted" ? "tactical-action-interrupted" : "tactical-action-invalidated", terminal.intent, pulseIndex, {
          previousState: intent.state, nextState, interruptionReason: terminal.intent.interruptionReason,
          invalidationReason: terminal.intent.invalidationReason,
        }));
      }
      continue;
    }
    emit(actionEvent("tactical-action-intent-validated", intent, pulseIndex, { validationStage: intent.state }));

    if (intent.state === "preparing" && pulseIndex < intent.readyAtPulse) {
      emit(actionEvent("tactical-action-preparation-progress", intent, pulseIndex, { pulsesRemaining: intent.readyAtPulse - pulseIndex }));
      continue;
    }
    if (intent.state === "preparing") {
      const ready = transitionTacticalAction(intent, "ready");
      if (!ready.accepted) continue;
      intent = ready.intent;
      runtime.activeActions.set(actorId, intent);
      emit(actionEvent("tactical-action-ready", intent, pulseIndex, { previousState: "preparing", nextState: "ready" }));
    }
    if (intent.state === "ready" && intent.releaseRequested !== false) {
      const resolving = transitionTacticalAction(intent, "resolving");
      if (!resolving.accepted) continue;
      const executionKey = buildTacticalAttackExecutionKey(resolving.intent, pulseIndex);
      const claim = claimTacticalExecution(runtime, executionKey);
      if (!claim.accepted) {
        const invalid = transitionTacticalAction(resolving.intent, "invalidated", { invalidationReason: claim.reason });
        runtime.activeActions.delete(actorId);
        if (invalid.accepted) retainTerminal(runtime, invalid.intent);
        continue;
      }
      intent = Object.freeze({ ...resolving.intent, executionKey });
      runtime.activeActions.set(actorId, intent);
      emit(actionEvent("tactical-attack-resolution-admitted", intent, pulseIndex, { previousState: "ready", nextState: "resolving", executionKey }));
      if (intent.actionType === "ranged-attack") {
        let ammunition;
        try {
          ammunition = await spendCanonicalAmmunition?.({
            actorId: intent.actorId,
            targetActorId: intent.targetActorId,
            weaponId: intent.weaponId,
            actionIntentId: intent.actionIntentId,
            executionKey,
            amount: 1,
            pulseIndex,
            projectileReleased: true,
          });
        } catch (error) {
          ammunition = { accepted: false, reason: "canonical-ammunition-callback-threw", errorName: error?.name || "Error" };
        }
        if (!ammunition?.accepted || Number(ammunition.spent ?? 0) !== 1) {
          const reason = ammunition?.reason || "canonical-ammunition-spend-required";
          const invalid = transitionTacticalAction(intent, "invalidated", { invalidationReason: reason, executionKey });
          runtime.activeActions.delete(actorId);
          if (invalid.accepted) retainTerminal(runtime, invalid.intent);
          emit(actionEvent("tactical-attack-resolution-rejected", invalid.intent || intent, pulseIndex, {
            previousState: "resolving", nextState: "invalidated", executionKey, invalidationReason: reason,
          }));
          continue;
        }
        const projectileClaim = claimTacticalProjectileRelease(runtime, executionKey);
        if (!projectileClaim.accepted) {
          const invalid = transitionTacticalAction(intent, "invalidated", { invalidationReason: projectileClaim.reason, executionKey });
          runtime.activeActions.delete(actorId);
          if (invalid.accepted) retainTerminal(runtime, invalid.intent);
          continue;
        }
        intent = Object.freeze({ ...intent, ammunition: Object.freeze({ ...ammunition }) });
        runtime.activeActions.set(actorId, intent);
        emit(actionEvent("tactical-ranged-release", intent, pulseIndex, { executionKey, ammunitionSpent: 1 }));
      }
      const reaction = openTacticalReactionWindow({
        runtime: runtime.reactionRuntime,
        intent,
        executionKey,
        pulseIndex,
        fighters,
        permitsReaction: ["melee-attack", "ranged-attack"].includes(intent.actionType),
        policyReason: ["melee-attack", "ranged-attack"].includes(intent.actionType)
          ? null
          : "action-type-does-not-permit-ordinary-reaction",
        getControlMode: getReactionControlMode,
        selectAIResponse: selectAIReaction,
        onEvent: emit,
      });
      if (!reaction.accepted) {
        if (reaction.noWindow) {
          emit(actionEvent("tactical-reaction-window-not-opened", intent, pulseIndex, {
            executionKey,
            permitsReaction: false,
            reason: reaction.reason,
          }));
        }
        const invalid = transitionTacticalAction(intent, "invalidated", { invalidationReason: reaction.reason, executionKey });
        runtime.activeActions.delete(actorId);
        if (invalid.accepted) retainTerminal(runtime, invalid.intent);
        emit(actionEvent("tactical-attack-resolution-rejected", invalid.intent || intent, pulseIndex, {
          previousState: "resolving", nextState: "invalidated", executionKey, invalidationReason: reaction.reason,
        }));
        continue;
      }
      intent = Object.freeze({ ...intent, reactionWindowId: reaction.window.reactionWindowId });
      runtime.activeActions.set(actorId, intent);
      continue;
    }
    if (intent.state !== "resolving" || !intent.reactionWindowId || !intent.executionKey) continue;
    const reactionWindow = getTacticalReactionWindowByExecution(runtime.reactionRuntime, intent.executionKey);
    if (!reactionWindow) {
      const invalid = transitionTacticalAction(intent, "invalidated", { invalidationReason: "reaction-window-no-longer-active" });
      runtime.activeActions.delete(actorId);
      if (invalid.accepted) retainTerminal(runtime, invalid.intent);
      emit(actionEvent("tactical-attack-resolution-rejected", invalid.intent || intent, pulseIndex, {
        previousState: "resolving", nextState: "invalidated", executionKey: intent.executionKey,
        invalidationReason: "reaction-window-no-longer-active",
      }));
      continue;
    }
    if (reactionWindow.state !== "locked") continue;
    const reactionAdmission = admitTacticalReactionResolution({
      runtime: runtime.reactionRuntime,
      reactionWindowId: reactionWindow.reactionWindowId,
      pulseIndex,
      onEvent: emit,
    });
    if (!reactionAdmission.accepted) continue;
    const resolved = await resolveTacticalAttackIntent({
      intent,
      pulseIndex,
      executionKey: intent.executionKey,
      executionAlreadyClaimed: true,
      reactionAdmission: Object.freeze({
        reactionWindowId: reactionAdmission.window.reactionWindowId,
        reactionResponseId: reactionAdmission.response?.reactionResponseId || null,
        responseType: reactionAdmission.response?.responseType || "decline",
        responderId: reactionAdmission.response?.responderId || reactionAdmission.window.primaryTargetId,
        protectedActorId: reactionAdmission.response?.protectedActorId || reactionAdmission.window.primaryTargetId,
        defenderId: reactionAdmission.window.primaryTargetId,
        sourceActionIntentId: reactionAdmission.window.sourceActionIntentId,
        sourceExecutionKey: reactionAdmission.window.sourceExecutionKey,
        generationId: reactionAdmission.window.generationId,
        combatSession: reactionAdmission.window.combatSession,
        openedAtPulse: reactionAdmission.window.openedAtPulse,
        lockedAtPulse: reactionAdmission.window.lockedAtPulse,
      }),
      ammunition: intent.ammunition || null,
      ammunitionAlreadySpent: intent.actionType === "ranged-attack",
      executeCanonicalAttack,
      spendCanonicalAmmunition,
      claimExecution: (executionKey) => claimTacticalExecution(runtime, executionKey),
      onRelease: ({ executionKey }) => {
        const projectileClaim = claimTacticalProjectileRelease(runtime, executionKey);
        if (projectileClaim.accepted) {
          emit(actionEvent("tactical-ranged-release", intent, pulseIndex, { executionKey }));
        }
      },
    });
    if (!resolved.accepted) {
      invalidateTacticalReactionWindow({
        runtime: runtime.reactionRuntime,
        reactionWindowId: reactionAdmission.window.reactionWindowId,
        pulseIndex,
        reason: resolved.reason,
        onEvent: emit,
      });
      const invalid = transitionTacticalAction(intent, "invalidated", {
        invalidationReason: resolved.reason,
        executionKey: resolved.executionKey || null,
      });
      runtime.activeActions.delete(actorId);
      if (invalid.accepted) retainTerminal(runtime, invalid.intent);
      emit(actionEvent("tactical-attack-resolution-rejected", invalid.intent || intent, pulseIndex, {
        previousState: intent.state, nextState: "invalidated", executionKey: resolved.executionKey,
        invalidationReason: resolved.reason,
      }));
      continue;
    }
    completeTacticalReactionResolution({
      runtime: runtime.reactionRuntime,
      reactionWindowId: reactionAdmission.window.reactionWindowId,
      pulseIndex,
      result: resolved.result,
      onEvent: emit,
    });
    const canonicalDefenseResult = resolved.result?.defenseResult || null;
    if (
      canonicalDefenseResult?.parryAttempted === true
      && canonicalDefenseResult?.parrySucceeded === true
      && ["parry_advantage", "parry_dominant"].includes(canonicalDefenseResult?.parryQuality)
      && typeof createCanonicalPostParryOffer === "function"
    ) {
      let offerResult;
      try {
        offerResult = await createCanonicalPostParryOffer({
          defenseResult: canonicalDefenseResult,
          intent,
          executionKey: resolved.executionKey,
          pulseIndex,
          fighters,
        });
      } catch (error) {
        offerResult = { accepted: false, reason: "canonical-post-parry-offer-callback-threw", errorName: error?.name || "Error" };
      }
      if (offerResult?.accepted && offerResult.canonicalOffer) {
        openTacticalPostParryWindow({
          runtime: runtime.postParryRuntime,
          defenseResult: Object.freeze({
            ...canonicalDefenseResult,
            generationId: intent.generationId,
            combatSession: intent.combatSession,
            sourceActionIntentId: intent.actionIntentId,
            sourceExecutionKey: resolved.executionKey,
          }),
          canonicalOffer: offerResult.canonicalOffer,
          pulseIndex,
          fighters,
          controlMode: getPostParryControlMode?.(canonicalDefenseResult.responderId, fighters) || "ai",
          selectAIResponse: selectAIPostParryResponse,
          aiContext: offerResult.aiContext || {},
          onEvent: emit,
        });
      }
    }
    const resolvingWithKey = Object.freeze({ ...intent, executionKey: resolved.executionKey });
    const contactState = intent.actionType === "ranged-attack" && resolved.result?.projectileReleased !== false
      ? "released"
      : "contact-resolved";
    const contact = transitionTacticalAction(resolvingWithKey, contactState, {
      releaseAtPulse: pulseIndex,
      result: resolved.result,
    });
    emit(actionEvent("tactical-attack-resolution-completed", contact.intent, pulseIndex, { previousState: "resolving", nextState: contactState, executionKey: resolved.executionKey }));

    const recoveryUntilPulse = pulseIndex + intent.recoveryDuration;
    const recovering = transitionTacticalAction(contact.intent, "recovering", { recoveryUntilPulse });
    runtime.activeActions.delete(actorId);
    runtime.recoveryByActor.set(actorId, recovering.intent);
    emit(actionEvent("tactical-action-recovery-started", recovering.intent, pulseIndex, { previousState: contactState, nextState: "recovering", recoveryUntilPulse }));
  }

  emit({ eventType: "tactical-action-ownership-audit", actorId: null, data: auditTacticalActionOwnership(runtime) });
  return { accepted: true, events, audit: auditTacticalActionOwnership(runtime) };
}

export function cleanupTacticalActionRuntime(runtime, reason = "combat-ended") {
  if (!runtime) return { accepted: false, reason: "tactical-action-runtime-required" };
  if (runtime.cleanupCompleted) {
    return { accepted: false, reason: "tactical-action-cleanup-already-completed", eventType: null, data: runtime.lastCleanup };
  }
  const counts = {
    pendingActionCount: 0,
    preparingActionCount: 0,
    readyActionCount: 0,
    resolvingActionCount: 0,
    recoveryCount: runtime.recoveryByActor.size,
    releaseRequestCount: 0,
    projectileClaimCount: runtime.ammunitionReleaseKeys.size,
  };
  const reactionCleanup = cleanupTacticalReactionRuntime(runtime.reactionRuntime, reason);
  const postParryCleanup = cleanupTacticalPostParryRuntime(runtime.postParryRuntime, reason);
  for (const action of runtime.activeActions.values()) {
    counts.pendingActionCount += 1;
    if (action.state === "preparing") counts.preparingActionCount += 1;
    if (action.state === "ready") counts.readyActionCount += 1;
    if (action.state === "resolving") counts.resolvingActionCount += 1;
    if (action.releaseRequested === true) counts.releaseRequestCount += 1;
    const nextState = action.state === "ready" ? "invalidated" : "interrupted";
    const terminal = transitionTacticalAction(action, nextState, nextState === "interrupted" ? { interruptionReason: reason } : { invalidationReason: reason });
    if (terminal.accepted) retainTerminal(runtime, terminal.intent);
  }
  for (const recovery of runtime.recoveryByActor.values()) {
    const terminal = transitionTacticalAction(recovery, "interrupted", { interruptionReason: reason });
    if (terminal.accepted) retainTerminal(runtime, terminal.intent);
  }
  runtime.activeActions.clear();
  runtime.recoveryByActor.clear();
  runtime.closed = true;
  runtime.cleanupCompleted = true;
  runtime.cleanupReason = reason;
  runtime.lastCleanup = {
    ...counts,
    reactionCleanup: reactionCleanup.data || null,
    postParryCleanup: postParryCleanup.data || null,
    postCombatMutationsBlocked: runtime.postCombatMutationsBlocked,
    matches: runtime.activeActions.size === 0 && runtime.recoveryByActor.size === 0,
  };
  return {
    accepted: true,
    eventType: "tactical-action-terminal-cleanup",
    data: runtime.lastCleanup,
    reactionCleanup,
    postParryCleanup,
  };
}

export function auditTacticalActionOwnership(runtime) {
  const activeActorIds = [...runtime.activeActions.keys()];
  const recoveryActorIds = [...runtime.recoveryByActor.keys()];
  const overlapActorIds = activeActorIds.filter((actorId) => runtime.recoveryByActor.has(actorId));
  return {
    activeActionCount: activeActorIds.length,
    recoveryCount: recoveryActorIds.length,
    resolvingCount: [...runtime.activeActions.values()].filter((action) => action.state === "resolving").length,
    overlapActorIds,
    executionKeyCount: runtime.executionKeys.size,
    ammunitionReleaseCount: runtime.ammunitionReleaseKeys.size,
    releaseRequestCount: [...runtime.activeActions.values()].filter((action) => action.releaseRequested === true).length,
    projectileClaimCount: runtime.ammunitionReleaseKeys.size,
    terminalHistoryCount: runtime.terminalHistory.length,
    reaction: auditTacticalReactionOwnership(runtime.reactionRuntime),
    postParry: auditTacticalPostParryOwnership(runtime.postParryRuntime),
    matches: overlapActorIds.length === 0,
  };
}

export function resetTacticalActionCoordinates(runtime, { generationId, combatSession } = {}) {
  const cleanup = cleanupTacticalActionRuntime(runtime, "coordinate-reset");
  runtime.generationId = Number(generationId);
  runtime.combatSession = Number(combatSession);
  runtime.executionKeys.clear();
  runtime.executionKeyOrder.length = 0;
  runtime.ammunitionReleaseKeys.clear();
  runtime.ammunitionReleaseKeyOrder.length = 0;
  runtime.closed = false;
  runtime.cleanupCompleted = false;
  runtime.cleanupReason = null;
  runtime.lastCleanup = null;
  runtime.postCombatMutationsBlocked = 0;
  runtime.reactionRuntime = createTacticalReactionRuntime({
    generationId,
    combatSession,
    maxTerminalHistory: runtime.maxTerminalHistory,
    maxResolutionHistory: runtime.maxClaimHistory,
  });
  runtime.postParryRuntime = createTacticalPostParryRuntime({
    generationId,
    combatSession,
    maxHistory: runtime.maxTerminalHistory,
    maxClaims: runtime.maxClaimHistory,
  });
  return cleanup;
}

export function isActorTacticallyBusy(runtime, actorId) {
  const ownership = getTacticalActorOwnership(runtime, actorId);
  return ownership.state !== "unowned";
}

export { isTacticalActionTerminal };
