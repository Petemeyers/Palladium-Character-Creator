import { DEFENSE_OUTCOMES } from "./defenseOutcome.js";
import {
  DOMINANT_RESPONSE_TYPES,
  chooseDominantOpeningResponse,
} from "./dominantOpeningResolution.js";

const freeze = (value) => Object.freeze(value);
const idOf = (actor) => String(actor?.id ?? actor?._id ?? actor?.actorId ?? "");
const hpOf = (actor) => actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.hitPoints?.current ?? actor?.health;
const terminalStates = new Set(["resolved", "declined", "expired", "canceled", "invalidated"]);

export const TACTICAL_POST_PARRY_RESPONSE_TYPES = Object.freeze({
  RIPOSTE: "riposte",
  BIND: "bind",
  DISPLACEMENT: "displacement",
  GRAPPLE_ENTRY: "grapple-entry",
  DISENGAGEMENT: "disengagement",
  SHIELD_PRESSURE: "shield-pressure",
  DECLINE: "decline",
});

const canonicalToTactical = Object.freeze({
  [DOMINANT_RESPONSE_TYPES.RIPOSTE]: TACTICAL_POST_PARRY_RESPONSE_TYPES.RIPOSTE,
  [DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND]: TACTICAL_POST_PARRY_RESPONSE_TYPES.BIND,
  [DOMINANT_RESPONSE_TYPES.WEAPON_DISPLACEMENT]: TACTICAL_POST_PARRY_RESPONSE_TYPES.DISPLACEMENT,
  [DOMINANT_RESPONSE_TYPES.GRAPPLE_ENTRY]: TACTICAL_POST_PARRY_RESPONSE_TYPES.GRAPPLE_ENTRY,
  [DOMINANT_RESPONSE_TYPES.CONTROLLED_DISENGAGE]: TACTICAL_POST_PARRY_RESPONSE_TYPES.DISENGAGEMENT,
  [DOMINANT_RESPONSE_TYPES.SHIELD_PRESSURE]: TACTICAL_POST_PARRY_RESPONSE_TYPES.SHIELD_PRESSURE,
  [DOMINANT_RESPONSE_TYPES.DECLINE]: TACTICAL_POST_PARRY_RESPONSE_TYPES.DECLINE,
});

export const TACTICAL_TO_CANONICAL_POST_PARRY_RESPONSE = Object.freeze(
  Object.fromEntries(Object.entries(canonicalToTactical).map(([canonical, tactical]) => [tactical, canonical])),
);

export function isTacticalPostParryCombatCapable(actor = {}) {
  const hp = hpOf(actor);
  const state = String(actor?.condition || actor?.status || actor?.combatStatus || "").toLowerCase();
  return Boolean(
    idOf(actor) && (hp === undefined || hp === null || hp === "" || Number(hp) > 0)
    && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious
    && actor.isConscious !== false && actor.conscious !== false
    && !actor.defeated && !actor.isDefeated && !actor.surrendered
    && !["dead", "dying", "unconscious", "defeated", "surrendered", "captured", "removed"].includes(state)
  );
}

const event = (eventType, window, pulseIndex, data = {}) => ({
  eventType,
  actorId: window?.parryingDefenderId || null,
  data: {
    generationId: window?.generationId,
    combatSession: window?.combatSession,
    pulseIndex,
    cycleIndex: Math.floor(Math.max(0, Number(pulseIndex) - 1) / 6) + 1,
    tacticalPostParryWindowId: window?.tacticalPostParryWindowId,
    canonicalResponseOfferId: window?.canonicalResponseOfferId,
    sourceActionIntentId: window?.sourceActionIntentId,
    sourceExecutionKey: window?.sourceExecutionKey,
    sourceReactionWindowId: window?.sourceReactionWindowId,
    sourceReactionResponseId: window?.sourceReactionResponseId,
    respondingActorId: window?.parryingDefenderId,
    targetActorId: window?.originalAttackerId,
    parryQuality: window?.parryQuality,
    reactionDepth: window?.reactionDepth,
    deadlinePulse: window?.responseDeadlinePulse,
    ...data,
  },
});

const retain = (array, value, maximum) => {
  array.push(value);
  while (array.length > maximum) array.shift();
};

