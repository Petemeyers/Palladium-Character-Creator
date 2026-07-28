import {
  DEFENSE_OUTCOMES,
  getExchangePairKey,
} from "./defenseOutcome.js";

export const REACTION_TYPES = Object.freeze({
  RIPOSTE: "riposte",
});

export const REACTION_STATUSES = Object.freeze({
  OFFERED: "offered",
  CONSUMED: "consumed",
  RESOLVING: "resolving",
  RESOLVED: "resolved",
  DECLINED: "declined",
  EXPIRED: "expired",
});

export const MAX_IMMEDIATE_REACTION_DEPTH = 1;

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
    reactionType: REACTION_TYPES.RIPOSTE,
    sourceExchangeId: exchange.exchangeId,
    sourceAttackExecutionKey: exchange.attackExecutionKey,
    generationId: exchange.generationId,
    round: exchange.round,
    actionSequence: exchange.createdAtActionSequence,
    reactorId: reactor.id,
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
  const consumedReaction = Object.freeze({
    ...storedReaction,
    status: REACTION_STATUSES.CONSUMED,
    consumed: true,
  });
  exchangeRegistry.set(pairKey, consumedExchange);
  reactionRegistry.set(opportunity.reactionId, consumedReaction);
  return { accepted: true, exchange: consumedExchange, opportunity: consumedReaction };
}

export function transitionReaction(reactionRegistry, reactionId, status, extra = {}) {
  if (!(reactionRegistry instanceof Map)) return { accepted: false, reason: "missing_registry" };
  const current = reactionRegistry.get(reactionId);
  if (!current) return { accepted: false, reason: "missing_reaction" };
  const allowed = {
    [REACTION_STATUSES.OFFERED]: [REACTION_STATUSES.DECLINED, REACTION_STATUSES.EXPIRED, REACTION_STATUSES.CONSUMED],
    [REACTION_STATUSES.CONSUMED]: [REACTION_STATUSES.RESOLVING, REACTION_STATUSES.EXPIRED],
    [REACTION_STATUSES.RESOLVING]: [REACTION_STATUSES.RESOLVED, REACTION_STATUSES.EXPIRED],
  };
  if (!allowed[current.status]?.includes(status)) return { accepted: false, reason: "illegal_reaction_transition", reaction: current };
  const next = Object.freeze({
    ...current,
    ...extra,
    status,
    declined: status === REACTION_STATUSES.DECLINED,
  });
  reactionRegistry.set(reactionId, next);
  return { accepted: true, reaction: next };
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
  if (!combatActive) return { valid: false, reason: "combat_ended" };
  if (!opportunity || !registryRecord || opportunity.reactionId !== registryRecord.reactionId) {
    return { valid: false, reason: "missing_reaction_record" };
  }
  if (![REACTION_STATUSES.CONSUMED, REACTION_STATUSES.RESOLVING].includes(registryRecord.status)) {
    return { valid: false, reason: "reaction_not_consumed" };
  }
  if (registryRecord.generationId !== generationId || Number(registryRecord.round) !== Number(round)) {
    return { valid: false, reason: "stale_reaction" };
  }
  if (registryRecord.sourceAttackExecutionKey !== parentAttackExecutionKey) {
    return { valid: false, reason: "parent_attack_mismatch" };
  }
  if (registryRecord.reactorId !== reactorId || registryRecord.targetId !== targetId) {
    return { valid: false, reason: "participant_mismatch" };
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
