const RESPONSE_TYPES = Object.freeze(["dodge", "parry", "shield-block", "decline"]);
const FUTURE_RESPONSE_TYPES = Object.freeze([
  "riposte", "bind", "displacement", "grapple-entry", "disengagement",
  "shield-pressure", "brace", "intercept",
]);
const WINDOW_TERMINAL_STATES = new Set(["resolved", "declined", "expired", "canceled", "invalidated"]);
const WINDOW_TRANSITIONS = Object.freeze({
  offered: new Set(["awaiting-responses", "canceled", "invalidated"]),
  "awaiting-responses": new Set(["locked", "expired", "canceled", "invalidated"]),
  locked: new Set(["resolving", "canceled", "invalidated"]),
  resolving: new Set(["resolved", "canceled", "invalidated"]),
});

const idOf = (actor) => String(actor?.id ?? actor?._id ?? actor?.actorId ?? "");
const hpOf = (actor) => actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.hitPoints?.current ?? actor?.health;
const text = (value) => String(value ?? "").trim().toLowerCase();
const freeze = (value) => Object.freeze(value);

export const TACTICAL_REACTION_RESPONSE_TYPES = RESPONSE_TYPES;
export const TACTICAL_FUTURE_REACTION_RESPONSE_TYPES = FUTURE_RESPONSE_TYPES;

export function isTacticalReactionCombatCapable(actor = {}) {
  const hp = hpOf(actor);
  return Boolean(
    idOf(actor) && (hp === undefined || hp === null || hp === "" || Number(hp) > 0)
    && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious
    && !actor.defeated && !actor.isDefeated && !actor.routed && actor.canAct !== false
    && !["routed", "broken", "panicked", "surrendering", "cowering"].includes(text(
      actor.routingState || actor.moraleState || actor.state?.moraleState,
    ))
  );
}

const grappleActive = (actor = {}) => {
  const state = text(actor?.grappleState?.state || actor?.grappleState || actor?.grappleStatus?.state);
  return Boolean(state && !["neutral", "none", "released"].includes(state));
};

const actorWeapons = (actor = {}) => [
  actor.weaponSlots?.rightHand,
  actor.weaponSlots?.leftHand,
  actor.equippedWeapon,
  actor.weapon,
  actor.selectedAttack,
  ...(Array.isArray(actor.attacks) ? actor.attacks : []),
].filter(Boolean);

export function hasUsableTacticalShield(actor = {}) {
  if (actor.shieldDestroyed || actor.shieldUnavailable || actor.shield?.destroyed) return false;
  return Boolean(
    actor.hasShield || actor.equippedShield ||
    actor.weaponSlots?.leftHand?.isShield || actor.offHand?.isShield ||
    /shield|buckler/.test(text(`${actor.shield?.name || actor.shield} ${actor.offHand?.name || actor.offHand} ${actor.weaponSlots?.leftHand?.name}`)),
  );
}

export function hasUsableTacticalParryWeapon(actor = {}) {
  return actorWeapons(actor).some((weapon) => {
    const description = text(`${weapon?.id} ${weapon?.name} ${weapon?.type} ${weapon?.kind} ${weapon?.category}`);
    if (!description || weapon?.destroyed || weapon?.disabled || weapon?.available === false) return false;
    if (/shield|bow|crossbow|sling|firearm|unarmed|fist|claw|bite/.test(description)) return false;
    return weapon?.canParry !== false && weapon?.parryEligible !== false;
  });
}

