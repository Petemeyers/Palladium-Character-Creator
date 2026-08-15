import { DEFENSE_OUTCOMES, getExchangePairKey } from "./defenseOutcome.js";
import {
  REACTION_STATUSES,
  transitionCanonicalReaction,
  validateCanonicalReactionOwnership,
} from "./reactionResolution.js";

export const DOMINANT_RESPONSE_TYPES = Object.freeze({
  RIPOSTE: "riposte",
  MAINTAIN_BIND: "maintain_bind",
  WEAPON_DISPLACEMENT: "weapon_displacement",
  GRAPPLE_ENTRY: "grapple_entry",
  CONTROLLED_DISENGAGE: "controlled_disengage",
  SHIELD_PRESSURE: "shield_pressure",
  DECLINE: "decline",
});

export const DOMINANT_OPPORTUNITY_STATUSES = Object.freeze({
  OFFERED: REACTION_STATUSES.OFFERED,
  CONSUMED: REACTION_STATUSES.CONSUMED,
  RESOLVING: REACTION_STATUSES.RESOLVING,
  RESOLVED: REACTION_STATUSES.RESOLVED,
  DECLINED: REACTION_STATUSES.DECLINED,
  EXPIRED: REACTION_STATUSES.EXPIRED,
});

export const DOMINANT_CONTROL_TYPES = Object.freeze({
  BIND: "bind_control",
  DISPLACEMENT: "weapon_displacement",
  SHIELD_PRESSURE: "shield_pressure",
});

const terminal = (fighter) => {
  const hp = Number(fighter?.currentHP ?? fighter?.currentHp ?? fighter?.hp ?? Infinity);
  const state = String(
    fighter?.condition || fighter?.status || fighter?.combatStatus || "",
  ).toLowerCase();
  return (
    !fighter ||
    hp <= 0 ||
    fighter.isConscious === false ||
    fighter.conscious === false ||
    fighter.isDefeated === true ||
    fighter.defeated === true ||
    fighter.surrendered === true ||
    ["dead", "dying", "unconscious", "defeated", "surrendered", "captured", "removed"].includes(state)
  );
};

const usable = (item) => Boolean(
  item &&
  item.disabled !== true &&
  item.broken !== true &&
  item.dropped !== true &&
  item.unavailable !== true
);

const weaponId = (weapon) => weapon?.weaponId || weapon?.profileKey || weapon?.id || weapon?.name || null;

const incompatibleAttack = (weapon = {}) => {
  const name = String(weapon.name || "").toLowerCase();
  const type = String(weapon.attackType || weapon.type || weapon.weaponType || weapon.category || "").toLowerCase();
  return (
    weapon.naturalWeapon === true ||
    weapon.isRanged === true ||
    weapon.isProjectile === true ||
    /natural|unarmed|projectile|ranged|spell|siege/.test(`${name} ${type}`)
  );
};

export function getLegalDominantResponses(context = {}) {
  const {
    exchange,
    reactor,
    target,
    defenseType,
    defenseOutcome = exchange?.parryOutcome,
    combatActive = true,
    generationId,
    round,
    sourceAttackExecutionKey,
    sourceAttackType = "melee",
    hostile = true,
    isGrappling = false,
    participantsMoved = false,
    parryingWeapon,
    attackingWeapon,
    riposteEligible = false,
    grappleLegal = false,
    grappleStaminaCost = 1,
    currentStamina = 0,
    legalDisengagementDestinations = [],
    movementStaminaCost = 0,
    shield,
    engaged = true,
  } = context;
  const sameSource = Boolean(
    exchange &&
    exchange.generationId === generationId &&
    Number(exchange.round) === Number(round) &&
    exchange.attackExecutionKey === sourceAttackExecutionKey &&
    exchange.tempoOwnerId === reactor?.id &&
    exchange.openingAgainstId === target?.id &&
    exchange.consumed !== true
  );
  if (
    !combatActive ||
    !sameSource ||
    !hostile ||
    terminal(reactor) ||
    terminal(target) ||
    !engaged ||
    String(sourceAttackType).toLowerCase() !== "melee" ||
    ![DEFENSE_OUTCOMES.ADVANTAGE, DEFENSE_OUTCOMES.DOMINANT].includes(defenseOutcome)
  ) return [];
  const weaponParry = String(defenseType).toLowerCase() === "weapon";
  const shieldParry = String(defenseType).toLowerCase() === "shield";
  if ((!weaponParry && !shieldParry) || isGrappling) return [];

  const legal = [];
  if (riposteEligible) legal.push(DOMINANT_RESPONSE_TYPES.RIPOSTE);
  if (defenseOutcome === DEFENSE_OUTCOMES.DOMINANT && !isGrappling) {
    if (
      weaponParry &&
      !participantsMoved &&
      usable(parryingWeapon) &&
      usable(attackingWeapon) &&
      !incompatibleAttack(parryingWeapon) &&
      !incompatibleAttack(attackingWeapon)
    ) {
      legal.push(DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND);
    }
    if (
      weaponParry &&
      usable(attackingWeapon) &&
      !incompatibleAttack(attackingWeapon)
    ) {
      legal.push(DOMINANT_RESPONSE_TYPES.WEAPON_DISPLACEMENT);
    }
    if (
      grappleLegal &&
      Number(currentStamina) >= Math.max(0, Number(grappleStaminaCost) || 0)
    ) {
      legal.push(DOMINANT_RESPONSE_TYPES.GRAPPLE_ENTRY);
    }
    if (
      Array.isArray(legalDisengagementDestinations) &&
      legalDisengagementDestinations.length > 0 &&
      Number(currentStamina) >= Math.max(0, Number(movementStaminaCost) || 0)
    ) {
      legal.push(DOMINANT_RESPONSE_TYPES.CONTROLLED_DISENGAGE);
    }
    if (shieldParry && usable(shield)) {
      legal.push(DOMINANT_RESPONSE_TYPES.SHIELD_PRESSURE);
    }
  }
  legal.push(DOMINANT_RESPONSE_TYPES.DECLINE);
  return [...new Set(legal)];
}

