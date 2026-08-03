import {
  buildTacticalChargeExecutionKey,
  createTacticalChargeIntent,
  transitionTacticalCharge,
} from "./tacticalChargeIntent.js";
import {
  createTacticalBraceIntent,
  transitionTacticalBrace,
} from "./tacticalBraceIntent.js";
import {
  chargeStepCrossesBraceZone,
  createTacticalInterceptionWindow,
  lockTacticalInterceptionWindow,
  selectDeterministicBraceCandidate,
  submitTacticalInterceptionChoice,
  TACTICAL_INTERCEPTION_CHOICES,
  transitionTacticalInterceptionWindow,
} from "./tacticalInterceptionWindow.js";
import {
  deriveTacticalChargeContinuation,
  resolveTacticalBraceInterception,
} from "./resolveTacticalBraceInterception.js";

const idOf = (actor) => String(actor?.id ?? actor?._id ?? actor?.actorId ?? "");
const positionOf = (actor, positions = {}) => positions[idOf(actor)] || actor?.position || actor?.hex || actor;
const pointKey = (value) => `${Number(value?.x)},${Number(value?.y)}`;
const hexDistance = (left, right) => Math.max(Math.abs(Number(left?.x) - Number(right?.x)), Math.abs(Number(left?.y) - Number(right?.y)));
const terminalWindow = (window) => ["resolved", "declined", "canceled", "invalidated", "expired"].includes(window?.state);
const combatCapable = (actor) => Boolean(actor && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious && !actor.defeated && !actor.isDefeated && actor.canAct !== false);
const event = (eventType, value, pulseIndex, data = {}) => ({
  eventType,
  actorId: value?.chargerId || value?.bracingActorId || value?.interceptorId || null,
  data: {
    generationId: value?.generationId,
    combatSession: value?.combatSession,
    pulseIndex: Number(pulseIndex),
    cycleIndex: Math.floor(Math.max(0, Number(pulseIndex) - 1) / 6) + 1,
    chargeIntentId: value?.chargeIntentId || null,
    braceIntentId: value?.braceIntentId || null,
    interceptionWindowId: value?.interceptionWindowId || null,
    chargerId: value?.chargerId || null,
    interceptorId: value?.bracingActorId || value?.interceptorId || null,
    targetActorId: value?.targetActorId || null,
    weaponId: value?.weaponId || null,
    techniqueId: value?.techniqueId || null,
    ...data,
  },
});

const retain = (runtime, list, value, limit = runtime.maxTerminalHistory) => {
  list.push(value);
  while (list.length > limit) list.shift();
};
const claim = (runtime, set, order, key) => {
  if (!key || set.has(key)) return false;
  set.add(key);
  order.push(key);
  while (order.length > runtime.maxClaimHistory) set.delete(order.shift());
  return true;
};
const findActor = (fighters, actorId) => fighters.find((actor) => idOf(actor) === String(actorId));
const replace = (map, value, ownerField) => map.set(String(value[ownerField]), value);

export function createTacticalChargeBraceRuntime({ generationId = 0, combatSession = 0, maxTerminalHistory = 42, maxClaimHistory = 48 } = {}) {
  return {
    generationId: Number(generationId),
    combatSession: Number(combatSession),
    chargesByActor: new Map(),
    bracesByActor: new Map(),
    windowsByCharge: new Map(),
    movementClaims: new Set(), movementClaimOrder: [],
    movementClaimRecords: new Map(),
    movementStaminaClaims: new Set(), movementStaminaClaimOrder: [],
    triggerClaims: new Set(), triggerClaimOrder: [],
    completedTriggerClaims: new Set(), completedTriggerClaimOrder: [],
    interceptionExecutionClaims: new Set(), interceptionExecutionClaimOrder: [],
    contactExecutionClaims: new Set(), contactExecutionClaimOrder: [],
    terminalCharges: [], terminalBraces: [], terminalWindows: [],
    maxTerminalHistory: Math.max(8, Number(maxTerminalHistory) || 42),
    maxClaimHistory: Math.max(8, Number(maxClaimHistory) || 48),
    postTerminalMovementBlocked: 0,
    postTerminalAttacksBlocked: 0,
    closed: false,
    cleanupCompleted: false,
    lastCleanup: null,
  };
}

const coordinatesValid = (runtime, value) => value.generationId === runtime.generationId && value.combatSession === runtime.combatSession;
const settleTriggerClaim = (runtime, key) => {
  runtime.triggerClaims.delete(key);
  const orderIndex = runtime.triggerClaimOrder.indexOf(key);
  if (orderIndex >= 0) runtime.triggerClaimOrder.splice(orderIndex, 1);
  claim(runtime, runtime.completedTriggerClaims, runtime.completedTriggerClaimOrder, key);
};
const rejectClosed = (runtime, kind = "attack") => {
  if (!runtime?.closed) return null;
  if (kind === "movement") runtime.postTerminalMovementBlocked += 1;
  else runtime.postTerminalAttacksBlocked += 1;
  return { accepted: false, reason: "tactical-charge-brace-runtime-closed" };
};