export function evaluateTacticalReactionChoices({ defender, attacker, attackType, attackFamily } = {}) {
  const incapacitated = !isTacticalReactionCombatCapable(defender);
  const restrained = Boolean(defender?.restrained || defender?.isRestrained || defender?.pinned || defender?.immobilized);
  const prone = Boolean(defender?.prone || defender?.isProne || text(defender?.positionState) === "prone");
  const grappled = grappleActive(defender);
  const ranged = text(attackType || attackFamily).includes("ranged");
  const baseReason = incapacitated ? "Defender is not combat-capable" : null;
  return freeze({
    dodge: freeze({
      legal: !incapacitated && !restrained && !prone && !grappled,
      reason: baseReason || (restrained ? "Cannot dodge while restrained" : prone ? "Cannot dodge while prone" : grappled ? "Cannot dodge while grappling" : null),
    }),
    parry: freeze({
      legal: !incapacitated && !restrained && !grappled && !ranged && hasUsableTacticalParryWeapon(defender),
      reason: baseReason || (ranged ? "Ranged attacks cannot be parried" : restrained ? "Cannot parry while restrained" : grappled ? "Cannot parry while grappling" : !hasUsableTacticalParryWeapon(defender) ? "Weapon cannot parry this attack" : null),
    }),
    "shield-block": freeze({
      legal: !incapacitated && !restrained && !grappled && !ranged && hasUsableTacticalShield(defender),
      reason: baseReason || (ranged ? "Canonical ranged defense permits evade rather than shield block" : restrained ? "Cannot use a shield while restrained" : grappled ? "Cannot shield block while grappling" : !hasUsableTacticalShield(defender) ? "No shield equipped" : null),
    }),
    decline: freeze({ legal: true, reason: null }),
    attackerId: idOf(attacker),
  });
}

export function selectDeterministicTacticalAIReaction({ legalChoices, budget } = {}) {
  if ((budget?.remaining ?? 1) <= 0) return "decline";
  if (legalChoices?.["shield-block"]?.legal) return "shield-block";
  if (legalChoices?.parry?.legal) return "parry";
  if (legalChoices?.dodge?.legal) return "dodge";
  return "decline";
}

export function createTacticalReactionRuntime({
  generationId = 0,
  combatSession = 0,
  maxTerminalHistory = 128,
  maxResolutionHistory = 256,
  getReactionCapacity = () => 1,
} = {}) {
  return {
    generationId: Number(generationId),
    combatSession: Number(combatSession),
    activeWindows: new Map(),
    windowByExecutionKey: new Map(),
    responderOwnership: new Map(),
    budgets: new Map(),
    budgetHistory: new Map(),
    budgetConsumptionKeys: new Set(),
    budgetConsumptionOrder: [],
    responseHistory: [],
    defenseAdmissionKeys: new Set(),
    defenseAdmissionOrder: [],
    terminalHistory: [],
    resolvedWindowIds: new Set(),
    resolvedWindowOrder: [],
    maxTerminalHistory: Math.max(16, Number(maxTerminalHistory) || 128),
    maxResolutionHistory: Math.max(32, Number(maxResolutionHistory) || 256),
    getReactionCapacity,
    postTerminalResponsesBlocked: 0,
    postTerminalAttacksBlocked: 0,
    closed: false,
    cleanupCompleted: false,
    lastCleanup: null,
  };
}

const event = (eventType, window, pulseIndex, data = {}) => ({
  eventType,
  actorId: window?.primaryTargetId || null,
  generationId: window?.generationId,
  combatSession: window?.combatSession,
  pulseIndex,
  data: {
    generationId: window?.generationId,
    combatSession: window?.combatSession,
    pulseIndex,
    reactionWindowId: window?.reactionWindowId,
    sourceActionIntentId: window?.sourceActionIntentId,
    sourceExecutionKey: window?.sourceExecutionKey,
    attackerId: window?.attackerId,
    defenderId: window?.primaryTargetId,
    ...data,
  },
});

const transitionWindow = (window, nextState, patch = {}) => {
  if (!WINDOW_TRANSITIONS[window?.state]?.has(nextState)) {
    return { accepted: false, reason: `illegal-reaction-window-transition:${window?.state || "missing"}->${nextState}` };
  }
  return { accepted: true, window: freeze({ ...window, ...patch, state: nextState }) };
};

const retainTerminal = (runtime, window) => {
  runtime.terminalHistory.push(window);
  while (runtime.terminalHistory.length > runtime.maxTerminalHistory) runtime.terminalHistory.shift();
};

const cycleForPulse = (pulseIndex) => Math.floor(Math.max(0, Number(pulseIndex) - 1) / 6) + 1;

const retainBoundedKey = (runtime, set, order, key) => {
  set.add(key);
  order.push(key);
  while (order.length > runtime.maxResolutionHistory) set.delete(order.shift());
};

const retainResponse = (runtime, response) => {
  runtime.responseHistory.push(response);
  while (runtime.responseHistory.length > runtime.maxTerminalHistory) runtime.responseHistory.shift();
};

