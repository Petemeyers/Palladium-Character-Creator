const freeze = (value) => Object.freeze(value);
const pointKey = (value) => `${Number(value?.x)},${Number(value?.y)}`;
const distance = (a, b) => Math.max(Math.abs(Number(a?.x) - Number(b?.x)), Math.abs(Number(a?.y) - Number(b?.y)));

export const TACTICAL_INTERCEPTION_CHOICES = freeze({ INTERCEPT: "intercept", LET_PASS: "let-pass" });
const terminalStates = new Set(["resolved", "declined", "canceled", "invalidated", "expired"]);

export function chargeStepCrossesBraceZone({ charge, brace, from, to, charger, bracer } = {}) {
  if (!charge || !["committed", "advancing"].includes(charge.state) || !brace || brace.state !== "held" || charge.chargerId === brace.bracingActorId) return false;
  if (charger?.team === undefined || bracer?.team === undefined || charger.team === bracer.team) return false;
  if (brace.targetActorId && brace.targetActorId !== charge.chargerId) return false;
  if (!brace.guardedHexes.some((hex) => pointKey(hex) === pointKey(to))) return false;
  if (brace.guardedHexes.some((hex) => pointKey(hex) === pointKey(from))) return false;
  const before = distance(from, brace.anchorPosition);
  const after = distance(to, brace.anchorPosition);
  if (after >= before || after > brace.interceptionReachHexes) return false;
  if (brace.guardedApproachVectors.length) {
    const movement = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
    if (!brace.guardedApproachVectors.some((vector) => vector.x === movement.x && vector.y === movement.y)) return false;
  }
  return true;
}

export function selectDeterministicBraceCandidate(candidates = []) {
  return [...candidates].sort((left, right) => (
    Number(left.crossedBoundaryIndex ?? 0) - Number(right.crossedBoundaryIndex ?? 0)
    || Number(left.interceptionDistance ?? Infinity) - Number(right.interceptionDistance ?? Infinity)
    || Number(right.initiativeTotal ?? 0) - Number(left.initiativeTotal ?? 0)
    || Number(left.initiativeRank ?? Infinity) - Number(right.initiativeRank ?? Infinity)
    || String(left.brace?.bracingActorId || "").localeCompare(String(right.brace?.bracingActorId || ""))
  ))[0] || null;
}

export function createTacticalInterceptionWindow({ charge, brace, proposedMovementStep, pulseIndex, reactionDepth = 0 } = {}) {
  if (!charge?.chargeIntentId || !brace?.braceIntentId || !proposedMovementStep?.from || !proposedMovementStep?.to) {
    return { accepted: false, reason: "interception-identity-incomplete" };
  }
  if (charge.generationId !== brace.generationId || charge.combatSession !== brace.combatSession) {
    return { accepted: false, reason: "interception-coordinate-mismatch" };
  }
  const stepIndex = Number(proposedMovementStep.stepIndex ?? charge.completedPath.length);
  const id = `${charge.generationId}:${charge.combatSession}:${charge.chargeIntentId}:${brace.braceIntentId}:intercept:${stepIndex}`;
  return { accepted: true, window: freeze({
    interceptionWindowId: id,
    generationId: charge.generationId,
    combatSession: charge.combatSession,
    chargeIntentId: charge.chargeIntentId,
    braceIntentId: brace.braceIntentId,
    chargerId: charge.chargerId,
    interceptorId: brace.bracingActorId,
    weaponId: brace.weaponId,
    techniqueId: brace.techniqueId,
    proposedMovementStep: freeze({ ...proposedMovementStep }),
    triggerPosition: freeze({ ...proposedMovementStep.from }),
    contactPosition: freeze({ ...proposedMovementStep.to }),
    openedAtPulse: Number(pulseIndex),
    responseDeadlinePulse: Number(pulseIndex) + 1,
    lockedAtPulse: null,
    resolvedAtPulse: null,
    state: "offered",
    selectedResponse: null,
    executionKey: null,
    result: null,
    terminalReason: null,
    reactionDepth: Number(reactionDepth),
    executionSequence: 1,
  }) };
}

export function submitTacticalInterceptionChoice(window, choice, identity = {}) {
  if (!window?.interceptionWindowId || window.state !== "offered") return { accepted: false, reason: "interception-window-not-open" };
  if (window.selectedResponse) return { accepted: false, reason: "interception-choice-already-submitted" };
  if (identity.interceptionWindowId && identity.interceptionWindowId !== window.interceptionWindowId) return { accepted: false, reason: "stale-interception-window" };
  if (identity.interceptorId && String(identity.interceptorId) !== window.interceptorId) return { accepted: false, reason: "interception-owner-mismatch" };
  if (!Object.values(TACTICAL_INTERCEPTION_CHOICES).includes(choice)) return { accepted: false, reason: "interception-choice-invalid" };
  return { accepted: true, window: freeze({ ...window, selectedResponse: choice }) };
}

export function lockTacticalInterceptionWindow(window, pulseIndex) {
  if (!window?.selectedResponse || window.state !== "offered") return { accepted: false, reason: "interception-choice-required" };
  if (window.selectedResponse === TACTICAL_INTERCEPTION_CHOICES.LET_PASS) {
    return { accepted: true, window: freeze({ ...window, state: "declined", lockedAtPulse: Number(pulseIndex), resolvedAtPulse: Number(pulseIndex), terminalReason: "interceptor-declined" }) };
  }
  const executionKey = [
    window.interceptionWindowId,
    `pulse-${window.openedAtPulse}`,
    window.chargerId,
    window.interceptorId,
    window.weaponId,
    window.techniqueId || "default",
    `${pointKey(window.proposedMovementStep.from)}>${pointKey(window.proposedMovementStep.to)}`,
    `depth-${Number(window.reactionDepth || 0) + 1}`,
    `execution-${window.executionSequence}`,
  ].join(":");
  return { accepted: true, window: freeze({ ...window, state: "locked", lockedAtPulse: Number(pulseIndex), executionKey }) };
}

export function transitionTacticalInterceptionWindow(window, nextState, patch = {}) {
  const allowed = {
    locked: new Set(["resolving", "invalidated", "canceled"]),
    resolving: new Set(["resolved", "invalidated", "canceled"]),
    offered: new Set(["expired", "invalidated", "canceled"]),
  };
  if (!window || terminalStates.has(window.state) || !allowed[window.state]?.has(nextState)) return { accepted: false, reason: "illegal-interception-transition" };
  return { accepted: true, window: freeze({ ...window, ...patch, state: nextState }) };
}