export function registerTacticalCharge(runtime, input, { fighters = [], validateCharge } = {}) {
  if (!runtime) return { accepted: false, reason: "charge-runtime-required" };
  const closed = rejectClosed(runtime, "movement"); if (closed) return closed;
  const created = input?.chargeIntentId ? { accepted: true, intent: input } : createTacticalChargeIntent(input);
  if (!created.accepted) return created;
  const intent = created.intent;
  if (!coordinatesValid(runtime, intent)) return { accepted: false, reason: "stale-charge-coordinate" };
  if (runtime.chargesByActor.has(intent.chargerId) || runtime.bracesByActor.has(intent.chargerId)) return { accepted: false, reason: "duplicate-charge-or-brace-ownership" };
  const actor = findActor(fighters, intent.chargerId);
  const target = findActor(fighters, intent.targetActorId);
  if (fighters.length && (!combatCapable(actor) || !combatCapable(target) || actor.team === target.team)) return { accepted: false, reason: "charge-participants-invalid" };
  const external = validateCharge?.({ intent, actor, target });
  if (external?.valid === false) return { accepted: false, reason: external.reason || "charge-declaration-invalid" };
  const preparing = transitionTacticalCharge(intent, "preparing", { preparationStartedAtPulse: intent.declaredAtPulse });
  if (!preparing.accepted) return preparing;
  replace(runtime.chargesByActor, preparing.intent, "chargerId");
  return { accepted: true, intent: preparing.intent, events: [
    event("tactical-charge-intent-created", intent, intent.declaredAtPulse),
    event("tactical-charge-preparation-started", preparing.intent, intent.declaredAtPulse, { previousState: "planned", nextState: "preparing" }),
  ] };
}

export function registerTacticalBrace(runtime, input, { fighters = [], validateBrace } = {}) {
  if (!runtime) return { accepted: false, reason: "brace-runtime-required" };
  const closed = rejectClosed(runtime); if (closed) return closed;
  const created = input?.braceIntentId ? { accepted: true, intent: input } : createTacticalBraceIntent(input);
  if (!created.accepted) return created;
  const intent = created.intent;
  if (!coordinatesValid(runtime, intent)) return { accepted: false, reason: "stale-brace-coordinate" };
  if (runtime.bracesByActor.has(intent.bracingActorId) || runtime.chargesByActor.has(intent.bracingActorId)) return { accepted: false, reason: "duplicate-charge-or-brace-ownership" };
  const actor = findActor(fighters, intent.bracingActorId);
  if (fighters.length && !combatCapable(actor)) return { accepted: false, reason: "bracing-actor-invalid" };
  const external = validateBrace?.({ intent, actor });
  if (external?.valid === false) return { accepted: false, reason: external.reason || "brace-declaration-invalid" };
  const preparing = transitionTacticalBrace(intent, "preparing");
  replace(runtime.bracesByActor, preparing.intent, "bracingActorId");
  return { accepted: true, intent: preparing.intent, events: [
    event("tactical-brace-intent-created", intent, intent.declaredAtPulse),
    event("tactical-brace-preparation-started", preparing.intent, intent.declaredAtPulse, { previousState: "planned", nextState: "preparing" }),
  ] };
}

export function cancelTacticalCharge(runtime, actorId, reason = "manual-cancel") {
  const intent = runtime?.chargesByActor?.get(String(actorId));
  if (!intent) return { accepted: false, reason: "no-active-charge" };
  if (!["planned", "preparing", "ready", "committed"].includes(intent.state) || (intent.state === "committed" && intent.completedPath.length)) return { accepted: false, reason: "committed-charge-cannot-cancel" };
  const next = transitionTacticalCharge(intent, "canceled", { interruptionReason: reason });
  runtime.chargesByActor.delete(String(actorId)); retain(runtime, runtime.terminalCharges, next.intent);
  return { accepted: true, intent: next.intent };
}

export function cancelTacticalBrace(runtime, actorId, reason = "manual-cancel") {
  const intent = runtime?.bracesByActor?.get(String(actorId));
  if (!intent) return { accepted: false, reason: "no-active-brace" };
  if (!["planned", "preparing", "ready", "held"].includes(intent.state)) return { accepted: false, reason: "brace-cannot-cancel" };
  const next = transitionTacticalBrace(intent, "canceled", { invalidationReason: reason });
  runtime.bracesByActor.delete(String(actorId)); retain(runtime, runtime.terminalBraces, next.intent);
  return { accepted: true, intent: next.intent };
}

export function invalidateTacticalCharge(runtime, actorId, reason, pulseIndex = 0, onEvent) {
  const charge = runtime?.chargesByActor?.get(String(actorId));
  if (!charge) return { accepted: false, reason: "no-active-charge" };
  if (!["preparing", "ready", "committed", "advancing", "contact-pending"].includes(charge.state)) return { accepted: false, reason: "charge-not-invalidatable" };
  const next = transitionTacticalCharge(charge, "invalidated", { invalidationReason: reason });
  if (!next.accepted) return next;
  runtime.chargesByActor.delete(String(actorId));
  const window = runtime.windowsByCharge.get(charge.chargeIntentId);
  if (window) {
    runtime.windowsByCharge.delete(charge.chargeIntentId);
    retain(runtime, runtime.terminalWindows, { ...window, state: "invalidated", terminalReason: reason });
  }
  retain(runtime, runtime.terminalCharges, next.intent);
  onEvent?.(event("tactical-charge-invalidated", next.intent, pulseIndex, { invalidationReason: reason }));
  return { accepted: true, intent: next.intent };
}