function getBudgetForCycle(runtime, actorId, cycleIndex, { emit, makeCurrent = false } = {}) {
  const key = String(actorId ?? "");
  const historyKey = `${key}:${cycleIndex}`;
  let budget = runtime.budgetHistory.get(historyKey);
  const existing = runtime.budgets.get(key);
  if (!budget) {
    const capacity = Math.max(0, Number(runtime.getReactionCapacity?.({ actorId: key, cycleIndex }) ?? 1));
    budget = freeze({ actorId: key, cycleIndex, capacity, used: 0, remaining: capacity });
    runtime.budgetHistory.set(historyKey, budget);
  }
  if (makeCurrent && (!existing || existing.cycleIndex !== cycleIndex)) {
    runtime.budgets.set(key, budget);
    emit?.({ eventType: "tactical-reaction-budget-reset", actorId: key, data: { actorId: key, cycleIndex, budgetBefore: existing?.remaining ?? null, budgetAfter: budget.capacity } });
  }
  return budget;
}

export function getTacticalReactionBudget(runtime, actorId, pulseIndex, { emit } = {}) {
  return getBudgetForCycle(runtime, actorId, cycleForPulse(pulseIndex), { emit, makeCurrent: true });
}

export function openTacticalReactionWindow({
  runtime,
  intent,
  executionKey,
  pulseIndex,
  fighters = [],
  permitsReaction = true,
  policyReason = null,
  getControlMode = (actor) => actor?.controlMode || "ai",
  selectAIResponse = selectDeterministicTacticalAIReaction,
  onEvent,
} = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-reaction-runtime-required" };
  if (runtime.closed) { runtime.postTerminalAttacksBlocked += 1; return { accepted: false, reason: "tactical-reaction-runtime-closed" }; }
  if (!permitsReaction) return { accepted: false, reason: policyReason || "attack-does-not-permit-reaction", noWindow: true };
  if (!intent || !executionKey) return { accepted: false, reason: "reaction-source-identity-required" };
  if (intent.generationId !== runtime.generationId) return { accepted: false, reason: "stale-generation" };
  if (intent.combatSession !== runtime.combatSession) return { accepted: false, reason: "stale-combat-session" };
  if (runtime.windowByExecutionKey.has(executionKey)) return { accepted: false, reason: "duplicate-reaction-window" };
  const attacker = fighters.find((actor) => idOf(actor) === intent.actorId);
  const defender = fighters.find((actor) => idOf(actor) === intent.targetActorId);
  if (!attacker || !isTacticalReactionCombatCapable(attacker)) return { accepted: false, reason: "attacker-not-combat-capable" };
  if (!defender || !isTacticalReactionCombatCapable(defender)) return { accepted: false, reason: "defender-not-combat-capable" };
  const defenderId = idOf(defender);
  if (runtime.responderOwnership.has(defenderId)) return { accepted: false, reason: "responder-already-committed" };
  const legalChoices = evaluateTacticalReactionChoices({ defender, attacker, attackType: intent.actionType, attackFamily: intent.weaponFamily });
  const budget = getTacticalReactionBudget(runtime, defenderId, pulseIndex, { emit: onEvent });
  const reactionWindowId = `${executionKey}:reaction`;
  let window = freeze({
    reactionWindowId,
    generationId: intent.generationId,
    combatSession: intent.combatSession,
    sourceActionIntentId: intent.actionIntentId,
    sourceExecutionKey: executionKey,
    attackerId: intent.actorId,
    primaryTargetId: defenderId,
    openedAtPulse: pulseIndex,
    responseDeadlinePulse: pulseIndex + 1,
    lockedAtPulse: null,
    resolvedAtPulse: null,
    attackFamily: intent.weaponFamily,
    attackType: intent.actionType,
    weaponId: intent.weaponId,
    techniqueId: intent.techniqueId,
    state: "offered",
    eligibleResponderIds: freeze([defenderId]),
    responses: freeze([]),
    selectedPrimaryResponse: null,
    resolution: null,
    terminalReason: null,
    legalChoices,
    budgetCycleIndex: budget.cycleIndex,
  });
  runtime.activeWindows.set(reactionWindowId, window);
  runtime.windowByExecutionKey.set(executionKey, reactionWindowId);
  runtime.responderOwnership.set(defenderId, reactionWindowId);
  onEvent?.(event("tactical-reaction-window-created", window, pulseIndex, { previousState: null, nextState: "offered" }));
  const awaiting = transitionWindow(window, "awaiting-responses");
  window = awaiting.window;
  runtime.activeWindows.set(reactionWindowId, window);
  onEvent?.(event("tactical-reaction-window-offered", window, pulseIndex, { previousState: "offered", nextState: "awaiting-responses", legalChoices }));

  const manual = text(getControlMode(defender)) === "manual";
  if (!manual) {
    const responseType = selectAIResponse({ window, attacker, defender, legalChoices, budget });
    const activeLegal = ["shield-block", "parry", "dodge"].some((type) => legalChoices[type]?.legal);
    const selectionReason = budget.remaining <= 0
      ? "reaction-budget-exhausted"
      : !activeLegal
        ? "no-legal-active-reaction"
        : "ai-tactical-selection";
    submitTacticalReactionResponse({ runtime, reactionWindowId, responderId: defenderId, responseType, pulseIndex, selectionReason, onEvent });
  }
  return { accepted: true, window: runtime.activeWindows.get(reactionWindowId), legalChoices, manual };
}