export function createTacticalPostParryRuntime({
  generationId = 0,
  combatSession = 0,
  maxHistory = 128,
  maxClaims = 256,
} = {}) {
  return {
    generationId: Number(generationId),
    combatSession: Number(combatSession),
    activeWindows: new Map(),
    windowBySourceResponse: new Map(),
    sourceResponseOrder: [],
    responderOwnership: new Map(),
    consumedOfferKeys: new Set(),
    consumedOfferOrder: [],
    executionKeys: new Set(),
    executionKeyOrder: [],
    terminalHistory: [],
    selectionHistory: [],
    maxHistory: Math.max(16, Number(maxHistory) || 128),
    maxClaims: Math.max(32, Number(maxClaims) || 256),
    postTerminalExecutionsBlocked: 0,
    closed: false,
    cleanupCompleted: false,
    lastCleanup: null,
  };
}

const boundedClaim = (runtime, set, order, key) => {
  if (set.has(key)) return false;
  set.add(key);
  order.push(key);
  while (order.length > runtime.maxClaims) set.delete(order.shift());
  return true;
};

const canonicalLegalResponses = (offer) => (
  offer?.legalResponses || (offer?.reactionType === "riposte" ? ["riposte", "decline"] : [])
);

export function getTacticalPostParryLegalResponses(canonicalOffer, parryQuality) {
  const canonical = canonicalLegalResponses(canonicalOffer);
  const tactical = canonical.map((choice) => canonicalToTactical[choice]).filter(Boolean);
  if (parryQuality === DEFENSE_OUTCOMES.ADVANTAGE) {
    return freeze([...new Set(tactical.filter((choice) => ["riposte", "decline"].includes(choice))) ]);
  }
  if (parryQuality === DEFENSE_OUTCOMES.DOMINANT) return freeze([...new Set(tactical)]);
  return freeze([]);
}

export function selectDeterministicTacticalPostParryResponse({
  window,
  responder,
  target,
  context = {},
} = {}) {
  const canonicalLegal = window.legalResponseTypes
    .map((choice) => TACTICAL_TO_CANONICAL_POST_PARRY_RESPONSE[choice])
    .filter(Boolean);
  const decision = chooseDominantOpeningResponse({
    legalResponses: canonicalLegal,
    reactor: responder,
    target,
    ...context,
  });
  return canonicalToTactical[decision.response] || TACTICAL_POST_PARRY_RESPONSE_TYPES.DECLINE;
}