export function progressTacticalChargeBracePreparation({ runtime, pulseIndex, fighters = [], positions = {}, validateCharge, validateBrace, onEvent } = {}) {
  if (!runtime) return { accepted: false, reason: "charge-brace-runtime-required", events: [] };
  const closed = rejectClosed(runtime); if (closed) return { ...closed, events: [] };
  const events = []; const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  for (const [actorId, original] of [...runtime.chargesByActor]) {
    let charge = original;
    const actor = findActor(fighters, charge.chargerId); const target = findActor(fighters, charge.targetActorId);
    const external = validateCharge?.({ intent: charge, actor, target });
    if (!combatCapable(actor) || !combatCapable(target) || actor?.team === target?.team || external?.valid === false) {
      const ended = transitionTacticalCharge(charge, charge.state === "preparing" ? "invalidated" : "interrupted", { invalidationReason: external?.reason || "charge-participant-invalid" });
      runtime.chargesByActor.delete(actorId); retain(runtime, runtime.terminalCharges, ended.intent);
      emit(event("tactical-charge-invalidated", ended.intent, pulseIndex, { invalidationReason: ended.intent.invalidationReason })); continue;
    }
    if (charge.state === "preparing" && pulseIndex >= charge.preparationStartedAtPulse + charge.preparationPulses) {
      const ready = transitionTacticalCharge(charge, "ready", { readyAtPulse: pulseIndex }); charge = ready.intent;
      emit(event("tactical-charge-ready", charge, pulseIndex, { previousState: "preparing", nextState: "ready" }));
      const movementOwnershipKey = `${charge.generationId}:${charge.combatSession}:${charge.chargerId}:charge-movement:${charge.chargeIntentId}`;
      const committed = transitionTacticalCharge(charge, "committed", {
        committedAtPulse: pulseIndex,
        committedPath: charge.plannedPath,
        currentPosition: positionOf(actor, positions),
        movementOwnershipKey,
      }); charge = committed.intent;
      emit(event("tactical-charge-committed", charge, pulseIndex, { previousState: "ready", nextState: "committed", movementOwnershipKey }));
    }
    replace(runtime.chargesByActor, charge, "chargerId");
  }
  for (const [actorId, original] of [...runtime.bracesByActor]) {
    let brace = original; const actor = findActor(fighters, brace.bracingActorId);
    const external = validateBrace?.({ intent: brace, actor });
    const current = positionOf(actor, positions);
    const moved = current && pointKey(current) !== pointKey(brace.anchorPosition);
    if (!combatCapable(actor) || moved || external?.valid === false) {
      const ended = transitionTacticalBrace(brace, "invalidated", { invalidationReason: moved ? "bracing-actor-moved" : external?.reason || "bracing-actor-invalid" });
      runtime.bracesByActor.delete(actorId); retain(runtime, runtime.terminalBraces, ended.intent);
      emit(event("tactical-brace-invalidated", ended.intent, pulseIndex, { invalidationReason: ended.intent.invalidationReason })); continue;
    }
    if (brace.state === "preparing" && pulseIndex >= brace.declaredAtPulse + brace.preparationPulses) {
      brace = transitionTacticalBrace(brace, "ready", { readyAtPulse: pulseIndex }).intent;
      emit(event("tactical-brace-ready", brace, pulseIndex, { previousState: "preparing", nextState: "ready" }));
      brace = transitionTacticalBrace(brace, "held").intent;
      emit(event("tactical-brace-held", brace, pulseIndex, { previousState: "ready", nextState: "held", guardedHexes: brace.guardedHexes }));
    }
    if (brace.state === "recovering" && pulseIndex >= brace.recoveryUntilPulse) {
      const completed = transitionTacticalBrace(brace, "completed").intent;
      runtime.bracesByActor.delete(actorId); retain(runtime, runtime.terminalBraces, completed); continue;
    }
    replace(runtime.bracesByActor, brace, "bracingActorId");
  }
  return { accepted: true, events, audit: auditTacticalChargeBraceOwnership(runtime) };
}

export function getTacticalChargeMovementPlan(runtime, actorId) {
  const charge = runtime?.chargesByActor?.get(String(actorId));
  if (!charge || !["committed", "advancing"].includes(charge.state)) return null;
  const start = charge.completedPath.length;
  return {
    accepted: true,
    charge,
    path: charge.committedPath.slice(start, start + charge.maximumStepsPerPulse),
    movementOwnershipKey: charge.movementOwnershipKey,
  };
}