export function submitTacticalReactionResponse({ runtime, reactionWindowId, responderId, responseType, pulseIndex, selectionReason, expected = {}, onEvent } = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-reaction-runtime-required" };
  if (runtime.closed) { runtime.postTerminalResponsesBlocked += 1; return { accepted: false, reason: "tactical-reaction-runtime-closed" }; }
  const window = runtime.activeWindows.get(String(reactionWindowId ?? ""));
  const reject = (reason) => {
    if (window) onEvent?.(event("tactical-reaction-response-rejected", window, pulseIndex, { responderId, responseType, rejectionReason: reason }));
    return { accepted: false, reason };
  };
  if (!window) return reject("reaction-window-not-active");
  if (window.state !== "awaiting-responses") return reject("reaction-window-not-awaiting-responses");
  if (Number(pulseIndex) > window.responseDeadlinePulse) return reject("reaction-response-after-deadline");
  if (expected.reactionWindowId && window.reactionWindowId !== expected.reactionWindowId) return reject("stale-reaction-window");
  if (expected.generationId !== undefined && window.generationId !== Number(expected.generationId)) return reject("stale-generation");
  if (expected.combatSession !== undefined && window.combatSession !== Number(expected.combatSession)) return reject("stale-combat-session");
  if (expected.sourceActionIntentId && window.sourceActionIntentId !== expected.sourceActionIntentId) return reject("stale-action-intent");
  if (expected.sourceExecutionKey && window.sourceExecutionKey !== expected.sourceExecutionKey) return reject("stale-source-execution");
  const responder = String(responderId ?? "");
  if (expected.responderId && responder !== String(expected.responderId)) return reject("stale-responder-identity");
  if (expected.selectedActorId && responder !== String(expected.selectedActorId)) return reject("stale-selected-actor");
  if (!window.eligibleResponderIds.includes(responder)) return reject("responder-not-eligible");
  if (window.responses.some((response) => response.responderId === responder)) return reject("duplicate-reaction-response");
  if (!RESPONSE_TYPES.includes(responseType)) return reject(FUTURE_RESPONSE_TYPES.includes(responseType) ? "future-reaction-not-enabled" : "unknown-reaction-response");
  const choice = window.legalChoices?.[responseType];
  if (!choice?.legal) return reject(choice?.reason || "reaction-response-illegal");
  const budget = getTacticalReactionBudget(runtime, responder, pulseIndex, { emit: onEvent });
  if (responseType !== "decline" && budget.remaining <= 0) return reject("reaction-budget-spent");
  const response = freeze({
    reactionResponseId: `${window.reactionWindowId}:${responder}:${responseType}`,
    reactionWindowId: window.reactionWindowId,
    generationId: window.generationId,
    combatSession: window.combatSession,
    responderId: responder,
    attackerId: window.attackerId,
    protectedActorId: window.primaryTargetId,
    responseType,
    createdAtPulse: pulseIndex,
    acceptedAtPulse: null,
    state: "offered",
    invalidationReason: null,
    result: null,
    budgetCycleIndex: budget.cycleIndex,
    selectionReason: selectionReason || (responseType === "decline" ? "manual-decline" : "manual-selection"),
  });
  const updated = freeze({ ...window, responses: freeze([...window.responses, response]), selectedPrimaryResponse: response });
  runtime.activeWindows.set(window.reactionWindowId, updated);
  retainResponse(runtime, response);
  onEvent?.(event("tactical-reaction-response-submitted", updated, pulseIndex, { reactionResponseId: response.reactionResponseId, responderId: responder, responseType, selectionReason: response.selectionReason }));
  return { accepted: true, window: updated, response };
}

