const same = (left, right) => left != null && right != null && String(left) === String(right);

export function buildStaleDamageApplicationDiagnostic({
  attackerId, targetId, executionKey, execution = null, activeActorId = null,
  activeInitiativeTurnId = null, activeExecutionKey = null, activeGeneration = null,
  activeCombatSession = null, combatActive = false, target = null, rejectionReason = null,
} = {}) {
  const generationMatches = Boolean(execution && execution.generation === activeGeneration && execution.combatSession === activeCombatSession);
  const actorTurnMatches = same(activeActorId, attackerId);
  const initiativeTurnMatches = Boolean(execution?.initiativeTurnId && same(execution.initiativeTurnId, activeInitiativeTurnId));
  const executionKeyValid = Boolean(execution && same(execution.id, executionKey));
  const attackOwnerMatches = same(activeExecutionKey, executionKey);
  const targetExists = Boolean(target);
  const targetIdentityMatches = Boolean(target && same(target.id ?? target._id, targetId));
  const reason = rejectionReason || [
    [generationMatches, "generation-mismatch"], [combatActive, "combat-inactive"],
    [actorTurnMatches, "actor-turn-mismatch"], [initiativeTurnMatches, "initiative-turn-mismatch"],
    [executionKeyValid, "execution-key-invalid"], [attackOwnerMatches, "attack-owner-mismatch"],
    [targetExists, "target-missing"], [targetIdentityMatches, "target-identity-mismatch"],
  ].find(([valid]) => !valid)?.[1] || "unknown";
  return Object.freeze({
    eventType: "stale-damage-application-rejected", attackerId: attackerId ?? null,
    targetId: targetId ?? null, executionKey: executionKey ?? null, generationMatches,
    combatActive: Boolean(combatActive), actorTurnMatches, initiativeTurnMatches,
    executionKeyValid, attackOwnerMatches, targetExists, targetIdentityMatches,
    rejectionReason: reason,
  });
}

export default buildStaleDamageApplicationDiagnostic;