export function claimTacticalChargeMovementStamina(runtime, ownershipKey) {
  if (!runtime || !ownershipKey) return { accepted: false, reason: "charge-stamina-ownership-required" };
  if (!claim(runtime, runtime.movementStaminaClaims, runtime.movementStaminaClaimOrder, ownershipKey)) {
    return { accepted: false, reason: "duplicate-charge-movement-stamina" };
  }
  return { accepted: true, ownershipKey };
}

export function submitTacticalInterceptionResponse(runtime, input = {}) {
  const window = [...(runtime?.windowsByCharge?.values() || [])].find((entry) => entry.interceptionWindowId === input.interceptionWindowId);
  if (!window) return { accepted: false, reason: "interception-window-not-found" };
  const submitted = submitTacticalInterceptionChoice(window, input.choice, input);
  if (!submitted.accepted) return submitted;
  runtime.windowsByCharge.set(window.chargeIntentId, submitted.window);
  return { accepted: true, window: submitted.window, events: [event("tactical-interception-choice-submitted", submitted.window, input.pulseIndex ?? window.openedAtPulse, { selectedResponse: input.choice })] };
}

export async function resolveTacticalChargeStepBoundary({
  runtime, charge, from, to, stepIndex, pulseIndex, fighters = [], getInterceptionControlMode,
  selectAIInterception, executeCanonicalAttack, readCanonicalPosition, validateCharge, validateBrace, onEvent,
} = {}) {
  const closed = rejectClosed(runtime, "movement"); if (closed) return closed;
  const live = runtime?.chargesByActor?.get(charge?.chargerId);
  if (!live || live.chargeIntentId !== charge.chargeIntentId || !coordinatesValid(runtime, live)) return { accepted: false, reason: "stale-charge-movement" };
  const expectedFrom = live.currentPosition || live.startingPosition;
  const expectedTo = live.committedPath[live.completedPath.length];
  if (pointKey(expectedFrom) !== pointKey(from) || pointKey(expectedTo) !== pointKey(to) || stepIndex !== live.completedPath.length) {
    return { accepted: false, reason: "charge-step-identity-mismatch" };
  }
  const charger = findActor(fighters, live.chargerId);
  const target = findActor(fighters, live.targetActorId);
  const chargeValidation = validateCharge?.({ intent: live, actor: charger, target, proposedMovementStep: { from, to, stepIndex } });
  if (!combatCapable(charger) || !combatCapable(target) || charger?.team === target?.team || chargeValidation?.valid === false) {
    const reason = chargeValidation?.reason || "charge-participant-invalid";
    invalidateTacticalCharge(runtime, live.chargerId, reason, pulseIndex, onEvent);
    return { accepted: false, reason };
  }
  const movementClaim = Object.freeze({
    generationId: live.generationId,
    combatSession: live.combatSession,
    chargeIntentId: live.chargeIntentId,
    actionIntentId: live.actionIntentId,
    chargerId: live.chargerId,
    targetActorId: live.targetActorId,
    pulseIndex: Number(pulseIndex),
    pathStepIndex: Number(stepIndex),
    from: Object.freeze({ ...from }),
    to: Object.freeze({ ...to }),
    movementOwnershipKey: live.movementOwnershipKey,
  });
  const stepClaimKey = [
    live.generationId, live.combatSession, live.chargeIntentId, live.actionIntentId,
    live.chargerId, live.targetActorId, pulseIndex, stepIndex,
    `${pointKey(from)}>${pointKey(to)}`,
  ].join(":");
  if (runtime.movementClaims.has(stepClaimKey)) return { accepted: false, reason: "duplicate-charge-step" };
  const candidates = [];
  for (const brace of runtime.bracesByActor.values()) {
    const bracer = findActor(fighters, brace.bracingActorId);
    const external = validateBrace?.({ intent: brace, actor: bracer });
    if (external?.valid === false || !combatCapable(bracer)) continue;
    if (chargeStepCrossesBraceZone({ charge: live, brace, from, to, charger, bracer })) {
      candidates.push({ brace, bracer, crossedBoundaryIndex: stepIndex, interceptionDistance: hexDistance(to, brace.anchorPosition),
        initiativeTotal: bracer?.currentInitiativeTotal ?? bracer?.initiativeTotal ?? bracer?.initiative ?? 0,
        initiativeRank: bracer?.currentInitiativeRank ?? bracer?.initiativeRank ?? Infinity });
    }
  }
  const selected = selectDeterministicBraceCandidate(candidates);
  if (!selected) return { accepted: true, commitStep: true, stepClaimKey, movementClaim, charge: live };
  const triggerClaimKey = `${live.chargeIntentId}:${selected.brace.braceIntentId}:${stepIndex}`;
  let window = runtime.windowsByCharge.get(live.chargeIntentId);
  if (!window) {
    if (runtime.completedTriggerClaims.has(triggerClaimKey)) return { accepted: false, reason: "brace-trigger-already-settled" };
    if (!claim(runtime, runtime.triggerClaims, runtime.triggerClaimOrder, triggerClaimKey)) return { accepted: false, reason: "duplicate-brace-trigger" };
    const created = createTacticalInterceptionWindow({ charge: live, brace: selected.brace, proposedMovementStep: { from, to, stepIndex }, pulseIndex, reactionDepth: 0 });
    if (!created.accepted) return created;
    window = created.window; runtime.windowsByCharge.set(live.chargeIntentId, window);
    onEvent?.(event("tactical-brace-trigger-detected", selected.brace, pulseIndex, { chargeIntentId: live.chargeIntentId, from, to, pathStepIndex: stepIndex, guardedZone: selected.brace.guardedHexes }));
    onEvent?.(event("tactical-interception-window-created", window, pulseIndex));
    for (const rejected of candidates.filter((entry) => entry !== selected)) onEvent?.(event("tactical-brace-trigger-rejected", rejected.brace, pulseIndex, { chargeIntentId: live.chargeIntentId, reason: "competing-interceptor-lost" }));
  }
  if (terminalWindow(window)) return { accepted: true, commitStep: true, stepClaimKey, movementClaim, window };
  if (!window.selectedResponse) {
    const mode = getInterceptionControlMode?.(selected.bracer) || selected.bracer?.controlMode || "ai";
    if (mode === "manual" && pulseIndex <= window.responseDeadlinePulse) return { accepted: true, commitStep: false, pendingInterception: true, window };
    if (mode === "manual") {
      const expired = transitionTacticalInterceptionWindow(window, "expired", {
        resolvedAtPulse: pulseIndex,
        terminalReason: "manual-choice-deadline-expired-let-pass",
      }).window;
      runtime.windowsByCharge.delete(live.chargeIntentId);
      settleTriggerClaim(runtime, triggerClaimKey);
      retain(runtime, runtime.terminalWindows, expired);
      onEvent?.(event("tactical-interception-window-expired", expired, pulseIndex, {
        expirationPolicy: "let-pass",
        responseDeadlinePulse: window.responseDeadlinePulse,
      }));
      return { accepted: true, commitStep: true, stepClaimKey, movementClaim, window: expired, interceptionOutcome: "expired-let-pass" };
    }
    const aiChoice = await selectAIInterception?.({ window, charge: live, brace: selected.brace, charger, interceptor: selected.bracer }) || TACTICAL_INTERCEPTION_CHOICES.INTERCEPT;
    const submitted = submitTacticalInterceptionChoice(window, aiChoice, { interceptorId: selected.brace.bracingActorId });
    if (!submitted.accepted) return submitted;
    window = submitted.window; runtime.windowsByCharge.set(live.chargeIntentId, window);
    onEvent?.(event("tactical-interception-choice-submitted", window, pulseIndex, { selectedResponse: aiChoice, source: "ai" }));
  }
  const locked = lockTacticalInterceptionWindow(window, pulseIndex);
  if (!locked.accepted) return locked;
  window = locked.window; runtime.windowsByCharge.set(live.chargeIntentId, window);
  onEvent?.(event("tactical-interception-window-locked", window, pulseIndex, { selectedResponse: window.selectedResponse, executionKey: window.executionKey }));
  if (window.state === "declined") {
    settleTriggerClaim(runtime, triggerClaimKey);
    retain(runtime, runtime.terminalWindows, window); runtime.windowsByCharge.delete(live.chargeIntentId);
    return { accepted: true, commitStep: true, stepClaimKey, movementClaim, window, interceptionOutcome: "declined" };
  }
  if (!claim(runtime, runtime.interceptionExecutionClaims, runtime.interceptionExecutionClaimOrder, window.executionKey)) return { accepted: false, reason: "duplicate-interception-execution" };
  const resolvingWindow = transitionTacticalInterceptionWindow(window, "resolving").window;
  runtime.windowsByCharge.set(live.chargeIntentId, resolvingWindow);
  const resolvingBrace = transitionTacticalBrace(selected.brace, "triggered", { triggeredAtPulse: pulseIndex, triggerChargeIntentId: live.chargeIntentId, triggerActorId: live.chargerId, interceptionExecutionKey: window.executionKey }).intent;
  replace(runtime.bracesByActor, transitionTacticalBrace(resolvingBrace, "resolving").intent, "bracingActorId");
  onEvent?.(event("tactical-interception-resolution-admitted", resolvingWindow, pulseIndex, { executionKey: window.executionKey, reactionDepth: 1 }));
  const canonicalResult = await resolveTacticalBraceInterception({ admission: { window: resolvingWindow, charge: live, brace: selected.brace, executionKey: window.executionKey, pulseIndex }, executeCanonicalAttack });
  if (runtime.closed || !coordinatesValid(runtime, live)) {
    runtime.postTerminalAttacksBlocked += 1;
    return { accepted: false, reason: runtime.closed ? "post-terminal-interception-blocked" : "stale-interception-coordinate" };
  }
  if (canonicalResult?.accepted === false) {
    const invalidatedWindow = transitionTacticalInterceptionWindow(resolvingWindow, "invalidated", {
      resolvedAtPulse: pulseIndex,
      terminalReason: canonicalResult.reason || "canonical-interception-admission-rejected",
      result: canonicalResult,
    }).window;
    settleTriggerClaim(runtime, triggerClaimKey);
    retain(runtime, runtime.terminalWindows, invalidatedWindow);
    runtime.windowsByCharge.delete(live.chargeIntentId);
    let preservedBrace = runtime.bracesByActor.get(selected.brace.bracingActorId);
    preservedBrace = transitionTacticalBrace(preservedBrace, "held", {
      triggeredAtPulse: null,
      triggerChargeIntentId: null,
      triggerActorId: null,
      interceptionExecutionKey: null,
      result: null,
    }).intent;
    replace(runtime.bracesByActor, preservedBrace, "bracingActorId");
    onEvent?.(event("tactical-interception-window-invalidated", invalidatedWindow, pulseIndex, {
      invalidationReason: invalidatedWindow.terminalReason,
      braceConsumed: false,
    }));
    return {
      accepted: true,
      commitStep: true,
      stepClaimKey,
      movementClaim,
      window: invalidatedWindow,
      canonicalResult,
      interceptionOutcome: "canonical-admission-rejected-let-pass",
    };
  }
  const latestCharger = canonicalResult?.charger || canonicalResult?.target || findActor(canonicalResult?.fighters || fighters, live.chargerId) || charger;
  const authoritativePosition = await readCanonicalPosition?.(live.chargerId, canonicalResult)
    || positionOf(latestCharger, {});
  const continuation = deriveTacticalChargeContinuation({ charge: live, charger: latestCharger, canonicalResult, authoritativePosition });
  const completedWindow = transitionTacticalInterceptionWindow(resolvingWindow, "resolved", { resolvedAtPulse: pulseIndex, result: canonicalResult }).window;
  settleTriggerClaim(runtime, triggerClaimKey);
  retain(runtime, runtime.terminalWindows, completedWindow); runtime.windowsByCharge.delete(live.chargeIntentId);
  let brace = runtime.bracesByActor.get(selected.brace.bracingActorId);
  brace = transitionTacticalBrace(brace, "consumed", { consumedAtPulse: pulseIndex, result: canonicalResult }).intent;
  onEvent?.(event("tactical-brace-consumed", brace, pulseIndex, { result: canonicalResult?.result || canonicalResult?.outcome || null }));
  brace = transitionTacticalBrace(brace, "recovering", { recoveryUntilPulse: pulseIndex + brace.recoveryPulses }).intent;
  replace(runtime.bracesByActor, brace, "bracingActorId");
  onEvent?.(event("tactical-interception-resolution-completed", completedWindow, pulseIndex, {
    executionKey: window.executionKey,
    continuationOutcome: continuation.outcome,
    stopReason: continuation.reason,
    defensiveReactionWindowOpened: canonicalResult?.defensiveReactionWindowOpened === true,
    postParryOpportunityCreated: canonicalResult?.postParryOpportunityCreated === true,
  }));
  if (["stopped", "disrupted", "charger-defeated", "invalidated"].includes(continuation.outcome)) {
    const terminalState = continuation.outcome === "invalidated" ? "invalidated" : continuation.outcome === "disrupted" ? "interrupted" : "stopped";
    const stopped = transitionTacticalCharge(live, terminalState, { interruptionReason: continuation.reason, result: canonicalResult, currentPosition: continuation.authoritativePosition || live.currentPosition }).intent;
    runtime.chargesByActor.delete(live.chargerId); retain(runtime, runtime.terminalCharges, stopped);
    const terminalEvent = continuation.outcome === "invalidated" ? "tactical-charge-invalidated" : continuation.outcome === "disrupted" ? "tactical-charge-disrupted" : "tactical-charge-stopped";
    onEvent?.(event(terminalEvent, stopped, pulseIndex, { stopReason: continuation.reason, authoritativePosition: continuation.authoritativePosition || null }));
    return { accepted: true, commitStep: false, chargeStopped: true, window: completedWindow, canonicalResult, continuation };
  }
  return { accepted: true, commitStep: true, stepClaimKey, movementClaim, window: completedWindow, canonicalResult, continuation };
}

