const freeze = (value) => Object.freeze(value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const point = (value) => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? freeze({ x, y }) : null;
};

export const TACTICAL_CHARGE_TIMING = freeze({
  preparationPulses: 1,
  recoveryPulses: 2,
  maximumStepsPerPulse: 3,
  minimumCommittedSteps: 2,
});

export const TACTICAL_CHARGE_STATES = freeze({
  PLANNED: "planned",
  PREPARING: "preparing",
  READY: "ready",
  COMMITTED: "committed",
  ADVANCING: "advancing",
  CONTACT_PENDING: "contact-pending",
  RESOLVING: "resolving",
  RECOVERING: "recovering",
  COMPLETED: "completed",
  CANCELED: "canceled",
  INTERRUPTED: "interrupted",
  INVALIDATED: "invalidated",
  EXPIRED: "expired",
  STOPPED: "stopped",
});

const transitions = freeze({
  planned: new Set(["preparing", "canceled", "invalidated"]),
  preparing: new Set(["ready", "canceled", "interrupted", "invalidated", "expired"]),
  ready: new Set(["committed", "canceled", "interrupted", "invalidated", "expired"]),
  committed: new Set(["advancing", "contact-pending", "interrupted", "invalidated", "stopped"]),
  advancing: new Set(["advancing", "contact-pending", "interrupted", "invalidated", "stopped"]),
  "contact-pending": new Set(["resolving", "interrupted", "invalidated", "stopped"]),
  resolving: new Set(["recovering", "completed", "interrupted", "invalidated", "stopped"]),
  recovering: new Set(["completed", "interrupted", "invalidated"]),
});

export const isTacticalChargeTerminal = (value) => [
  "completed", "canceled", "interrupted", "invalidated", "expired", "stopped",
].includes(String(value?.state || value || ""));

export function getChargeCapabilities(weapon = {}, technique = {}) {
  const profile = technique?.chargeCapabilities || weapon?.chargeCapabilities || {};
  return freeze({
    canCharge: profile.canCharge === true || technique?.canCharge === true || weapon?.canCharge === true,
    minimumCommittedSteps: Math.max(1, finite(profile.minimumCommittedSteps, TACTICAL_CHARGE_TIMING.minimumCommittedSteps)),
    maximumStepsPerPulse: Math.max(1, finite(profile.maximumStepsPerPulse, TACTICAL_CHARGE_TIMING.maximumStepsPerPulse)),
  });
}

export function createTacticalChargeIntent(input = {}) {
  const generationId = finite(input.generationId, NaN);
  const combatSession = finite(input.combatSession, NaN);
  const chargerId = String(input.chargerId ?? input.actorId ?? "");
  const targetActorId = String(input.targetActorId ?? "");
  const weaponId = String(input.weaponId ?? "");
  const plannedPath = Array.isArray(input.plannedPath) ? input.plannedPath.map(point) : [];
  if (!Number.isFinite(generationId) || !Number.isFinite(combatSession)) return { accepted: false, reason: "charge-coordinate-required" };
  if (!chargerId || !targetActorId || chargerId === targetActorId) return { accepted: false, reason: "charge-participants-invalid" };
  if (!weaponId) return { accepted: false, reason: "charge-weapon-required" };
  if (plannedPath.some((entry) => !entry)) return { accepted: false, reason: "charge-path-invalid" };
  const capabilities = input.chargeCapabilities || getChargeCapabilities(input.weapon, input.technique);
  if (capabilities.canCharge !== true) return { accepted: false, reason: "weapon-not-charge-capable" };
  const minimumCommittedSteps = Math.max(1, finite(input.minimumCommittedSteps, capabilities.minimumCommittedSteps));
  if (plannedPath.length < minimumCommittedSteps) return { accepted: false, reason: "charge-path-too-short" };
  const declaredAtPulse = Math.max(0, finite(input.declaredAtPulse, 0));
  const chargeIntentId = String(input.chargeIntentId || `${generationId}:${combatSession}:${chargerId}:charge:${declaredAtPulse}`);
  const actionIntentId = String(input.actionIntentId || `${chargeIntentId}:action`);
  return {
    accepted: true,
    intent: freeze({
      chargeIntentId,
      actionIntentId,
      generationId,
      combatSession,
      chargerId,
      targetActorId,
      weaponId,
      techniqueId: input.techniqueId ? String(input.techniqueId) : null,
      declaredAtPulse,
      preparationStartedAtPulse: null,
      readyAtPulse: null,
      committedAtPulse: null,
      contactAtPulse: null,
      recoveryUntilPulse: null,
      preparationPulses: Math.max(1, finite(input.preparationPulses, TACTICAL_CHARGE_TIMING.preparationPulses)),
      recoveryPulses: Math.max(0, finite(input.recoveryPulses, TACTICAL_CHARGE_TIMING.recoveryPulses)),
      minimumCommittedSteps,
      maximumStepsPerPulse: Math.max(1, finite(input.maximumStepsPerPulse, capabilities.maximumStepsPerPulse)),
      plannedPath: freeze(plannedPath),
      committedPath: freeze([]),
      completedPath: freeze([]),
      startingPosition: point(input.startingPosition),
      currentPosition: point(input.currentPosition || input.startingPosition),
      intendedContactPosition: point(input.intendedContactPosition || plannedPath.at(-1)),
      movementOwnershipKey: null,
      state: "planned",
      interruptionReason: null,
      invalidationReason: null,
      sourceExecutionKey: input.sourceExecutionKey || null,
      contactExecutionKey: null,
      result: null,
    }),
  };
}

export function transitionTacticalCharge(intent, nextState, patch = {}) {
  if (!intent?.chargeIntentId) return { accepted: false, reason: "charge-intent-required" };
  if (!transitions[intent.state]?.has(nextState)) {
    return { accepted: false, reason: "illegal-charge-transition", previousState: intent.state, nextState };
  }
  const next = freeze({ ...intent, ...patch, state: nextState });
  return { accepted: true, intent: next, previousState: intent.state, nextState };
}

export function buildTacticalChargeExecutionKey(intent, kind, sequence = 1) {
  return [
    intent.generationId,
    intent.combatSession,
    intent.chargeIntentId,
    kind,
    sequence,
  ].join(":");
}
