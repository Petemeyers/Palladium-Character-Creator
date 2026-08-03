export async function resolveTacticalPostParryResponse({
  admission,
  executors = {},
} = {}) {
  if (!admission?.window || !admission?.responseType || !admission?.canonicalResponseType || !admission?.executionKey) {
    return { accepted: false, reason: "tactical-post-parry-admission-incomplete" };
  }
  const handler = executors[admission.responseType] || executors[admission.canonicalResponseType];
  if (typeof handler !== "function") return { accepted: false, reason: "canonical-post-parry-executor-missing" };
  const request = Object.freeze({
    generationId: admission.window.generationId,
    combatSession: admission.window.combatSession,
    sourceActionIntentId: admission.window.sourceActionIntentId,
    sourceExecutionKey: admission.window.sourceExecutionKey,
    sourceReactionWindowId: admission.window.sourceReactionWindowId,
    sourceReactionResponseId: admission.window.sourceReactionResponseId,
    canonicalResponseOfferId: admission.window.canonicalResponseOfferId,
    tacticalPostParryWindowId: admission.window.tacticalPostParryWindowId,
    responseExecutionKey: admission.executionKey,
    responseType: admission.responseType,
    canonicalResponseType: admission.canonicalResponseType,
    respondingActorId: admission.window.parryingDefenderId,
    targetActorId: admission.window.originalAttackerId,
    parryQuality: admission.window.parryQuality,
    parryingWeaponId: admission.window.parryingWeaponId,
    incomingWeaponId: admission.window.incomingWeaponId,
    responseSequence: admission.window.responseSequence,
    reactionDepth: admission.window.reactionDepth,
    canonicalOffer: admission.window.canonicalOffer,
  });
  return handler(request);
}