export function completeTacticalChargeStep({ runtime, actorId, from, to, stepIndex, stepClaimKey, movementClaim, pulseIndex, onEvent } = {}) {
  const closed = rejectClosed(runtime, "movement"); if (closed) return closed;
  const charge = runtime?.chargesByActor?.get(String(actorId));
  if (!charge || !["committed", "advancing"].includes(charge.state)) return { accepted: false, reason: "charge-not-advancing" };
  if (!claim(runtime, runtime.movementClaims, runtime.movementClaimOrder, stepClaimKey)) return { accepted: false, reason: "duplicate-charge-step" };
  runtime.movementClaimRecords.set(stepClaimKey, movementClaim || Object.freeze({
    generationId: charge.generationId, combatSession: charge.combatSession,
    chargeIntentId: charge.chargeIntentId, actionIntentId: charge.actionIntentId,
    chargerId: charge.chargerId, targetActorId: charge.targetActorId,
    pulseIndex: Number(pulseIndex), pathStepIndex: Number(stepIndex),
    from: Object.freeze({ ...from }), to: Object.freeze({ ...to }),
    movementOwnershipKey: charge.movementOwnershipKey,
  }));
  while (runtime.movementClaimRecords.size > runtime.maxClaimHistory) {
    runtime.movementClaimRecords.delete(runtime.movementClaimRecords.keys().next().value);
  }
  if (stepIndex !== charge.completedPath.length) return { accepted: false, reason: "charge-step-out-of-order" };
  const completedPath = Object.freeze([...charge.completedPath, Object.freeze({ ...to })]);
  const nextState = completedPath.length >= charge.committedPath.length ? "contact-pending" : "advancing";
  const next = transitionTacticalCharge(charge, nextState, { completedPath, currentPosition: Object.freeze({ ...to }), contactAtPulse: nextState === "contact-pending" ? pulseIndex : null }).intent;
  replace(runtime.chargesByActor, next, "chargerId");
  onEvent?.(event("tactical-charge-step-completed", next, pulseIndex, { from, to, pathStepIndex: stepIndex, movementOwnershipKey: next.movementOwnershipKey }));
  if (nextState === "contact-pending") onEvent?.(event("tactical-charge-contact-pending", next, pulseIndex));
  return { accepted: true, charge: next };
}

