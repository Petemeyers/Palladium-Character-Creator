import {
  DEFENSE_OUTCOMES,
  getExchangePairKey,
} from "./defenseOutcome.js";

export const REACTION_TYPES = Object.freeze({
  RIPOSTE: "riposte",
});

export const REACTION_STATUSES = Object.freeze({
  OFFERED: "offered",
  ADMITTED: "admitted",
  CONSUMED: "consumed",
  RESOLVING: "resolving",
  RESOLVED: "resolved",
  DECLINED: "declined",
  EXPIRED: "expired",
  INVALIDATED: "invalidated",
  REJECTED: "rejected",
});

export const MAX_IMMEDIATE_REACTION_DEPTH = 1;

export const CANONICAL_REACTION_TERMINAL_STATUSES = Object.freeze([
  REACTION_STATUSES.RESOLVED,
  REACTION_STATUSES.DECLINED,
  REACTION_STATUSES.EXPIRED,
  REACTION_STATUSES.INVALIDATED,
  REACTION_STATUSES.REJECTED,
]);

const CANONICAL_REACTION_TRANSITIONS = Object.freeze({
  [REACTION_STATUSES.OFFERED]: Object.freeze([
    REACTION_STATUSES.ADMITTED,
    REACTION_STATUSES.CONSUMED,
    REACTION_STATUSES.DECLINED,
    REACTION_STATUSES.EXPIRED,
    REACTION_STATUSES.INVALIDATED,
    REACTION_STATUSES.REJECTED,
  ]),
  [REACTION_STATUSES.ADMITTED]: Object.freeze([
    REACTION_STATUSES.CONSUMED,
    REACTION_STATUSES.DECLINED,
    REACTION_STATUSES.EXPIRED,
    REACTION_STATUSES.INVALIDATED,
    REACTION_STATUSES.REJECTED,
  ]),
  [REACTION_STATUSES.CONSUMED]: Object.freeze([
    REACTION_STATUSES.RESOLVING,
    REACTION_STATUSES.EXPIRED,
    REACTION_STATUSES.INVALIDATED,
    REACTION_STATUSES.REJECTED,
  ]),
  [REACTION_STATUSES.RESOLVING]: Object.freeze([
    REACTION_STATUSES.RESOLVED,
    REACTION_STATUSES.DECLINED,
    REACTION_STATUSES.EXPIRED,
    REACTION_STATUSES.INVALIDATED,
    REACTION_STATUSES.REJECTED,
  ]),
});

export function isCanonicalReactionTerminal(record) {
  return CANONICAL_REACTION_TERMINAL_STATUSES.includes(record?.status || record?.state);
}

export function buildCanonicalReactionLifecycleRecord({
  opportunityId,
  reactionId = opportunityId,
  triggerType,
  sourceExecutionId,
  sourceExecutionKey = sourceExecutionId,
  generationId,
  combatSession = generationId,
  actorId,
  reactorId = actorId,
  targetId,
  depth = 1,
  legalResponses = [],
  selectedResponse = null,
  status = REACTION_STATUSES.OFFERED,
  terminalReason = null,
  mode = "canonical",
  metadata = {},
} = {}) {
  const id = String(reactionId || opportunityId || "");
  if (!id || !triggerType || !sourceExecutionKey || !reactorId || !targetId) {
    throw new TypeError("Canonical reaction identity, trigger, source execution, actor, and target are required");
  }
  return Object.freeze({
    ...metadata,
    opportunityId: String(opportunityId || id),
    reactionId: id,
    triggerType,
    sourceExecutionId: sourceExecutionId || sourceExecutionKey,
    sourceExecutionKey,
    generationId,
    combatSession,
    actorId: String(actorId || reactorId),
    reactorId: String(reactorId),
    targetId: String(targetId),
    depth: Number(depth),
    reactionDepth: Number(depth),
    legalResponses: Object.freeze([...new Set(legalResponses)]),
    selectedResponse,
    status,
    state: status,
    terminalReason,
    mode,
    consumed: metadata.consumed === true ||
      status === REACTION_STATUSES.CONSUMED ||
      status === REACTION_STATUSES.RESOLVING ||
      status === REACTION_STATUSES.RESOLVED,
    declined: status === REACTION_STATUSES.DECLINED,
    expired: status === REACTION_STATUSES.EXPIRED,
  });
}

