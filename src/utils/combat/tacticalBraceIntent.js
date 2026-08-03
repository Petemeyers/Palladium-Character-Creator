const freeze = (value) => Object.freeze(value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const point = (value) => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? freeze({ x, y }) : null;
};

export const TACTICAL_BRACE_TIMING = freeze({ preparationPulses: 1, recoveryPulses: 1 });
export const TACTICAL_BRACE_STATES = freeze({
  PLANNED: "planned", PREPARING: "preparing", READY: "ready", HELD: "held",
  TRIGGERED: "triggered", RESOLVING: "resolving", CONSUMED: "consumed",
  RECOVERING: "recovering", COMPLETED: "completed", CANCELED: "canceled",
  INTERRUPTED: "interrupted", INVALIDATED: "invalidated", EXPIRED: "expired",
});
const transitions = freeze({
  planned: new Set(["preparing", "canceled", "invalidated"]),
  preparing: new Set(["ready", "canceled", "interrupted", "invalidated", "expired"]),
  ready: new Set(["held", "canceled", "interrupted", "invalidated", "expired"]),
  held: new Set(["triggered", "canceled", "interrupted", "invalidated", "expired"]),
  triggered: new Set(["resolving", "held", "invalidated", "interrupted"]),
  resolving: new Set(["consumed", "held", "invalidated", "interrupted"]),
  consumed: new Set(["recovering", "completed"]),
  recovering: new Set(["completed", "invalidated", "interrupted"]),
});

export const isTacticalBraceTerminal = (value) => [
  "completed", "canceled", "interrupted", "invalidated", "expired",
].includes(String(value?.state || value || ""));

export function getBraceCapabilities(weapon = {}, technique = {}) {
  const profile = technique?.braceCapabilities || weapon?.braceCapabilities || {};
  return freeze({
    canBrace: profile.canBrace === true,
    interceptionReachHexes: Math.max(1, finite(profile.interceptionReachHexes, 1)),
  });
}

export function createTacticalBraceIntent(input = {}) {
  const generationId = finite(input.generationId, NaN);
  const combatSession = finite(input.combatSession, NaN);
  const bracingActorId = String(input.bracingActorId ?? input.actorId ?? "");
  const weaponId = String(input.weaponId ?? "");
  const capabilities = input.braceCapabilities || getBraceCapabilities(input.weapon, input.technique);
  if (!Number.isFinite(generationId) || !Number.isFinite(combatSession)) return { accepted: false, reason: "brace-coordinate-required" };
  if (!bracingActorId || !weaponId) return { accepted: false, reason: "brace-owner-and-weapon-required" };
  if (capabilities.canBrace !== true) return { accepted: false, reason: "weapon-not-brace-capable" };
  const anchorPosition = point(input.anchorPosition);
  const guardedHexes = Array.isArray(input.guardedHexes) ? input.guardedHexes.map(point) : [];
  if (!anchorPosition || !guardedHexes.length || guardedHexes.some((entry) => !entry)) return { accepted: false, reason: "brace-guarded-zone-required" };
  const declaredAtPulse = Math.max(0, finite(input.declaredAtPulse, 0));
  const braceIntentId = String(input.braceIntentId || `${generationId}:${combatSession}:${bracingActorId}:brace:${declaredAtPulse}`);
  return {
    accepted: true,
    intent: freeze({
      braceIntentId,
      actionIntentId: String(input.actionIntentId || `${braceIntentId}:action`),
      generationId,
      combatSession,
      bracingActorId,
      weaponId,
      techniqueId: input.techniqueId ? String(input.techniqueId) : null,
      targetActorId: input.targetActorId ? String(input.targetActorId) : null,
      declaredAtPulse,
      readyAtPulse: null,
      triggeredAtPulse: null,
      consumedAtPulse: null,
      recoveryUntilPulse: null,
      preparationPulses: Math.max(1, finite(input.preparationPulses, TACTICAL_BRACE_TIMING.preparationPulses)),
      recoveryPulses: Math.max(0, finite(input.recoveryPulses, TACTICAL_BRACE_TIMING.recoveryPulses)),
      anchorPosition,
      guardedHexes: freeze(guardedHexes),
      guardedApproachVectors: freeze(Array.isArray(input.guardedApproachVectors) ? input.guardedApproachVectors.map(point).filter(Boolean) : []),
      interceptionReachHexes: Math.max(1, finite(input.interceptionReachHexes, capabilities.interceptionReachHexes)),
      state: "planned",
      triggerChargeIntentId: null,
      triggerActorId: null,
      interceptionExecutionKey: null,
      invalidationReason: null,
      result: null,
    }),
  };
}

export function transitionTacticalBrace(intent, nextState, patch = {}) {
  if (!intent?.braceIntentId) return { accepted: false, reason: "brace-intent-required" };
  if (!transitions[intent.state]?.has(nextState)) {
    return { accepted: false, reason: "illegal-brace-transition", previousState: intent.state, nextState };
  }
  return { accepted: true, intent: freeze({ ...intent, ...patch, state: nextState }), previousState: intent.state, nextState };
}