export function lockTacticalReactionWindow({ runtime, reactionWindowId, pulseIndex, onEvent } = {}) {
  const window = runtime?.activeWindows?.get(String(reactionWindowId ?? ""));
  if (!window) return { accepted: false, reason: "reaction-window-not-active" };
  if (window.state !== "awaiting-responses") return { accepted: false, reason: "reaction-window-not-awaiting-responses" };
  let response = window.selectedPrimaryResponse;
  let expired = false;
  if (!response) {
    expired = true;
    response = freeze({
      reactionResponseId: `${window.reactionWindowId}:${window.primaryTargetId}:expired-decline`,
      reactionWindowId: window.reactionWindowId,
      generationId: window.generationId,
      combatSession: window.combatSession,
      responderId: window.primaryTargetId,
      attackerId: window.attackerId,
      protectedActorId: window.primaryTargetId,
      responseType: "decline",
      createdAtPulse: pulseIndex,
      acceptedAtPulse: pulseIndex,
      state: "accepted",
      invalidationReason: null,
      result: null,
      budgetCycleIndex: cycleForPulse(pulseIndex),
      selectionReason: "response-deadline-expired",
    });
    retainResponse(runtime, response);
    onEvent?.(event("tactical-reaction-window-expired", window, pulseIndex, { terminalReason: "response-deadline-expired" }));
  } else {
    response = freeze({ ...response, state: "accepted", acceptedAtPulse: pulseIndex });
  }
  if (response.responseType !== "decline") {
    const consumptionKey = response.reactionResponseId;
    if (runtime.budgetConsumptionKeys.has(consumptionKey)) return { accepted: false, reason: "duplicate-reaction-budget-consumption" };
    const budget = getBudgetForCycle(runtime, response.responderId, response.budgetCycleIndex, { emit: onEvent, makeCurrent: false });
    if (budget.remaining <= 0) return { accepted: false, reason: "reaction-budget-spent" };
    const next = freeze({ ...budget, used: budget.used + 1, remaining: budget.remaining - 1 });
    runtime.budgetHistory.set(`${response.responderId}:${response.budgetCycleIndex}`, next);
    if (runtime.budgets.get(response.responderId)?.cycleIndex === response.budgetCycleIndex) runtime.budgets.set(response.responderId, next);
    retainBoundedKey(runtime, runtime.budgetConsumptionKeys, runtime.budgetConsumptionOrder, consumptionKey);
    onEvent?.(event("tactical-reaction-budget-consumed", window, pulseIndex, { reactionResponseId: response.reactionResponseId, responseType: response.responseType, budgetBefore: budget.remaining, budgetAfter: next.remaining }));
  }
  const locked = transitionWindow(window, "locked", {
    selectedPrimaryResponse: response,
    responses: freeze(window.responses.some((entry) => entry.responderId === response.responderId)
      ? window.responses.map((entry) => entry.responderId === response.responderId ? response : entry)
      : [...window.responses, response]),
    lockedAtPulse: pulseIndex,
    terminalReason: expired ? "response-deadline-expired" : null,
  });
  runtime.activeWindows.set(window.reactionWindowId, locked.window);
  onEvent?.(event("tactical-reaction-window-locked", locked.window, pulseIndex, { previousState: "awaiting-responses", nextState: "locked", reactionResponseId: response.reactionResponseId, responseType: response.responseType }));
  return { accepted: true, window: locked.window, response };
}

