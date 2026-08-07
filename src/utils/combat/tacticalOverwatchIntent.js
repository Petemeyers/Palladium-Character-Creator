import { getTacticalActionTiming } from "../../data/tacticalActionTiming.js";

export const TACTICAL_OVERWATCH_TRIGGER_POLICIES = Object.freeze([
  "enters-guarded-zone",
  "crosses-guarded-edge",
  "leaves-cover",
  "begins-charge",
]);

export const TACTICAL_OVERWATCH_TERMINAL_STATES = Object.freeze([
  "completed", "canceled", "interrupted", "invalidated", "expired", "declined",
]);

const TRANSITIONS = Object.freeze({
  planned: new Set(["preparing", "canceled", "invalidated"]),
  preparing: new Set(["ready", "canceled", "interrupted", "invalidated"]),
  ready: new Set(["held", "canceled", "interrupted", "invalidated"]),
  held: new Set(["triggered", "canceled", "interrupted", "invalidated", "expired"]),
  triggered: new Set(["release-pending", "held", "declined", "expired", "invalidated"]),
  "release-pending": new Set(["resolving", "held", "declined", "expired", "invalidated"]),
  resolving: new Set(["released", "invalidated", "interrupted"]),
  released: new Set(["recovering", "completed"]),
  recovering: new Set(["completed", "interrupted"]),
});

const freeze = (value) => Object.freeze(value);
const point = (value) => freeze({ x: Number(value?.x), y: Number(value?.y) });

export function getOverwatchCapabilities(weapon = {}) {
  const profile = weapon.overwatchCapabilities;
  if (profile?.canOverwatch !== true) return freeze({ canOverwatch: false, supportedTriggerPolicies: [] });
  return freeze({
    canOverwatch: true,
    supportedTriggerPolicies: freeze((profile.supportedTriggerPolicies || []).filter((policy) => TACTICAL_OVERWATCH_TRIGGER_POLICIES.includes(policy))),
    maximumGuardedHexes: Math.max(1, Number(profile.maximumGuardedHexes) || 12),
    maximumHeldPulses: Math.max(1, Number(profile.maximumHeldPulses) || 6),
    requiresLoadedState: profile.requiresLoadedState === true,
  });
}

export function createTacticalOverwatchIntent(input = {}) {
  const capability = getOverwatchCapabilities(input.weapon || {});
  const triggerPolicy = String(input.triggerPolicy || "");
  if (!input.overwatchIntentId || !input.actionIntentId || !input.actorId || !input.weaponId) return { accepted: false, reason: "invalid-overwatch-identity" };
  if (!capability.canOverwatch) return { accepted: false, reason: "weapon-cannot-overwatch" };
  if (!capability.supportedTriggerPolicies.includes(triggerPolicy)) return { accepted: false, reason: "unsupported-overwatch-trigger-policy" };
  const guardedHexes = (input.guardedHexes || []).slice(0, capability.maximumGuardedHexes).map(point);
  const guardedActors = freeze((input.guardedActors || []).map(String));
  const guardedApproachVectors = freeze((input.guardedApproachVectors || []).map((edge) => freeze({ from: point(edge.from), to: point(edge.to) })));
  if (!guardedHexes.length && !guardedActors.length && !guardedApproachVectors.length && triggerPolicy !== "begins-charge") return { accepted: false, reason: "overwatch-guard-required" };
  const timing = getTacticalActionTiming(input.timingKey || "longbowStandardShot");
  const declaredAtPulse = Number(input.declaredAtPulse) || 0;
  return { accepted: true, intent: freeze({
    overwatchIntentId: String(input.overwatchIntentId), actionIntentId: String(input.actionIntentId),
    generationId: Number(input.generationId), combatSession: Number(input.combatSession), actorId: String(input.actorId),
    weaponId: String(input.weaponId), techniqueId: input.techniqueId || null, attackProfileId: input.attackProfileId || null,
    timingKey: input.timingKey || "longbowStandardShot", declaredAtPulse, preparationStartedAtPulse: declaredAtPulse,
    readyAtPulse: declaredAtPulse + timing.preparationPulses, heldAtPulse: null, triggeredAtPulse: null,
    releasedAtPulse: null, recoveryUntilPulse: null, preparationPulses: timing.preparationPulses,
    recoveryPulses: timing.recoveryPulses, maximumHeldPulses: Math.max(1, Number(input.maximumHeldPulses) || capability.maximumHeldPulses),
    triggerPolicy, guardedHexes: freeze(guardedHexes), guardedActors,
    guardedApproachVectors, lockedTargetId: null, triggerEventId: null, triggerOwnershipKey: null,
    projectileExecutionKey: null, reactionDepth: Math.max(0, Number(input.reactionDepth) || 0),
    source: input.source || "tactical-overwatch", state: "planned", interruptionReason: null,
    invalidationReason: null, result: null,
  }) };
}

export function transitionTacticalOverwatchIntent(intent, nextState, patch = {}) {
  if (!intent || !TRANSITIONS[intent.state]?.has(nextState)) return { accepted: false, reason: `illegal-overwatch-transition:${intent?.state || "missing"}->${nextState}` };
  return { accepted: true, intent: freeze({ ...intent, ...patch, state: nextState }) };
}

export const isTacticalOverwatchTerminal = (intent) => TACTICAL_OVERWATCH_TERMINAL_STATES.includes(intent?.state);

export function buildTacticalOverwatchExecutionKey(intent, window, sequence = 1) {
  return ["tactical-overwatch", intent.generationId, intent.combatSession, window.openedAtPulse,
    intent.overwatchIntentId, intent.actionIntentId, window.overwatchWindowId, window.triggerEventId,
    intent.actorId, window.targetActorId, intent.weaponId, intent.techniqueId || "default",
    `release-${sequence}`, `depth-${Number(intent.reactionDepth || 0) + 1}`].join(":");
}