export async function resolveTacticalChargeContacts({ runtime, pulseIndex, fighters = [], executeCanonicalAttack, validateCharge, combatActive = true, onEvent } = {}) {
  const closed = rejectClosed(runtime); if (closed) return { ...closed, events: [] };
  const events = []; const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  for (const [actorId, charge] of [...runtime.chargesByActor]) {
    if (charge.state !== "contact-pending") continue;
    const actor = findActor(fighters, charge.chargerId); const target = findActor(fighters, charge.targetActorId);
    const external = validateCharge?.({ intent: charge, actor, target, contact: true });
    if (!combatActive || !coordinatesValid(runtime, charge) || !combatCapable(actor) || !combatCapable(target) || external?.valid === false || charge.completedPath.length < charge.minimumCommittedSteps || typeof executeCanonicalAttack !== "function") {
      const rejectionReason = !combatActive ? "combat-ended" : !coordinatesValid(runtime, charge) ? "stale-charge-coordinate" : external?.reason || (charge.completedPath.length < charge.minimumCommittedSteps ? "insufficient-committed-distance" : typeof executeCanonicalAttack !== "function" ? "canonical-contact-executor-unavailable" : "charge-contact-invalid");
      const invalidated = transitionTacticalCharge(charge, "invalidated", { invalidationReason: rejectionReason }).intent;
      runtime.chargesByActor.delete(actorId); retain(runtime, runtime.terminalCharges, invalidated);
      emit(event("tactical-charge-contact-rejected", invalidated, pulseIndex, { rejectionReason }));
      emit(event("tactical-charge-invalidated", invalidated, pulseIndex, { invalidationReason: invalidated.invalidationReason })); continue;
    }
    const executionKey = buildTacticalChargeExecutionKey(charge, "contact", 1);
    if (!claim(runtime, runtime.contactExecutionClaims, runtime.contactExecutionClaimOrder, executionKey)) continue;
    const resolving = transitionTacticalCharge(charge, "resolving", { contactExecutionKey: executionKey }).intent;
    replace(runtime.chargesByActor, resolving, "chargerId");
    emit(event("tactical-charge-contact-admitted", resolving, pulseIndex, { executionKey, reactionDepth: 0, committedSteps: resolving.completedPath.length }));
    const result = await executeCanonicalAttack(Object.freeze({
      generationId: charge.generationId, combatSession: charge.combatSession, pulseIndex,
      actorId: charge.chargerId, targetActorId: charge.targetActorId, weaponId: charge.weaponId,
      techniqueId: charge.techniqueId, chargeIntentId: charge.chargeIntentId,
      attackExecutionKey: executionKey, executionKey, reactionDepth: 0,
      tacticalSource: "charge-contact", chargeCommittedSteps: charge.completedPath.length,
    }));
    if (runtime.closed || !coordinatesValid(runtime, resolving)) {
      runtime.postTerminalAttacksBlocked += 1;
      return { accepted: false, reason: runtime.closed ? "post-terminal-charge-contact-blocked" : "stale-charge-contact-coordinate", events, audit: auditTacticalChargeBraceOwnership(runtime) };
    }
    if (!result || result.accepted === false) {
      const rejectionReason = result?.reason || "canonical-contact-admission-rejected";
      const invalidated = transitionTacticalCharge(resolving, "invalidated", { invalidationReason: rejectionReason, result: result || null }).intent;
      runtime.chargesByActor.delete(actorId); retain(runtime, runtime.terminalCharges, invalidated);
      emit(event("tactical-charge-contact-rejected", invalidated, pulseIndex, { executionKey, rejectionReason }));
      continue;
    }
    const recovering = transitionTacticalCharge(resolving, "recovering", { recoveryUntilPulse: pulseIndex + resolving.recoveryPulses, result }).intent;
    replace(runtime.chargesByActor, recovering, "chargerId");
    emit(event("tactical-charge-contact-resolved", recovering, pulseIndex, {
      executionKey,
      result: result?.result || result?.outcome || null,
      defensiveReactionWindowOpened: result?.defensiveReactionWindowOpened === true,
      postParryOpportunityCreated: result?.postParryOpportunityCreated === true,
    }));
  }
  for (const [actorId, charge] of [...runtime.chargesByActor]) {
    if (charge.state === "recovering" && pulseIndex >= charge.recoveryUntilPulse) {
      const completed = transitionTacticalCharge(charge, "completed").intent;
      runtime.chargesByActor.delete(actorId); retain(runtime, runtime.terminalCharges, completed);
    }
  }
  return { accepted: true, events, audit: auditTacticalChargeBraceOwnership(runtime) };
}