export function registerCanonicalReaction(registry, record) {
  if (!(registry instanceof Map)) return { accepted: false, reason: "missing_registry" };
  const reactionId = String(record?.reactionId || record?.opportunityId || "");
  if (!reactionId) return { accepted: false, reason: "missing_reaction_identity" };
  if (registry.has(reactionId)) return { accepted: false, reason: "duplicate_reaction_opportunity", reaction: registry.get(reactionId) };
  registry.set(reactionId, record);
  return { accepted: true, reaction: record };
}

export function transitionCanonicalReaction(registry, reactionId, status, extra = {}) {
  if (!(registry instanceof Map)) return { accepted: false, reason: "missing_registry" };
  const current = registry.get(reactionId);
  if (!current) return { accepted: false, reason: "missing_reaction" };
  if (!CANONICAL_REACTION_TRANSITIONS[current.status]?.includes(status)) {
    return { accepted: false, reason: "illegal_reaction_transition", reaction: current };
  }
  const next = Object.freeze({
    ...current,
    ...extra,
    status,
    state: status,
    selectedResponse: extra.selectedResponse ?? current.selectedResponse ?? null,
    terminalReason: extra.terminalReason ??
      extra.expirationReason ??
      extra.declineReason ??
      current.terminalReason ??
      null,
    consumed: current.consumed === true ||
      status === REACTION_STATUSES.CONSUMED ||
      status === REACTION_STATUSES.RESOLVING ||
      status === REACTION_STATUSES.RESOLVED,
    declined: status === REACTION_STATUSES.DECLINED,
    expired: status === REACTION_STATUSES.EXPIRED,
  });
  registry.set(reactionId, next);
  return { accepted: true, reaction: next };
}

export function validateCanonicalReactionOwnership({
  opportunity,
  registryRecord,
  generationId,
  combatSession = generationId,
  sourceExecutionId,
  actorId,
  targetId,
  expectedStatuses = [
    REACTION_STATUSES.OFFERED,
    REACTION_STATUSES.ADMITTED,
    REACTION_STATUSES.CONSUMED,
    REACTION_STATUSES.RESOLVING,
  ],
  actorValid = true,
  targetValid = true,
  sourceRelevant = true,
  combatActive = true,
  maximumDepth = MAX_IMMEDIATE_REACTION_DEPTH,
} = {}) {
  const reject = (reason) => ({ valid: false, reason });
  if (!combatActive) return reject("combat_ended");
  if (!opportunity || !registryRecord || opportunity.reactionId !== registryRecord.reactionId) {
    return reject("missing_reaction_record");
  }
  if (!expectedStatuses.includes(registryRecord.status)) return reject("reaction_not_in_expected_state");
  if (isCanonicalReactionTerminal(registryRecord)) return reject("reaction_terminal");
  if (generationId !== undefined && registryRecord.generationId !== generationId) return reject("stale_generation");
  if (combatSession !== undefined && registryRecord.combatSession !== undefined &&
      registryRecord.combatSession !== combatSession) return reject("stale_combat_session");
  const source = registryRecord.sourceExecutionId || registryRecord.sourceExecutionKey ||
    registryRecord.sourceAttackExecutionKey;
  if (sourceExecutionId !== undefined && source !== sourceExecutionId) return reject("source_execution_mismatch");
  if (actorId !== undefined && String(registryRecord.actorId || registryRecord.reactorId) !== String(actorId)) {
    return reject("participant_mismatch");
  }
  if (targetId !== undefined && String(registryRecord.targetId) !== String(targetId)) {
    return reject("participant_mismatch");
  }
  if (!actorValid) return reject("reactor_invalid");
  if (!targetValid) return reject("target_invalid");
  if (!sourceRelevant) return reject("source_trigger_stale");
  if (Number(registryRecord.depth ?? registryRecord.reactionDepth ?? 0) > Number(maximumDepth)) {
    return reject("reaction_depth_cap");
  }
  return { valid: true, reason: "valid" };
}