export function buildDominantResponseOpportunity(context = {}) {
  const legalResponses = getLegalDominantResponses(context);
  if (!legalResponses.length) return null;
  const exchange = context.exchange;
  const reactorId = context.reactor?.id;
  const targetId = context.target?.id;
  const opportunityId = `${exchange.exchangeId}:dominant-opening`;
  return Object.freeze({
    opportunityId,
    reactionId: opportunityId,
    opportunityType: "dominant_opening",
    reactionType: "dominant_opening",
    triggerType: "dominant-parry",
    sourceExchangeId: exchange.exchangeId,
    sourceAttackExecutionKey: exchange.attackExecutionKey,
    sourceExecutionId: exchange.attackExecutionKey,
    sourceExecutionKey: exchange.attackExecutionKey,
    parentAttackExecutionKey: exchange.attackExecutionKey,
    generationId: exchange.generationId,
    combatSession: exchange.generationId,
    round: exchange.round,
    initiativeTurnId: context.initiativeTurnId || null,
    actionSequence: exchange.createdAtActionSequence ?? context.actionSequence ?? 0,
    reactorId,
    actorId: reactorId,
    targetId,
    defenseType: context.defenseType,
    defenseOutcome: exchange.parryOutcome,
    openingLevel: 2,
    depth: 1,
    reactionDepth: 1,
    legalResponses: Object.freeze([...legalResponses]),
    responseCosts: Object.freeze({
      [DOMINANT_RESPONSE_TYPES.RIPOSTE]: Math.max(0, Number(context.riposteStaminaCost) || 0),
      [DOMINANT_RESPONSE_TYPES.GRAPPLE_ENTRY]: Math.max(0, Number(context.grappleStaminaCost) || 0),
      [DOMINANT_RESPONSE_TYPES.CONTROLLED_DISENGAGE]: Math.max(0, Number(context.movementStaminaCost) || 0),
    }),
    parryingWeaponId: weaponId(context.parryingWeapon),
    attackingWeaponId: weaponId(context.attackingWeapon),
    attack: context.legalRiposteAttack || null,
    recoveryPenalty: Number(context.recoveryPenalty ?? -2),
    selectedResponse: null,
    status: DOMINANT_OPPORTUNITY_STATUSES.OFFERED,
    state: DOMINANT_OPPORTUNITY_STATUSES.OFFERED,
    terminalReason: null,
    consumed: false,
    declined: false,
    expired: false,
  });
}