export function auditTacticalChargeBraceOwnership(runtime) {
  const charges = [...(runtime?.chargesByActor?.values() || [])];
  const braces = [...(runtime?.bracesByActor?.values() || [])];
  const windows = [...(runtime?.windowsByCharge?.values() || [])];
  return {
    preparingChargeCount: charges.filter((entry) => entry.state === "preparing").length,
    committedChargeCount: charges.filter((entry) => entry.state === "committed").length,
    advancingChargeCount: charges.filter((entry) => entry.state === "advancing").length,
    heldBraceCount: braces.filter((entry) => entry.state === "held").length,
    openInterceptionWindowCount: windows.filter((entry) => !terminalWindow(entry)).length,
    chargeMovementClaimCount: runtime?.movementClaims?.size || 0,
    chargeMovementClaimRecordCount: runtime?.movementClaimRecords?.size || 0,
    chargeMovementStaminaClaimCount: runtime?.movementStaminaClaims?.size || 0,
    braceTriggerClaimCount: runtime?.triggerClaims?.size || 0,
    completedBraceTriggerClaimCount: runtime?.completedTriggerClaims?.size || 0,
    interceptionExecutionClaimCount: runtime?.interceptionExecutionClaims?.size || 0,
    contactExecutionClaimCount: runtime?.contactExecutionClaims?.size || 0,
    postTerminalMovementBlocked: runtime?.postTerminalMovementBlocked || 0,
    postTerminalAttacksBlocked: runtime?.postTerminalAttacksBlocked || 0,
    terminalChargeHistoryCount: runtime?.terminalCharges?.length || 0,
    terminalBraceHistoryCount: runtime?.terminalBraces?.length || 0,
    terminalWindowHistoryCount: runtime?.terminalWindows?.length || 0,
    matches: new Set(charges.map((entry) => entry.chargerId)).size === charges.length
      && new Set(braces.map((entry) => entry.bracingActorId)).size === braces.length,
  };
}

