export async function resolveTacticalOverwatchAttack({ admission, executeCanonicalAttack } = {}) {
  if (!admission?.intent || !admission?.window || !admission?.executionKey || !admission?.projectileIdentity) return { accepted: false, reason: "overwatch-admission-incomplete" };
  if (Number(admission.intent.reactionDepth || 0) >= 1) return { accepted: false, reason: "reaction-depth-cap" };
  if (typeof executeCanonicalAttack !== "function") return { accepted: false, reason: "canonical-ranged-executor-required" };
  return executeCanonicalAttack(Object.freeze({
    generationId: admission.intent.generationId, combatSession: admission.intent.combatSession,
    pulseIndex: admission.window.openedAtPulse, overwatchIntentId: admission.intent.overwatchIntentId,
    sourceActionIntentId: admission.intent.actionIntentId, overwatchWindowId: admission.window.overwatchWindowId,
    triggerEventId: admission.window.triggerEventId, actorId: admission.intent.actorId,
    targetActorId: admission.window.targetActorId, weaponId: admission.intent.weaponId,
    techniqueId: admission.intent.techniqueId, projectileIdentity: admission.projectileIdentity,
    executionKey: admission.executionKey, attackExecutionKey: admission.executionKey,
    reactionDepth: Number(admission.intent.reactionDepth || 0) + 1,
    tacticalSource: "missile-overwatch", allowOutOfTurnAttack: true,
  }));
}