export function openTacticalPostParryWindow({
  runtime,
  defenseResult,
  canonicalOffer,
  pulseIndex,
  fighters = [],
  controlMode = "ai",
  selectAIResponse = selectDeterministicTacticalPostParryResponse,
  aiContext = {},
  onEvent,
} = {}) {
  const reject = (reason) => ({ accepted: false, reason, events: [] });
  if (!runtime || runtime.closed) return reject("tactical-post-parry-runtime-closed");
  if (!defenseResult?.parryAttempted || !defenseResult?.parrySucceeded) return reject("parry-not-successful");
  if (![DEFENSE_OUTCOMES.ADVANTAGE, DEFENSE_OUTCOMES.DOMINANT].includes(defenseResult.parryQuality)) {
    return reject("parry-quality-not-qualifying");
  }
  if (defenseResult.generationId !== runtime.generationId) return reject("stale-generation");
  if (defenseResult.combatSession !== runtime.combatSession) return reject("stale-combat-session");
  if (!canonicalOffer?.reactionId && !canonicalOffer?.opportunityId) return reject("canonical-response-offer-required");
  if (Number(canonicalOffer.reactionDepth ?? 1) !== 1) return reject("reaction-depth-cap");
  const responderId = String(defenseResult.responderId || defenseResult.sourceDefenderId || "");
  const targetId = String(defenseResult.sourceAttackerId || "");
  const responder = fighters.find((actor) => idOf(actor) === responderId);
  const target = fighters.find((actor) => idOf(actor) === targetId);
  if (!isTacticalPostParryCombatCapable(responder)) return reject("responder-not-combat-capable");
  if (!isTacticalPostParryCombatCapable(target)) return reject("target-not-combat-capable");
  if (runtime.responderOwnership.has(responderId)) return reject("post-parry-responder-already-owned");
  const sourceResponseId = String(defenseResult.reactionResponseId || "");
  if (!sourceResponseId) return reject("source-reaction-response-required");
  if (runtime.windowBySourceResponse.has(sourceResponseId)) return reject("duplicate-post-parry-window");
  const legalResponseTypes = getTacticalPostParryLegalResponses(canonicalOffer, defenseResult.parryQuality);
  if (!legalResponseTypes.length) return reject("no-legal-post-parry-response");
  const offerId = canonicalOffer.opportunityId || canonicalOffer.reactionId;
  const windowId = `${sourceResponseId}:post-parry`;
  let window = freeze({
    tacticalPostParryWindowId: windowId,
    generationId: runtime.generationId,
    combatSession: runtime.combatSession,
    sourceActionIntentId: defenseResult.sourceActionIntentId,
    sourceExecutionKey: defenseResult.sourceExecutionKey,
    sourceReactionWindowId: defenseResult.reactionWindowId,
    sourceReactionResponseId: sourceResponseId,
    originalAttackerId: targetId,
    parryingDefenderId: responderId,
    parryQuality: defenseResult.parryQuality,
    parryingWeaponId: defenseResult.parryingWeaponId || canonicalOffer.parryingWeaponId || canonicalOffer.weaponId || null,
    incomingWeaponId: defenseResult.sourceWeaponId || canonicalOffer.attackingWeaponId || null,
    openedAtPulse: Number(pulseIndex),
    responseDeadlinePulse: Number(pulseIndex) + 1,
    lockedAtPulse: null,
    resolvedAtPulse: null,
    canonicalResponseOfferId: offerId,
    canonicalOffer,
    legalResponseTypes,
    selectedResponseType: null,
    selectedAtPulse: null,
    responseSequence: 1,
    reactionDepth: Number(canonicalOffer.reactionDepth ?? 1),
    state: "awaiting-selection",
    terminalReason: null,
    result: null,
  });
  runtime.activeWindows.set(windowId, window);
  runtime.windowBySourceResponse.set(sourceResponseId, windowId);
  runtime.sourceResponseOrder.push(sourceResponseId);
  while (runtime.sourceResponseOrder.length > runtime.maxClaims) {
    runtime.windowBySourceResponse.delete(runtime.sourceResponseOrder.shift());
  }
  runtime.responderOwnership.set(responderId, windowId);
  const events = [
    event("tactical-post-parry-window-created", window, pulseIndex, { previousState: null, nextState: "offered" }),
    event("tactical-post-parry-response-offered", window, pulseIndex, { previousState: "offered", nextState: "awaiting-selection", legalResponseTypes }),
  ];
  if (!["manual", "player"].includes(String(controlMode).toLowerCase())) {
    const selected = selectAIResponse({ window, responder, target, context: aiContext });
    const submission = submitTacticalPostParryResponse({
      runtime,
      tacticalPostParryWindowId: windowId,
      responderId,
      responseType: selected,
      pulseIndex,
      generationId: runtime.generationId,
      combatSession: runtime.combatSession,
      sourceExecutionKey: defenseResult.sourceExecutionKey,
      sourceReactionResponseId: sourceResponseId,
    });
    if (submission.accepted) {
      window = submission.window;
      events.push(submission.event);
    }
  }
  events.forEach((entry) => onEvent?.(entry));
  return { accepted: true, window, events };
}

