const normalizeSource = (source) => String(source || "").trim();

export function resolveTurnDiagnosticSource({
  source,
  activeAttack = false,
  activeGrapple = false,
  activeTechnique = false,
  movementActive = false,
  enemyActionCommitted = false,
  processingEnemy = false,
  processingPlayerAI = false,
  playerAIScheduled = false,
} = {}) {
  const explicitSource = normalizeSource(source);
  if (
    explicitSource &&
    explicitSource !== "unknown" &&
    explicitSource !== "busy-state-unspecified"
  ) return explicitSource;

  if (activeGrapple) {
    if (processingPlayerAI) return "player-ai-grapple";
    if (processingEnemy) return "enemy-ai-grapple";
    return "grapple-finalizer";
  }
  if (activeAttack) {
    if (processingPlayerAI) return "player-ai-attack";
    if (processingEnemy) return "enemy-ai-attack";
    return "attack-finalizer";
  }
  if (activeTechnique) return "technique-impact-complete";
  if (movementActive) {
    if (processingPlayerAI) return "player-ai-move-finalizer";
    if (processingEnemy) return "enemy-move-finalizer";
    return "movement-finalizer";
  }
  if (processingPlayerAI || playerAIScheduled) return "player-ai-action-finalizer";
  if (processingEnemy || enemyActionCommitted) return "enemy-ai-action-finalizer";
  return "busy-state-unspecified";
}

export function formatAcceptedFinalizerSettlement({ actorName, nextName, source } = {}) {
  return `accepted finalizer refs settled actor=${actorName || "unknown"} next=${nextName || "none"} source=${resolveTurnDiagnosticSource({ source })}`;
}

export default {
  formatAcceptedFinalizerSettlement,
  resolveTurnDiagnosticSource,
};
