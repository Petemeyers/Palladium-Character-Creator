import { buildTacticalAttackExecutionKey } from "./tacticalActionIntent.js";

export async function resolveTacticalAttackIntent({
  intent,
  pulseIndex,
  executionKey: admittedExecutionKey,
  executionAlreadyClaimed = false,
  reactionAdmission = null,
  ammunition: admittedAmmunition = null,
  ammunitionAlreadySpent = false,
  executeCanonicalAttack,
  spendCanonicalAmmunition,
  claimExecution,
  onRelease,
} = {}) {
  if (!intent || !["ready", "resolving"].includes(intent.state)) return { accepted: false, reason: "tactical-action-not-ready" };
  if (typeof executeCanonicalAttack !== "function") return { accepted: false, reason: "canonical-attack-executor-required" };
  if (typeof claimExecution !== "function") return { accepted: false, reason: "tactical-execution-claim-required" };
  const executionKey = admittedExecutionKey || buildTacticalAttackExecutionKey(intent, pulseIndex);
  if (!executionAlreadyClaimed) {
    const claim = claimExecution(executionKey, intent);
    if (!claim.accepted) return { accepted: false, reason: claim.reason || "duplicate-tactical-attack-execution", executionKey };
  }

  let ammunition = admittedAmmunition;
  if (intent.actionType === "ranged-attack" && !ammunitionAlreadySpent) {
    if (typeof spendCanonicalAmmunition !== "function") {
      return { accepted: false, reason: "canonical-ammunition-spend-required", executionKey };
    }
    try {
      ammunition = await spendCanonicalAmmunition({
        actorId: intent.actorId,
        targetActorId: intent.targetActorId,
        weaponId: intent.weaponId,
        actionIntentId: intent.actionIntentId,
        executionKey,
        amount: 1,
        pulseIndex,
      });
    } catch (error) {
      return {
        accepted: false,
        reason: "canonical-ammunition-callback-threw",
        executionKey,
        errorName: error?.name || "Error",
        errorMessage: error?.message || String(error),
      };
    }
    if (ammunition?.accepted === false) {
      return { accepted: false, reason: ammunition.reason || "ammunition-release-rejected", executionKey };
    }
  }

  let result;
  try {
    result = await executeCanonicalAttack({
      actorId: intent.actorId,
      targetActorId: intent.targetActorId,
      weaponId: intent.weaponId,
      techniqueId: intent.techniqueId,
      actionType: intent.actionType,
      actionIntentId: intent.actionIntentId,
      actionSequence: intent.actionSequence,
      generationId: intent.generationId,
      combatSession: intent.combatSession,
      pulseIndex,
      executionKey,
      reactionAdmission,
      ammunition,
      source: "tactical-pulse-attack",
      suppressSequentialTurnAdvance: true,
    });
  } catch (error) {
    return {
      accepted: false,
      reason: "canonical-attack-callback-threw",
      executionKey,
      ammunition,
      errorName: error?.name || "Error",
      errorMessage: error?.message || String(error),
    };
  }
  if (result?.accepted === false || result?.blocked) {
    return { accepted: false, reason: result?.reason || "canonical-attack-rejected", executionKey, ammunition, result };
  }
  if (intent.actionType === "ranged-attack" && !ammunitionAlreadySpent) {
    if (result?.ammunitionSpent !== 0) {
      onRelease?.({ intent, executionKey, ammunition, pulseIndex, result });
    }
  }
  return { accepted: true, executionKey, ammunition, result };
}

export default resolveTacticalAttackIntent;