export function submitTacticalPostParryResponse({
  runtime,
  tacticalPostParryWindowId,
  responderId,
  responseType,
  pulseIndex,
  generationId,
  combatSession,
  sourceExecutionKey,
  sourceReactionResponseId,
  selectedActorId,
  onEvent,
} = {}) {
  const window = runtime?.activeWindows?.get(tacticalPostParryWindowId);
  const reject = (reason) => {
    const entry = event("tactical-post-parry-response-rejected", window, pulseIndex, { responseType, rejectionReason: reason });
    onEvent?.(entry);
    return { accepted: false, reason, event: entry };
  };
  if (!runtime || runtime.closed) return reject("tactical-post-parry-runtime-closed");
  if (!window) return reject("post-parry-window-not-found");
  if (window.state !== "awaiting-selection" || window.selectedResponseType) return reject("duplicate-post-parry-selection");
  if (Number(pulseIndex) > window.responseDeadlinePulse) return reject("post-parry-selection-after-deadline");
  if (generationId !== undefined && Number(generationId) !== window.generationId) return reject("stale-generation");
  if (combatSession !== undefined && Number(combatSession) !== window.combatSession) return reject("stale-combat-session");
  if (String(responderId || "") !== window.parryingDefenderId) return reject("post-parry-responder-mismatch");
  if (selectedActorId !== undefined && String(selectedActorId) !== window.parryingDefenderId) return reject("selected-actor-mismatch");
  if (sourceExecutionKey !== undefined && sourceExecutionKey !== window.sourceExecutionKey) return reject("source-execution-mismatch");
  if (sourceReactionResponseId !== undefined && sourceReactionResponseId !== window.sourceReactionResponseId) return reject("source-response-mismatch");
  if (!window.legalResponseTypes.includes(responseType)) return reject("post-parry-response-not-legal");
  const selected = freeze({ ...window, selectedResponseType: responseType, selectedAtPulse: Number(pulseIndex) });
  runtime.activeWindows.set(tacticalPostParryWindowId, selected);
  const selection = freeze({
    tacticalPostParryWindowId,
    canonicalResponseOfferId: window.canonicalResponseOfferId,
    responderId: window.parryingDefenderId,
    responseType,
    selectedAtPulse: Number(pulseIndex),
  });
  retain(runtime.selectionHistory, selection, runtime.maxHistory);
  const entry = event("tactical-post-parry-response-selected", selected, pulseIndex, { selectedResponseType: responseType });
  onEvent?.(entry);
  return { accepted: true, window: selected, selection, event: entry };
}

const finishWindow = (runtime, window, state, pulseIndex, terminalReason, result, onEvent) => {
  const terminal = freeze({
    ...window,
    state,
    terminalReason,
    result: result ? freeze({ ...result }) : null,
    resolvedAtPulse: Number(pulseIndex),
  });
  runtime.activeWindows.delete(window.tacticalPostParryWindowId);
  runtime.responderOwnership.delete(window.parryingDefenderId);
  retain(runtime.terminalHistory, terminal, runtime.maxHistory);
  const type = state === "resolved" || state === "declined"
    ? "tactical-post-parry-resolution-completed"
    : state === "expired"
      ? "tactical-post-parry-window-expired"
      : state === "canceled"
        ? "tactical-post-parry-window-canceled"
        : "tactical-post-parry-window-invalidated";
  onEvent?.(event(type, terminal, pulseIndex, { previousState: window.state, nextState: state, terminalReason, result: terminal.result }));
  return terminal;
};