export function cleanupTacticalChargeBraceRuntime(runtime, reason = "combat-ended") {
  if (!runtime) return { accepted: false, reason: "charge-brace-runtime-required" };
  if (runtime.cleanupCompleted) return { accepted: false, reason: "charge-brace-cleanup-already-completed", data: runtime.lastCleanup };
  const before = auditTacticalChargeBraceOwnership(runtime);
  for (const charge of runtime.chargesByActor.values()) retain(runtime, runtime.terminalCharges, { ...charge, state: charge.state === "preparing" ? "canceled" : "invalidated", invalidationReason: reason });
  for (const brace of runtime.bracesByActor.values()) retain(runtime, runtime.terminalBraces, { ...brace, state: brace.state === "preparing" ? "canceled" : "invalidated", invalidationReason: reason });
  for (const window of runtime.windowsByCharge.values()) retain(runtime, runtime.terminalWindows, { ...window, state: "canceled", terminalReason: reason });
  runtime.chargesByActor.clear(); runtime.bracesByActor.clear(); runtime.windowsByCharge.clear();
  runtime.movementClaims.clear(); runtime.movementClaimOrder.length = 0;
  runtime.movementClaimRecords.clear();
  runtime.movementStaminaClaims.clear(); runtime.movementStaminaClaimOrder.length = 0;
  runtime.triggerClaims.clear(); runtime.triggerClaimOrder.length = 0;
  runtime.completedTriggerClaims.clear(); runtime.completedTriggerClaimOrder.length = 0;
  runtime.interceptionExecutionClaims.clear(); runtime.interceptionExecutionClaimOrder.length = 0;
  runtime.contactExecutionClaims.clear(); runtime.contactExecutionClaimOrder.length = 0;
  runtime.closed = true; runtime.cleanupCompleted = true;
  runtime.lastCleanup = { ...before, reason, matches: true };
  return { accepted: true, eventType: "tactical-charge-brace-terminal-cleanup", data: runtime.lastCleanup };
}

export function resetTacticalChargeBraceCoordinates(runtime, { generationId, combatSession } = {}) {
  cleanupTacticalChargeBraceRuntime(runtime, "coordinate-reset");
  return createTacticalChargeBraceRuntime({ generationId, combatSession, maxTerminalHistory: runtime?.maxTerminalHistory, maxClaimHistory: runtime?.maxClaimHistory });
}

export function isActorChargeBraceBusy(runtime, actorId) {
  const key = String(actorId);
  return runtime?.chargesByActor?.has(key) || runtime?.bracesByActor?.has(key);
}