export function validateDominantResponse({
  opportunity,
  registryRecord,
  exchange,
  selectedResponse,
  generationId,
  round,
  reactorId,
  targetId,
  combatActive = true,
} = {}) {
  const reject = (reason) => ({ valid: false, reason });
  const ownership = validateCanonicalReactionOwnership({
    opportunity,
    registryRecord,
    generationId,
    combatSession: generationId,
    sourceExecutionId: opportunity?.sourceAttackExecutionKey,
    actorId: reactorId,
    targetId,
    expectedStatuses: [DOMINANT_OPPORTUNITY_STATUSES.OFFERED],
    combatActive,
  });
  if (!ownership.valid) {
    const aliases = {
      combat_ended: "combat-ended",
      missing_reaction_record: "missing-opportunity",
      reaction_not_in_expected_state: "opportunity-not-offered",
      stale_generation: "stale-opportunity",
      stale_combat_session: "stale-opportunity",
      participant_mismatch: "participant-mismatch",
      reaction_depth_cap: "reaction-depth-cap",
    };
    return reject(aliases[ownership.reason] || ownership.reason);
  }
  if (!registryRecord.legalResponses.includes(selectedResponse)) return reject("response-not-legal");
  if (Number(registryRecord.round) !== Number(round)) {
    return reject("stale-opportunity");
  }
  if (
    !exchange ||
    exchange.exchangeId !== registryRecord.sourceExchangeId ||
    exchange.attackExecutionKey !== registryRecord.sourceAttackExecutionKey ||
    exchange.consumed === true
  ) return reject("source-exchange-stale");
  if (registryRecord.reactionDepth !== 1) return reject("reaction-depth-cap");
  return { valid: true, reason: "valid" };
}

export function consumeDominantOpening({
  opportunityRegistry,
  exchangeRegistry,
  opportunity,
  selectedResponse,
  generationId,
  round,
  reactorId,
  targetId,
  combatActive = true,
} = {}) {
  const record = opportunityRegistry?.get?.(opportunity?.opportunityId);
  const pairKey = getExchangePairKey(reactorId, targetId);
  const exchange = exchangeRegistry?.get?.(pairKey);
  const validation = validateDominantResponse({
    opportunity,
    registryRecord: record,
    exchange,
    selectedResponse,
    generationId,
    round,
    reactorId,
    targetId,
    combatActive,
  });
  if (!validation.valid) return { accepted: false, reason: validation.reason };
  const consumedOpportunity = Object.freeze({
    ...record,
    selectedResponse,
    status: selectedResponse === DOMINANT_RESPONSE_TYPES.DECLINE
      ? DOMINANT_OPPORTUNITY_STATUSES.DECLINED
      : DOMINANT_OPPORTUNITY_STATUSES.CONSUMED,
    state: selectedResponse === DOMINANT_RESPONSE_TYPES.DECLINE
      ? DOMINANT_OPPORTUNITY_STATUSES.DECLINED
      : DOMINANT_OPPORTUNITY_STATUSES.CONSUMED,
    consumed: selectedResponse !== DOMINANT_RESPONSE_TYPES.DECLINE,
    declined: selectedResponse === DOMINANT_RESPONSE_TYPES.DECLINE,
  });
  const consumedExchange = Object.freeze({
    ...exchange,
    consumed: true,
    consumedByResponse: selectedResponse,
  });
  opportunityRegistry.set(record.opportunityId, consumedOpportunity);
  exchangeRegistry.set(pairKey, consumedExchange);
  return {
    accepted: true,
    reason: selectedResponse === DOMINANT_RESPONSE_TYPES.DECLINE ? "declined" : "consumed",
    opportunity: consumedOpportunity,
    exchange: consumedExchange,
  };
}

export function transitionDominantResponse(registry, opportunityId, nextStatus, patch = {}) {
  const transition = transitionCanonicalReaction(registry, opportunityId, nextStatus, patch);
  return transition.accepted
    ? { ok: true, record: transition.reaction }
    : { ok: false, reason: transition.reason, record: transition.reaction };
}

export function createDominantControlState({
  type,
  opportunity,
  controllerId,
  controlledActorId,
  controllerWeaponId = null,
  controlledWeaponId = null,
} = {}) {
  if (!Object.values(DOMINANT_CONTROL_TYPES).includes(type)) throw new TypeError("Unknown dominant control type");
  const penalty = -2;
  const id = `${opportunity.sourceExchangeId}:${type}`;
  return Object.freeze({
    controlId: id,
    bindId: type === DOMINANT_CONTROL_TYPES.BIND ? id : null,
    displacementId: type === DOMINANT_CONTROL_TYPES.DISPLACEMENT ? id : null,
    pressureId: type === DOMINANT_CONTROL_TYPES.SHIELD_PRESSURE ? id : null,
    type,
    sourceExchangeId: opportunity.sourceExchangeId,
    generationId: opportunity.generationId,
    round: opportunity.round,
    controllerId,
    controlledActorId,
    controllerWeaponId,
    controlledWeaponId,
    appliesAgainstActorId: controllerId,
    attackPenalty: type === DOMINANT_CONTROL_TYPES.DISPLACEMENT ? 0 : penalty,
    defensePenalty: type === DOMINANT_CONTROL_TYPES.DISPLACEMENT ? penalty : 0,
    status: "active",
    consumed: false,
  });
}