export function admitTacticalReactionResolution({ runtime, reactionWindowId, pulseIndex, onEvent } = {}) {
  const window = runtime?.activeWindows?.get(String(reactionWindowId ?? ""));
  if (!window) return { accepted: false, reason: "reaction-window-not-active" };
  if (runtime.resolvedWindowIds.has(window.reactionWindowId) || runtime.defenseAdmissionKeys.has(window.reactionWindowId)) return { accepted: false, reason: "duplicate-canonical-defense-resolution" };
  const resolving = transitionWindow(window, "resolving", { resolvingAtPulse: pulseIndex });
  if (!resolving.accepted) return resolving;
  runtime.activeWindows.set(window.reactionWindowId, resolving.window);
  retainBoundedKey(runtime, runtime.defenseAdmissionKeys, runtime.defenseAdmissionOrder, window.reactionWindowId);
  onEvent?.(event("tactical-reaction-resolution-admitted", resolving.window, pulseIndex, { previousState: "locked", nextState: "resolving", reactionResponseId: window.selectedPrimaryResponse?.reactionResponseId, responseType: window.selectedPrimaryResponse?.responseType }));
  return { accepted: true, window: resolving.window, response: resolving.window.selectedPrimaryResponse };
}

export function completeTacticalReactionResolution({ runtime, reactionWindowId, pulseIndex, result, onEvent } = {}) {
  const window = runtime?.activeWindows?.get(String(reactionWindowId ?? ""));
  if (!window) return { accepted: false, reason: "reaction-window-not-active" };
  if (runtime.resolvedWindowIds.has(window.reactionWindowId)) return { accepted: false, reason: "duplicate-canonical-defense-resolution" };
  const completed = transitionWindow(window, "resolved", { resolvedAtPulse: pulseIndex, resolution: result ?? null });
  if (!completed.accepted) return completed;
  runtime.resolvedWindowIds.add(window.reactionWindowId);
  runtime.resolvedWindowOrder.push(window.reactionWindowId);
  while (runtime.resolvedWindowOrder.length > runtime.maxResolutionHistory) runtime.resolvedWindowIds.delete(runtime.resolvedWindowOrder.shift());
  runtime.activeWindows.delete(window.reactionWindowId);
  runtime.windowByExecutionKey.delete(window.sourceExecutionKey);
  runtime.responderOwnership.delete(window.primaryTargetId);
  retainTerminal(runtime, completed.window);
  onEvent?.(event("tactical-reaction-resolution-completed", completed.window, pulseIndex, { previousState: "resolving", nextState: "resolved", reactionResponseId: window.selectedPrimaryResponse?.reactionResponseId, responseType: window.selectedPrimaryResponse?.responseType }));
  return { accepted: true, window: completed.window };
}

export function invalidateTacticalReactionWindow({ runtime, reactionWindowId, pulseIndex, reason = "reaction-invalidated", canceled = false, onEvent } = {}) {
  const window = runtime?.activeWindows?.get(String(reactionWindowId ?? ""));
  if (!window) return { accepted: false, reason: "reaction-window-not-active" };
  const nextState = canceled ? "canceled" : "invalidated";
  const terminal = transitionWindow(window, nextState, { terminalReason: reason, resolvedAtPulse: pulseIndex });
  if (!terminal.accepted) return terminal;
  runtime.activeWindows.delete(window.reactionWindowId);
  runtime.windowByExecutionKey.delete(window.sourceExecutionKey);
  runtime.responderOwnership.delete(window.primaryTargetId);
  retainTerminal(runtime, terminal.window);
  onEvent?.(event(canceled ? "tactical-reaction-window-canceled" : "tactical-reaction-window-invalidated", terminal.window, pulseIndex, { previousState: window.state, nextState, terminalReason: reason }));
  return { accepted: true, window: terminal.window };
}

export function progressTacticalReactionWindows({ runtime, pulseIndex, fighters = [], combatActive = true, onEvent } = {}) {
  if (!runtime || runtime.closed) return { accepted: false, reason: "tactical-reaction-runtime-closed" };
  for (const window of [...runtime.activeWindows.values()]) {
    const attacker = fighters.find((actor) => idOf(actor) === window.attackerId);
    const defender = fighters.find((actor) => idOf(actor) === window.primaryTargetId);
    if (!combatActive || !isTacticalReactionCombatCapable(attacker) || !isTacticalReactionCombatCapable(defender)) {
      invalidateTacticalReactionWindow({ runtime, reactionWindowId: window.reactionWindowId, pulseIndex, reason: !combatActive ? "combat-ended" : !isTacticalReactionCombatCapable(attacker) ? "attacker-not-combat-capable" : "defender-not-combat-capable", onEvent });
      continue;
    }
    for (const responderId of window.eligibleResponderIds) getTacticalReactionBudget(runtime, responderId, pulseIndex, { emit: onEvent });
    if (window.state === "awaiting-responses" && pulseIndex >= window.responseDeadlinePulse) {
      lockTacticalReactionWindow({ runtime, reactionWindowId: window.reactionWindowId, pulseIndex, onEvent });
    }
  }
  return { accepted: true, audit: auditTacticalReactionOwnership(runtime) };
}

