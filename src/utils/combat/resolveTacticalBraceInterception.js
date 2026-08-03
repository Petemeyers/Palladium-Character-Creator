export async function resolveTacticalBraceInterception({ admission, executeCanonicalAttack } = {}) {
  if (!admission?.window || !admission?.charge || !admission?.brace || !admission?.executionKey) {
    return { accepted: false, reason: "brace-interception-admission-incomplete" };
  }
  if (Number(admission.window.reactionDepth || 0) >= 1) {
    return { accepted: false, reason: "reaction-depth-cap" };
  }
  if (typeof executeCanonicalAttack !== "function") return { accepted: false, reason: "canonical-attack-executor-required" };
  const request = Object.freeze({
    generationId: admission.window.generationId,
    combatSession: admission.window.combatSession,
    pulseIndex: admission.pulseIndex,
    chargeIntentId: admission.charge.chargeIntentId,
    braceIntentId: admission.brace.braceIntentId,
    interceptionWindowId: admission.window.interceptionWindowId,
    actorId: admission.brace.bracingActorId,
    targetActorId: admission.charge.chargerId,
    weaponId: admission.brace.weaponId,
    techniqueId: admission.brace.techniqueId,
    proposedMovementStep: admission.window.proposedMovementStep,
    executionKey: admission.executionKey,
    attackExecutionKey: admission.executionKey,
    reactionDepth: Math.min(1, Number(admission.window.reactionDepth || 0) + 1),
    tacticalSource: "brace-interception",
    allowOutOfTurnAttack: true,
  });
  const result = await executeCanonicalAttack(request);
  return result && typeof result === "object"
    ? result
    : { accepted: false, reason: "canonical-interception-result-required" };
}

const positionKey = (value) => {
  const x = Number(value?.x ?? value?.position?.x ?? value?.hex?.x);
  const y = Number(value?.y ?? value?.position?.y ?? value?.hex?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? `${x},${y}` : null;
};

export function deriveTacticalChargeContinuation({ charge, charger, canonicalResult, authoritativePosition } = {}) {
  if (!charge || !charger) return { outcome: "invalidated", reason: "charge-state-unavailable" };
  const hp = Number(charger.currentHP ?? charger.currentHp ?? charger.hp ?? charger.health);
  if (charger.dead || charger.isDead || (Number.isFinite(hp) && hp <= 0)) return { outcome: "charger-defeated", reason: "charger-dead" };
  if (charger.unconscious || charger.isUnconscious || charger.conscious === false) return { outcome: "charger-defeated", reason: "charger-unconscious" };
  if (charger.defeated || charger.isDefeated) return { outcome: "charger-defeated", reason: "charger-defeated" };
  const stability = canonicalResult?.stability || canonicalResult?.impact?.stability || canonicalResult?.result?.stability || canonicalResult?.layeredArmorImpact?.stability || {};
  const prone = charger.prone || charger.isProne || stability.prone === true || canonicalResult?.knockdown === true || canonicalResult?.result?.knockdown === true;
  if (prone) return { outcome: "stopped", reason: "charger-knocked-down" };
  const displaced = Number(stability.displacementFeet || canonicalResult?.forcedMovement?.distanceFeet || canonicalResult?.result?.forcedMovement?.distanceFeet || 0) > 0;
  if (displaced) {
    const finalPositionKey = positionKey(authoritativePosition || charger);
    const lockedPathKeys = new Set([
      positionKey(charge.currentPosition || charge.startingPosition),
      ...(charge.committedPath || []).slice(charge.completedPath?.length || 0).map(positionKey),
    ].filter(Boolean));
    if (!finalPositionKey || !lockedPathKeys.has(finalPositionKey)) {
      return { outcome: "stopped", reason: "charger-forced-off-path", authoritativePosition: authoritativePosition || null };
    }
    return {
      outcome: "disrupted",
      reason: "charger-forced-along-path-without-committed-step",
      authoritativePosition: authoritativePosition || null,
    };
  }
  const grappleState = String(charger.grappleState?.state || "neutral");
  if (grappleState !== "neutral") return { outcome: "stopped", reason: "charger-entered-grapple" };
  if (canonicalResult?.chargeStop === true || canonicalResult?.effects?.includes?.("charge-stop")) return { outcome: "stopped", reason: "canonical-charge-stop" };
  return { outcome: "continues", reason: canonicalResult?.hit ? "impact-without-stop-effect" : "interception-missed" };
}
