export const INITIAL_COMBAT_COORDINATES = Object.freeze({
  round: 1,
  turnCounter: 0,
  turnIndex: 0,
  initiativeIndex: 0,
  initiativeTurnId: null,
  actionSequence: 0,
});

export function buildCombatExecutionReset({
  previousGenerationId = 0,
  nextGenerationId = Number(previousGenerationId) + 1,
} = {}) {
  return Object.freeze({
    generationId: nextGenerationId,
    ...INITIAL_COMBAT_COORDINATES,
    activeAttackExecutionKey: null,
    activeGrappleExecutionKey: null,
    activeTechnique: null,
    currentTurnToken: null,
    exchangeState: null,
    reactionOpportunity: null,
    reactionExecution: null,
    pendingContinuation: null,
    pendingActionReceipt: null,
    acceptedFinalizer: null,
    processingEnemy: false,
    processingPlayerAI: false,
    attackResolving: false,
    projectileResolving: false,
    techniqueImpactResolving: false,
  });
}

export function auditCombatResetCoordinates(reset = {}) {
  const failures = [];
  if (Number(reset.round) !== 1) failures.push("round");
  if (Number(reset.turnCounter) !== 0) failures.push("turnCounter");
  if (Number(reset.turnIndex) !== 0) failures.push("turnIndex");
  if (Number(reset.initiativeIndex) !== 0) failures.push("initiativeIndex");
  if (reset.initiativeTurnId != null) failures.push("initiativeTurnId");
  if (Number(reset.actionSequence) !== 0) failures.push("actionSequence");
  return Object.freeze({
    matches: failures.length === 0,
    failures: Object.freeze(failures),
    generationId: reset.generationId,
    round: reset.round,
    turnCounter: reset.turnCounter,
    initiativeIndex: reset.initiativeIndex,
  });
}

export default buildCombatExecutionReset;