const terminal = (fighter) => {
  const hp = Number(
    fighter?.currentHP ??
    fighter?.currentHp ??
    fighter?.hp ??
    Number.POSITIVE_INFINITY
  );
  const state = String(
    fighter?.condition ||
    fighter?.status ||
    fighter?.combatStatus ||
    fighter?.surrenderState ||
    "",
  ).toLowerCase();
  return (
    !fighter ||
    hp <= 0 ||
    fighter.isConscious === false ||
    fighter.conscious === false ||
    fighter.isDefeated === true ||
    fighter.defeated === true ||
    fighter.surrendered === true ||
    fighter.isProne === true ||
    fighter.knockedDown === true ||
    ["dead", "dying", "unconscious", "defeated", "surrendered", "captured", "removed"].includes(state)
  );
};

const isBasicMeleeAttack = (attack) => {
  if (!attack) return false;
  const name = String(attack.name || "").toLowerCase();
  const type = String(
    attack.attackType ||
    attack.type ||
    attack.weaponType ||
    attack.category ||
    "",
  ).toLowerCase();
  const range = Number(
    attack.rangeFeet ??
    attack.reachFeet ??
    attack.reach ??
    attack.range ??
    5
  );
  if (
    /unarmed|punch|kick/.test(name) ||
    /shield/.test(name) ||
    attack.isRanged === true ||
    attack.isThrown === true ||
    /ranged|bow|crossbow|sling|thrown|spell|psionic|siege|shield/.test(type) ||
    /bow|crossbow|sling|throw|spell|charge|sweep|grapple|disarm|pommel|half.?sword|armor.?gap/.test(name)
  ) return false;
  return attack.isMelee === true || /melee|sword|dagger|knife|axe|mace|spear|polearm|unarmed/.test(type) || range <= 15;
};

export function getRiposteReachFeet(attack = {}) {
  const value = Number(
    attack.reachFeet ??
    attack.meleeReach ??
    attack.reach ??
    attack.rangeFeet ??
    attack.range ??
    5
  );
  return Number.isFinite(value) && value > 0 ? value : 5;
}

export function selectLegalRiposteAttack({ attacks = [], distanceFeet = 0 } = {}) {
  const candidates = (Array.isArray(attacks) ? attacks : [])
    .filter(isBasicMeleeAttack)
    .filter((attack) => getRiposteReachFeet(attack) + 0.01 >= Number(distanceFeet || 0));
  return candidates[0] || null;
}

export function calculateRiposteRecoveryPenalty({ openingLevel } = {}) {
  if (Number(openingLevel) >= 2) return -2;
  if (Number(openingLevel) >= 1) return -1;
  return 0;
}