export async function progressTacticalPostParryWindows({
  runtime,
  pulseIndex,
  fighters = [],
  combatActive = true,
  validateResponse,
  executeCanonicalResponse,
  onEvent,
} = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-post-parry-runtime-required", events: [] };
  if (runtime.closed) {
    runtime.postTerminalExecutionsBlocked += 1;
    return { accepted: false, reason: "tactical-post-parry-runtime-closed", events: [] };
  }
  const events = [];
  const emit = (entry) => { events.push(entry); onEvent?.(entry); };
  const terminateCanonicalOffer = async (window, reason) => {
    if (!boundedClaim(runtime, runtime.consumedOfferKeys, runtime.consumedOfferOrder, window.canonicalResponseOfferId)) return;
    try {
      await executeCanonicalResponse?.({
        window,
        responseType: "decline",
        canonicalResponseType: DOMINANT_RESPONSE_TYPES.DECLINE,
        executionKey: `${window.sourceExecutionKey}:post-parry:terminal:${window.canonicalResponseOfferId}`,
        reason,
        invalidation: true,
      });
    } catch {
      // The tactical ownership still terminates; canonical cleanup retains its own diagnostics.
    }
  };
  for (const [windowId, original] of [...runtime.activeWindows]) {
    let window = original;
    const responder = fighters.find((actor) => idOf(actor) === window.parryingDefenderId);
    const target = fighters.find((actor) => idOf(actor) === window.originalAttackerId);
    let invalidReason = !combatActive ? "combat-ended"
      : window.generationId !== runtime.generationId ? "stale-generation"
        : window.combatSession !== runtime.combatSession ? "stale-combat-session"
          : !isTacticalPostParryCombatCapable(responder) ? "responder-not-combat-capable"
            : !isTacticalPostParryCombatCapable(target) ? "target-not-combat-capable"
              : null;
    if (!invalidReason && typeof validateResponse === "function") {
      const validation = await validateResponse({ stage: "progress", window, responder, target, responseType: window.selectedResponseType });
      if (validation?.valid === false) invalidReason = validation.reason || "canonical-post-parry-validation-rejected";
    }
    if (invalidReason) {
      await terminateCanonicalOffer(window, invalidReason);
      finishWindow(runtime, window, "invalidated", pulseIndex, invalidReason, null, emit);
      continue;
    }
    if (Number(pulseIndex) < window.responseDeadlinePulse) continue;
    if (!window.selectedResponseType) {
      if (boundedClaim(runtime, runtime.consumedOfferKeys, runtime.consumedOfferOrder, window.canonicalResponseOfferId)) {
        await executeCanonicalResponse?.({
          window,
          responseType: "decline",
          canonicalResponseType: DOMINANT_RESPONSE_TYPES.DECLINE,
          executionKey: `${window.sourceExecutionKey}:post-parry:terminal:${window.canonicalResponseOfferId}`,
          reason: "response-deadline-expired",
          expiration: true,
        });
      }
      finishWindow(runtime, window, "expired", pulseIndex, "response-deadline-expired", null, emit);
      continue;
    }
    const locked = freeze({ ...window, state: "locked", lockedAtPulse: Number(pulseIndex) });
    runtime.activeWindows.set(windowId, locked);
    emit(event("tactical-post-parry-window-locked", locked, pulseIndex, { previousState: "awaiting-selection", nextState: "locked", selectedResponseType: locked.selectedResponseType }));
    if (typeof validateResponse === "function") {
      const validation = await validateResponse({ stage: "locked", window: locked, responder, target, responseType: locked.selectedResponseType });
      if (validation?.valid === false) {
        await terminateCanonicalOffer(locked, validation.reason || "canonical-post-parry-validation-rejected");
        finishWindow(runtime, locked, "invalidated", pulseIndex, validation.reason || "canonical-post-parry-validation-rejected", null, emit);
        continue;
      }
    }
    if (!boundedClaim(runtime, runtime.consumedOfferKeys, runtime.consumedOfferOrder, locked.canonicalResponseOfferId)) {
      finishWindow(runtime, locked, "invalidated", pulseIndex, "canonical-response-offer-already-consumed", null, emit);
      continue;
    }
    const executionKey = `${locked.sourceExecutionKey}:post-parry:${locked.responseSequence}:${locked.selectedResponseType}`;
    if (!boundedClaim(runtime, runtime.executionKeys, runtime.executionKeyOrder, executionKey)) {
      finishWindow(runtime, locked, "invalidated", pulseIndex, "duplicate-post-parry-execution", null, emit);
      continue;
    }
    const resolving = freeze({ ...locked, state: "resolving", responseExecutionKey: executionKey });
    runtime.activeWindows.set(windowId, resolving);
    emit(event("tactical-post-parry-resolution-admitted", resolving, pulseIndex, { previousState: "locked", nextState: "resolving", selectedResponseType: resolving.selectedResponseType, responseExecutionKey: executionKey }));
    let result;
    try {
      result = await executeCanonicalResponse?.({
        window: resolving,
        responseType: resolving.selectedResponseType,
        canonicalResponseType: TACTICAL_TO_CANONICAL_POST_PARRY_RESPONSE[resolving.selectedResponseType],
        executionKey,
        responder,
        target,
      });
    } catch (error) {
      result = { accepted: false, reason: "canonical-post-parry-executor-threw", errorName: error?.name || "Error" };
    }
    if (!result?.accepted) {
      emit(event("tactical-post-parry-resolution-rejected", resolving, pulseIndex, { responseExecutionKey: executionKey, rejectionReason: result?.reason || "canonical-post-parry-resolution-rejected" }));
      finishWindow(runtime, resolving, "invalidated", pulseIndex, result?.reason || "canonical-post-parry-resolution-rejected", result, emit);
      continue;
    }
    const state = resolving.selectedResponseType === "decline" ? "declined" : "resolved";
    finishWindow(runtime, resolving, state, pulseIndex, state === "declined" ? "manual-decline" : "canonical-response-completed", result, emit);
  }
  emit(event("tactical-post-parry-ownership-audit", null, pulseIndex, auditTacticalPostParryOwnership(runtime)));
  return { accepted: true, events, audit: auditTacticalPostParryOwnership(runtime) };
}

