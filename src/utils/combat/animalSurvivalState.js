const TERMINAL_OUTCOMES = new Set(["animal-retreated", "animal-driven-off", "animal-captured"]);

export function createAnimalSurvivalRegistry() {
  return { pending: new Map(), committedTokens: new Set() };
}

export function createAnimalSurvivalAction({
  registry,
  actor,
  outcome,
  generationId,
  initiativeTurnId,
  actionToken,
  source = "animal-morale",
} = {}) {
  if (!registry?.pending || !actor?.id || !generationId || !initiativeTurnId || !actionToken) {
    return { accepted: false, reason: "animal-survival-ownership-required", events: [] };
  }
  if (!["flee", "flee-by-air", "retreat-to-altitude", "land-and-submit", "hold-position", "cower", "animal-retreated", "animal-driven-off", "animal-captured", "animal-submitted"].includes(outcome)) {
    return { accepted: false, reason: "animal-survival-outcome-invalid", events: [] };
  }
  const survivalToken = Object.freeze({
    survivalTokenId: ["animal-survival", generationId, initiativeTurnId, actionToken, actor.id, outcome].join(":"),
    actorId: actor.id,
    generationId,
    initiativeTurnId,
    actionToken,
    outcome,
    source,
  });
  if (registry.pending.has(actor.id)) return { accepted: false, reason: "animal-survival-action-already-pending", events: [] };
  registry.pending.set(actor.id, survivalToken);
  return {
    accepted: true,
    survivalToken,
    events: [{
      eventType: actor.flightProfile?.kind === "biological"
        ? "flying-animal-survival-owned"
        : "animal-survival-action-owned",
      actorId: actor.id,
      data: { ...survivalToken },
    }],
  };
}

export function commitAnimalSurvivalAction({
  registry,
  actor,
  survivalToken,
  position = actor?.position,
  staminaSpent = 0,
} = {}) {
  const authoritative = registry?.pending?.get(actor?.id);
  if (!authoritative || authoritative !== survivalToken || registry.committedTokens.has(survivalToken?.survivalTokenId)) {
    return { committed: false, reason: "animal-survival-stale-or-duplicate-token", actor, events: [] };
  }
  registry.committedTokens.add(survivalToken.survivalTokenId);
  registry.pending.delete(actor.id);
  const terminal = TERMINAL_OUTCOMES.has(survivalToken.outcome);
  const nextActor = {
    ...actor,
    position: position ? { ...position } : position,
    survivalState: {
      status: survivalToken.outcome,
      terminal,
      actionToken: survivalToken.actionToken,
      initiativeTurnId: survivalToken.initiativeTurnId,
    },
    ...(terminal ? { canAct: false, remainingActions: 0 } : {}),
    ...(survivalToken.outcome === "animal-captured" ? { isCaptured: true } : {}),
  };
  const eventType = survivalToken.outcome === "hold-position"
    ? "animal-hold-position"
    : survivalToken.outcome === "animal-retreated"
      ? "animal-retreated"
      : survivalToken.outcome === "animal-captured"
        ? "animal-captured"
        : "animal-movement-committed";
  const resolvedEventType = actor.flightProfile?.kind === "biological"
    && ["flee-by-air", "retreat-to-altitude", "animal-retreated"].includes(survivalToken.outcome)
    ? "flying-animal-retreated"
    : eventType;
  return {
    committed: true,
    actor: nextActor,
    staminaSpent,
    terminal,
    events: [{ eventType: resolvedEventType, actorId: actor.id, data: { actionToken: survivalToken.actionToken, initiativeTurnId: survivalToken.initiativeTurnId, outcome: survivalToken.outcome, staminaSpent } }],
  };
}

export function shouldDeferCombatForAnimalOutcome(registry) {
  return { defer: Boolean(registry?.pending?.size), pendingCount: registry?.pending?.size || 0 };
}

export default {
  commitAnimalSurvivalAction,
  createAnimalSurvivalAction,
  createAnimalSurvivalRegistry,
  shouldDeferCombatForAnimalOutcome,
};