export function canOfferRiposte({
  exchange,
  generationId,
  round,
  sourceAttackExecutionKey,
  reactor,
  target,
  defenseType,
  attackType = "melee",
  reactionDepth = 0,
  legalAttack,
  distanceFeet = 0,
  staminaCost = 0,
  currentStamina = 0,
  combatActive = true,
  hostile = true,
  isGrappling = false,
} = {}) {
  const reject = (reason) => ({ eligible: false, reason });
  if (!combatActive) return reject("combat_ended");
  if (!exchange) return reject("missing_exchange");
  if (exchange.consumed) return reject("opening_consumed");
  if (![DEFENSE_OUTCOMES.ADVANTAGE, DEFENSE_OUTCOMES.DOMINANT].includes(exchange.parryOutcome)) {
    return reject("ineligible_defense_outcome");
  }
  if (exchange.openingLevel < 1 || exchange.tempoOwnerId !== reactor?.id) return reject("reactor_does_not_own_tempo");
  if (exchange.openingAgainstId !== target?.id) return reject("wrong_opening_target");
  if (exchange.generationId !== generationId) return reject("generation_mismatch");
  if (Number(exchange.round) !== Number(round)) return reject("round_mismatch");
  if (exchange.attackExecutionKey !== sourceAttackExecutionKey) return reject("source_attack_mismatch");
  if (Number(exchange.reactionDepth || 0) !== Number(reactionDepth)) return reject("reaction_depth_mismatch");
  if (Number(reactionDepth) >= MAX_IMMEDIATE_REACTION_DEPTH) return reject("reaction_depth_cap");
  if (terminal(reactor)) return reject("reactor_terminal");
  if (terminal(target)) return reject("target_terminal");
  if (!hostile) return reject("target_not_hostile");
  if (String(attackType).toLowerCase() !== "melee") return reject("source_not_melee");
  if (!["weapon", "shield"].includes(String(defenseType).toLowerCase())) return reject("defense_not_riposte_eligible");
  if (isGrappling) return reject("incompatible_grapple");
  if (!legalAttack) return reject("no_legal_melee_attack");
  if (getRiposteReachFeet(legalAttack) + 0.01 < Number(distanceFeet || 0)) {
    return reject("target_outside_riposte_reach");
  }
  if (Number(currentStamina) < Number(staminaCost)) return reject("insufficient_stamina");
  return { eligible: true, reason: "eligible" };
}

export function buildRiposteOpportunity({
  exchange,
  reactor,
  target,
  defenseType,
  attack,
  staminaCost,
} = {}) {
  if (!exchange || !reactor?.id || !target?.id || !attack) {
    throw new TypeError("A canonical exchange, participants, and legal attack are required");
  }
  return Object.freeze({
    reactionId: `${exchange.exchangeId}:riposte`,
    opportunityId: `${exchange.exchangeId}:riposte`,
    reactionType: REACTION_TYPES.RIPOSTE,
    triggerType: "advantageous-parry",
    sourceExchangeId: exchange.exchangeId,
    sourceAttackExecutionKey: exchange.attackExecutionKey,
    sourceExecutionId: exchange.attackExecutionKey,
    sourceExecutionKey: exchange.attackExecutionKey,
    generationId: exchange.generationId,
    combatSession: exchange.generationId,
    round: exchange.round,
    actionSequence: exchange.createdAtActionSequence,
    reactorId: reactor.id,
    actorId: reactor.id,
    targetId: target.id,
    openingLevel: exchange.openingLevel,
    defenseOutcome: exchange.parryOutcome,
    defenseType,
    attack,
    weaponId: attack.weaponId || attack.id || attack.name,
    weaponName: attack.name,
    staminaCost: Math.max(0, Number(staminaCost) || 0),
    recoveryPenalty: calculateRiposteRecoveryPenalty(exchange),
    status: REACTION_STATUSES.OFFERED,
    state: REACTION_STATUSES.OFFERED,
    legalResponses: Object.freeze([REACTION_TYPES.RIPOSTE, "decline"]),
    selectedResponse: null,
    terminalReason: null,
    depth: 1,
    reactionDepth: 1,
    createdFromParry: true,
    consumesOpening: true,
    expiresOnTurnAdvance: true,
    consumed: false,
    declined: false,
  });
}