export function invalidateTacticalPostParryWindow({ runtime, tacticalPostParryWindowId, pulseIndex, reason = "invalidated", onEvent } = {}) {
  const window = runtime?.activeWindows?.get(tacticalPostParryWindowId);
  if (!window) return { accepted: false, reason: "post-parry-window-not-found" };
  if (terminalStates.has(window.state)) return { accepted: false, reason: "post-parry-window-terminal" };
  return { accepted: true, window: finishWindow(runtime, window, "invalidated", pulseIndex, reason, null, onEvent) };
}

export function cleanupTacticalPostParryRuntime(runtime, reason = "combat-ended") {
  if (!runtime) return { accepted: false, reason: "tactical-post-parry-runtime-required" };
  if (runtime.cleanupCompleted) return { accepted: false, reason: "tactical-post-parry-cleanup-already-completed", data: runtime.lastCleanup };
  const counts = {
    openPostParryWindowCount: runtime.activeWindows.size,
    awaitingSelectionCount: [...runtime.activeWindows.values()].filter((window) => window.state === "awaiting-selection").length,
    lockedWindowCount: [...runtime.activeWindows.values()].filter((window) => window.state === "locked").length,
    resolvingWindowCount: [...runtime.activeWindows.values()].filter((window) => window.state === "resolving").length,
    responseOwnershipCount: runtime.responderOwnership.size,
    pendingMovementResponseCount: [...runtime.activeWindows.values()].filter((window) => window.selectedResponseType === "disengagement").length,
    pendingGrappleResponseCount: [...runtime.activeWindows.values()].filter((window) => window.selectedResponseType === "grapple-entry").length,
    postTerminalExecutionsBlocked: runtime.postTerminalExecutionsBlocked,
  };
  const events = [];
  for (const window of runtime.activeWindows.values()) {
    const canceled = freeze({ ...window, state: "canceled", terminalReason: reason });
    retain(runtime.terminalHistory, canceled, runtime.maxHistory);
    events.push(event("tactical-post-parry-window-canceled", canceled, window.openedAtPulse, {
      previousState: window.state,
      nextState: "canceled",
      terminalReason: reason,
    }));
  }
  runtime.activeWindows.clear();
  runtime.responderOwnership.clear();
  runtime.windowBySourceResponse.clear();
  runtime.sourceResponseOrder.length = 0;
  runtime.consumedOfferKeys.clear();
  runtime.consumedOfferOrder.length = 0;
  runtime.executionKeys.clear();
  runtime.executionKeyOrder.length = 0;
  runtime.closed = true;
  runtime.cleanupCompleted = true;
  runtime.lastCleanup = freeze({ ...counts, matches: runtime.activeWindows.size === 0 && runtime.responderOwnership.size === 0 });
  return { accepted: true, eventType: "tactical-post-parry-terminal-cleanup", data: runtime.lastCleanup, events };
}

export function auditTacticalPostParryOwnership(runtime) {
  const activeWindows = [...(runtime?.activeWindows?.values?.() || [])];
  const ownerIds = [...(runtime?.responderOwnership?.keys?.() || [])];
  return {
    openPostParryWindowCount: activeWindows.length,
    awaitingSelectionCount: activeWindows.filter((window) => window.state === "awaiting-selection").length,
    lockedWindowCount: activeWindows.filter((window) => window.state === "locked").length,
    resolvingWindowCount: activeWindows.filter((window) => window.state === "resolving").length,
    responseOwnershipCount: ownerIds.length,
    terminalHistoryCount: runtime?.terminalHistory?.length || 0,
    selectionHistoryCount: runtime?.selectionHistory?.length || 0,
    consumedOfferKeyCount: runtime?.consumedOfferKeys?.size || 0,
    responseExecutionKeyCount: runtime?.executionKeys?.size || 0,
    sourceResponseIdentityCount: runtime?.windowBySourceResponse?.size || 0,
    pendingMovementResponseCount: activeWindows.filter((window) => window.selectedResponseType === "disengagement").length,
    pendingGrappleResponseCount: activeWindows.filter((window) => window.selectedResponseType === "grapple-entry").length,
    postTerminalExecutionsBlocked: runtime?.postTerminalExecutionsBlocked || 0,
    matches: ownerIds.every((actorId) => runtime.activeWindows.get(runtime.responderOwnership.get(actorId))?.parryingDefenderId === actorId),
  };
}
