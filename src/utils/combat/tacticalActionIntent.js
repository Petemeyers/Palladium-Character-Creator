import { getTacticalActionTiming } from "../../data/tacticalActionTiming.js";

export const TACTICAL_ACTION_STATES = Object.freeze([
  "planned", "preparing", "ready", "resolving", "released", "contact-resolved",
  "recovering", "completed", "interrupted", "canceled", "expired", "invalidated",
]);

export const TACTICAL_ACTION_TERMINAL_STATES = Object.freeze([
  "completed", "interrupted", "canceled", "expired", "invalidated",
]);

const TRANSITIONS = Object.freeze({
  planned: Object.freeze(["preparing", "canceled", "invalidated", "interrupted"]),
  preparing: Object.freeze(["ready", "canceled", "invalidated", "interrupted", "expired"]),
  ready: Object.freeze(["resolving", "canceled", "invalidated", "interrupted", "expired"]),
  resolving: Object.freeze(["released", "contact-resolved", "invalidated", "interrupted"]),
  released: Object.freeze(["recovering", "completed"]),
  "contact-resolved": Object.freeze(["recovering", "completed"]),
  recovering: Object.freeze(["completed", "interrupted", "canceled"]),
});

export function createTacticalActionIntent({
  actionIntentId,
  generationId,
  combatSession,
  actorId,
  targetActorId,
  groupId = null,
  orderId = null,
  commandSourceActorId = null,
  formationSlotId = null,
  synchronizedReleaseId = null,
  volleyId = null,
  actionFamily = "attack",
  actionType = "melee-attack",
  techniqueId = null,
  weaponId,
  weaponFamily = null,
  attackProfileId = null,
  timingKey = "unarmedQuickStrike",
  createdAtPulse = 0,
  actionSequence = 1,
  source = "tactical-action",
} = {}) {
  if (!actionIntentId || !actorId || !targetActorId || !weaponId) {
    return { accepted: false, reason: "invalid-tactical-action-identity" };
  }
  const timing = getTacticalActionTiming(timingKey);
  const createdPulse = Number(createdAtPulse) || 0;
  const intent = Object.freeze({
    actionIntentId: String(actionIntentId),
    generationId: Number(generationId),
    combatSession: Number(combatSession),
    actorId: String(actorId),
    targetActorId: String(targetActorId),
    groupId, orderId, commandSourceActorId, formationSlotId, synchronizedReleaseId, volleyId,
    actionFamily,
    actionType,
    techniqueId,
    weaponId: String(weaponId),
    weaponFamily,
    attackProfileId,
    timingKey,
    createdAtPulse: createdPulse,
    startedAtPulse: createdPulse,
    readyAtPulse: createdPulse + timing.preparationPulses,
    releaseAtPulse: null,
    recoveryUntilPulse: null,
    preparationDuration: timing.preparationPulses,
    recoveryDuration: timing.recoveryPulses,
    actionSequence: Math.max(1, Number(actionSequence) || 1),
    source,
    state: "planned",
    interruptionReason: null,
    invalidationReason: null,
    executionKey: null,
    result: null,
  });
  return { accepted: true, intent };
}

export function transitionTacticalAction(intent, nextState, patch = {}) {
  if (!intent || !TACTICAL_ACTION_STATES.includes(nextState)) {
    return { accepted: false, reason: "invalid-tactical-action-state", intent };
  }
  if (!TRANSITIONS[intent.state]?.includes(nextState)) {
    return { accepted: false, reason: "illegal-tactical-action-transition", intent };
  }
  return { accepted: true, intent: Object.freeze({ ...intent, ...patch, state: nextState }) };
}

export function isTacticalActionTerminal(intent) {
  return TACTICAL_ACTION_TERMINAL_STATES.includes(intent?.state);
}

export function buildTacticalAttackExecutionKey(intent, pulseIndex) {
  if (!intent) return null;
  return [
    "tactical-attack", intent.generationId, intent.combatSession, Number(pulseIndex),
    intent.actorId, intent.targetActorId, intent.actionIntentId, intent.actionSequence,
  ].join(":");
}