export function consumeRiposteOpening({
  exchangeRegistry,
  reactionRegistry,
  opportunity,
  generationId,
  round,
  sourceAttackExecutionKey,
  reactorId,
  targetId,
} = {}) {
  const reject = (reason) => ({ accepted: false, reason });
  if (!(exchangeRegistry instanceof Map) || !(reactionRegistry instanceof Map)) return reject("missing_registry");
  const storedReaction = reactionRegistry.get(opportunity?.reactionId);
  if (!storedReaction || storedReaction.status !== REACTION_STATUSES.OFFERED || storedReaction.consumed) {
    return reject("reaction_not_offered");
  }
  const pairKey = getExchangePairKey(reactorId, targetId);
  const exchange = exchangeRegistry.get(pairKey);
  if (!exchange || exchange.exchangeId !== opportunity.sourceExchangeId) return reject("source_exchange_replaced");
  if (exchange.consumed) return reject("opening_already_consumed");
  if (exchange.generationId !== generationId || Number(exchange.round) !== Number(round)) return reject("stale_opening");
  if (exchange.attackExecutionKey !== sourceAttackExecutionKey) return reject("source_attack_mismatch");
  if (opportunity.reactorId !== reactorId || opportunity.targetId !== targetId) return reject("participant_mismatch");
  if (opportunity.reactionDepth !== 1) return reject("illegal_reaction_depth");

  const consumedExchange = Object.freeze({ ...exchange, consumed: true });
  const consumedTransition = transitionCanonicalReaction(
    reactionRegistry,
    opportunity.reactionId,
    REACTION_STATUSES.CONSUMED,
    { selectedResponse: opportunity.selectedResponse || REACTION_TYPES.RIPOSTE },
  );
  if (!consumedTransition.accepted) return reject(consumedTransition.reason);
  const consumedReaction = consumedTransition.reaction;
  exchangeRegistry.set(pairKey, consumedExchange);
  return { accepted: true, exchange: consumedExchange, opportunity: consumedReaction };
}

export function transitionReaction(reactionRegistry, reactionId, status, extra = {}) {
  return transitionCanonicalReaction(reactionRegistry, reactionId, status, extra);
}

export function validateReactionExecution({
  opportunity,
  registryRecord,
  generationId,
  round,
  parentAttackExecutionKey,
  reactorId,
  targetId,
  combatActive = true,
} = {}) {
  const ownership = validateCanonicalReactionOwnership({
    opportunity,
    registryRecord,
    generationId,
    combatSession: generationId,
    sourceExecutionId: parentAttackExecutionKey,
    actorId: reactorId,
    targetId,
    expectedStatuses: [REACTION_STATUSES.CONSUMED, REACTION_STATUSES.RESOLVING],
    combatActive,
  });
  if (!ownership.valid) {
    if (ownership.reason === "reaction_not_in_expected_state") {
      return { valid: false, reason: "reaction_not_consumed" };
    }
    if (ownership.reason === "stale_generation" || ownership.reason === "stale_combat_session") {
      return { valid: false, reason: "stale_reaction" };
    }
    if (ownership.reason === "source_execution_mismatch") {
      return { valid: false, reason: "parent_attack_mismatch" };
    }
    return ownership;
  }
  if (Number(registryRecord.round) !== Number(round)) {
    return { valid: false, reason: "stale_reaction" };
  }
  if (registryRecord.reactionDepth !== 1) return { valid: false, reason: "reaction_depth_cap" };
  return { valid: true, reason: "valid" };
}

export function buildRiposteAttackRequest({ opportunity, attackExecutionKey } = {}) {
  if (!opportunity || !attackExecutionKey) throw new TypeError("Consumed opportunity and reaction execution key are required");
  return Object.freeze({
    attackExecutionKey,
    parentAttackExecutionKey: opportunity.sourceAttackExecutionKey,
    sourceExchangeId: opportunity.sourceExchangeId,
    reactionId: opportunity.reactionId,
    reactionType: REACTION_TYPES.RIPOSTE,
    reactionDepth: 1,
    isReaction: true,
    allowOutOfTurn: true,
    reactorId: opportunity.reactorId,
    targetId: opportunity.targetId,
    recoveryPenalty: opportunity.recoveryPenalty,
  });
}

export function shouldAiAcceptRiposte({
  reactor,
  currentStamina,
  staminaCost,
  targetValid = true,
} = {}) {
  const state = String(
    reactor?.routingState ||
    reactor?.moraleState?.status ||
    reactor?.status ||
    "",
  ).toLowerCase();
  if (!targetValid) return { accept: false, reason: "target_invalid" };
  if (/rout|broken|panic|surrender|retreat|flee|passive/.test(state)) {
    return { accept: false, reason: "survival_behavior" };
  }
  if (Number(currentStamina) < Number(staminaCost)) return { accept: false, reason: "insufficient_stamina" };
  return { accept: true, reason: "lawful_opening" };
}