export function cleanupTacticalReactionRuntime(runtime, reason = "combat-ended", { pulseIndex = null, onEvent } = {}) {
  if (!runtime) return { accepted: false, reason: "tactical-reaction-runtime-required" };
  if (runtime.cleanupCompleted) return { accepted: false, reason: "tactical-reaction-cleanup-already-completed", data: runtime.lastCleanup };
  const counts = {
    openWindowCount: runtime.activeWindows.size,
    awaitingResponseCount: [...runtime.activeWindows.values()].filter((window) => window.state === "awaiting-responses").length,
    lockedWindowCount: [...runtime.activeWindows.values()].filter((window) => window.state === "locked").length,
    resolvingWindowCount: [...runtime.activeWindows.values()].filter((window) => window.state === "resolving").length,
    responderOwnershipCount: runtime.responderOwnership.size,
  };
  for (const window of [...runtime.activeWindows.values()]) {
    invalidateTacticalReactionWindow({ runtime, reactionWindowId: window.reactionWindowId, pulseIndex, reason, canceled: window.state === "offered" || window.state === "awaiting-responses", onEvent });
  }
  runtime.closed = true;
  runtime.cleanupCompleted = true;
  runtime.lastCleanup = freeze({
    ...counts,
    postTerminalResponsesBlocked: runtime.postTerminalResponsesBlocked,
    postTerminalAttacksBlocked: runtime.postTerminalAttacksBlocked,
    matches: runtime.activeWindows.size === 0 && runtime.responderOwnership.size === 0,
  });
  onEvent?.({ eventType: "tactical-reaction-terminal-cleanup", actorId: null, data: runtime.lastCleanup });
  return { accepted: true, eventType: "tactical-reaction-terminal-cleanup", data: runtime.lastCleanup };
}

export function auditTacticalReactionOwnership(runtime) {
  const windows = [...(runtime?.activeWindows?.values?.() || [])];
  const responderIds = [...(runtime?.responderOwnership?.keys?.() || [])];
  const duplicateExecutionKeys = windows.filter((window, index) => windows.findIndex((entry) => entry.sourceExecutionKey === window.sourceExecutionKey) !== index);
  return {
    openWindowCount: windows.length,
    awaitingResponseCount: windows.filter((window) => window.state === "awaiting-responses").length,
    lockedWindowCount: windows.filter((window) => window.state === "locked").length,
    resolvingWindowCount: windows.filter((window) => window.state === "resolving").length,
    responderOwnershipCount: responderIds.length,
    terminalHistoryCount: runtime?.terminalHistory?.length || 0,
    resolvedWindowCount: runtime?.resolvedWindowIds?.size || 0,
    responseHistoryCount: runtime?.responseHistory?.length || 0,
    budgetConsumptionCount: runtime?.budgetConsumptionKeys?.size || 0,
    defenseAdmissionCount: runtime?.defenseAdmissionKeys?.size || 0,
    postTerminalResponsesBlocked: runtime?.postTerminalResponsesBlocked || 0,
    postTerminalAttacksBlocked: runtime?.postTerminalAttacksBlocked || 0,
    matches: duplicateExecutionKeys.length === 0 && responderIds.every((actorId) => runtime.activeWindows.has(runtime.responderOwnership.get(actorId))),
  };
}

export function getActiveTacticalReactionForResponder(runtime, responderId) {
  const windowId = runtime?.responderOwnership?.get(String(responderId ?? ""));
  return windowId ? runtime.activeWindows.get(windowId) || null : null;
}

export function getTacticalReactionWindowByExecution(runtime, executionKey) {
  const windowId = runtime?.windowByExecutionKey?.get(String(executionKey ?? ""));
  return windowId ? runtime.activeWindows.get(windowId) || null : null;
}

export function isTacticalReactionTerminal(window) {
  return WINDOW_TERMINAL_STATES.has(window?.state);
}