export function claimDominantControlModifier({
  registry,
  actorId,
  againstActorId,
  weaponId: usedWeaponId,
  kind,
  isMelee = true,
} = {}) {
  for (const [key, control] of registry?.entries?.() || []) {
    if (control.status !== "active" || control.controlledActorId !== actorId) continue;
    if (control.appliesAgainstActorId !== againstActorId || !isMelee) continue;
    if (control.controlledWeaponId && control.controlledWeaponId !== usedWeaponId) continue;
    const penalty = kind === "attack" ? Number(control.attackPenalty || 0) : Number(control.defensePenalty || 0);
    if (!penalty) continue;
    const consumed = Object.freeze({ ...control, status: "consumed", consumed: true, consumedReason: `${kind}-used` });
    registry.set(key, consumed);
    return { applied: true, penalty, control: consumed };
  }
  return { applied: false, penalty: 0, control: null };
}

export function expireDominantControls(registry, predicate, reason = "expired") {
  const expired = [];
  for (const [key, control] of registry?.entries?.() || []) {
    if (control.status !== "active" || !predicate(control)) continue;
    const next = Object.freeze({ ...control, status: "expired", expirationReason: reason });
    registry.set(key, next);
    expired.push(next);
  }
  return expired;
}

export function chooseDominantOpeningResponse({
  legalResponses = [],
  reactor = {},
  target = {},
  retreating = false,
  badlyFatigued = false,
  surrendering = false,
  targetHeavilyArmored = false,
  defensive = false,
  targetWeaponThreat = false,
  affordableRiposte = true,
  injectedResponse = null,
} = {}) {
  const legal = new Set(legalResponses);
  if (injectedResponse && legal.has(injectedResponse)) return { response: injectedResponse, reason: "injected" };
  const state = String(
    reactor.routingState || reactor.moraleState?.status || reactor.status || "",
  ).toLowerCase();
  if (/rout|broken|panic|surrender|passive/.test(state) || terminal(target)) {
    return { response: DOMINANT_RESPONSE_TYPES.DECLINE, reason: "survival-or-invalid-target" };
  }
  if (
    (retreating || badlyFatigued || surrendering) &&
    legal.has(DOMINANT_RESPONSE_TYPES.CONTROLLED_DISENGAGE)
  ) return { response: DOMINANT_RESPONSE_TYPES.CONTROLLED_DISENGAGE, reason: "survival-separation" };
  if (targetHeavilyArmored && legal.has(DOMINANT_RESPONSE_TYPES.GRAPPLE_ENTRY)) {
    return { response: DOMINANT_RESPONSE_TYPES.GRAPPLE_ENTRY, reason: "armored-target" };
  }
  if (defensive && legal.has(DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND)) {
    return { response: DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND, reason: "defensive-control" };
  }
  if (targetWeaponThreat && legal.has(DOMINANT_RESPONSE_TYPES.WEAPON_DISPLACEMENT)) {
    return { response: DOMINANT_RESPONSE_TYPES.WEAPON_DISPLACEMENT, reason: "weapon-threat" };
  }
  if (affordableRiposte && legal.has(DOMINANT_RESPONSE_TYPES.RIPOSTE)) {
    return { response: DOMINANT_RESPONSE_TYPES.RIPOSTE, reason: "lawful-riposte" };
  }
  if (legal.has(DOMINANT_RESPONSE_TYPES.SHIELD_PRESSURE)) {
    return { response: DOMINANT_RESPONSE_TYPES.SHIELD_PRESSURE, reason: "shield-control" };
  }
  if (legal.has(DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND)) {
    return { response: DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND, reason: "weapon-control" };
  }
  return { response: DOMINANT_RESPONSE_TYPES.DECLINE, reason: "no-preferred-response" };
}

export function getLegalControlledDisengagementDestinations({
  origin,
  target,
  adjacentHexes = [],
  isValidPosition = () => true,
  isOccupied = () => false,
  calculateDistance = (a, b) => Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y)),
} = {}) {
  if (!origin || !target) return [];
  const initialDistance = Number(calculateDistance(origin, target));
  return adjacentHexes.filter((hex) => (
    hex &&
    isValidPosition(hex.x, hex.y) &&
    !isOccupied(hex.x, hex.y) &&
    Number(calculateDistance(hex, target)) > initialDistance
  ));
}

export function resolveDominantResponse({ opportunity, selectedResponse } = {}) {
  if (!opportunity?.legalResponses?.includes(selectedResponse)) {
    return { resolved: false, reason: "response-not-legal" };
  }
  return {
    resolved: selectedResponse !== DOMINANT_RESPONSE_TYPES.DECLINE,
    declined: selectedResponse === DOMINANT_RESPONSE_TYPES.DECLINE,
    response: selectedResponse,
    reactionDepth: 1,
    ordinaryActionCost: 0,
  };
}
