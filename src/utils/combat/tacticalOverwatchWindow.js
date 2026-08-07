const freeze = (value) => Object.freeze(value);
const TERMINAL = new Set(["resolved", "declined", "expired", "canceled", "invalidated"]);

export const TACTICAL_OVERWATCH_CHOICES = Object.freeze({ RELEASE: "release", LET_PASS: "let-pass" });

export function createTacticalOverwatchWindow({ intent, triggerEvent, targetActorId, pulseIndex } = {}) {
  if (!intent || intent.state !== "held" || !triggerEvent?.triggerEventId || !targetActorId) return { accepted: false, reason: "overwatch-window-identity-required" };
  return { accepted: true, window: freeze({
    overwatchWindowId: `${intent.overwatchIntentId}:window:${triggerEvent.triggerEventId}`,
    generationId: intent.generationId, combatSession: intent.combatSession,
    overwatchIntentId: intent.overwatchIntentId, sourceActionIntentId: intent.actionIntentId,
    triggerEventId: String(triggerEvent.triggerEventId), overwatcherId: intent.actorId,
    targetActorId: String(targetActorId), weaponId: intent.weaponId, techniqueId: intent.techniqueId,
    triggerPolicy: intent.triggerPolicy, triggerPosition: triggerEvent.to || triggerEvent.position || null,
    sourceMovementEdge: triggerEvent.from && triggerEvent.to ? freeze({ from: freeze({ ...triggerEvent.from }), to: freeze({ ...triggerEvent.to }) }) : null,
    movementOwnershipKey: triggerEvent.movementOwnershipKey || null,
    openedAtPulse: Number(pulseIndex), responseDeadlinePulse: Number(pulseIndex) + 1,
    lockedAtPulse: null, resolvedAtPulse: null, state: "offered", selectedResponse: null,
    executionKey: null, terminalReason: null, result: null,
  }) };
}

export function submitTacticalOverwatchChoice(window, { choice, pulseIndex, overwatchWindowId, overwatcherId } = {}) {
  if (!window || TERMINAL.has(window.state) || window.selectedResponse) return { accepted: false, reason: "overwatch-choice-already-settled" };
  if (overwatchWindowId && overwatchWindowId !== window.overwatchWindowId) return { accepted: false, reason: "stale-overwatch-window" };
  if (overwatcherId && String(overwatcherId) !== window.overwatcherId) return { accepted: false, reason: "overwatch-owner-mismatch" };
  if (Number(pulseIndex) > window.responseDeadlinePulse) return { accepted: false, reason: "overwatch-response-expired" };
  if (!Object.values(TACTICAL_OVERWATCH_CHOICES).includes(choice)) return { accepted: false, reason: "invalid-overwatch-choice" };
  return { accepted: true, window: freeze({ ...window, selectedResponse: choice, state: "awaiting-selection" }) };
}

export function transitionTacticalOverwatchWindow(window, nextState, patch = {}) {
  const allowed = { offered: new Set(["awaiting-selection", "expired", "canceled", "invalidated"]),
    "awaiting-selection": new Set(["locked", "declined", "expired", "canceled", "invalidated"]),
    locked: new Set(["resolving", "canceled", "invalidated"]), resolving: new Set(["resolved", "canceled", "invalidated"]) };
  if (!window || TERMINAL.has(window.state) || !allowed[window.state]?.has(nextState)) return { accepted: false, reason: "illegal-overwatch-window-transition" };
  return { accepted: true, window: freeze({ ...window, ...patch, state: nextState }) };
}
