import {
  DEFENSE_OUTCOMES,
  buildExchangeState,
  classifyParryOutcome,
  getExchangePairKey,
} from "./defenseOutcome.js";
import {
  REACTION_STATUSES,
  buildRiposteAttackRequest,
  buildRiposteOpportunity,
  canOfferRiposte,
  consumeRiposteOpening,
  transitionReaction,
} from "./reactionResolution.js";

const sword = Object.freeze({
  id: "long-sword",
  weaponId: "long-sword",
  name: "Long Sword",
  type: "melee",
  reachFeet: 5,
  damage: "1d8",
});

export function createPhase3RiposteScenario({
  openingLevel = 1,
  decision = "accept",
  targetDefends = false,
  reactionEndsCombat = false,
  largerBattle = false,
  stamina = 12,
  staminaCost = 4,
} = {}) {
  const attacker = { id: "knight-a", name: "Knight A", currentHP: 20, remainingActions: 2 };
  const defender = { id: "knight-b", name: "Knight B", currentHP: 20, remainingActions: 1 };
  const thirdFighter = { id: "knight-c", name: "Knight C", currentHP: 20, remainingActions: 2 };
  const initiative = largerBattle ? [attacker.id, defender.id, thirdFighter.id] : [attacker.id, defender.id];
  const turnIndex = 0;
  const result = classifyParryOutcome({
    attackTotal: 15,
    defenseTotal: openingLevel >= 2 ? 25 : 20,
    attackerId: attacker.id,
    defenderId: defender.id,
    defenseType: "weapon",
  });
  const exchange = buildExchangeState({
    result,
    generationId: "phase3-browser",
    round: 2,
    actionSequence: 1,
    attackExecutionKey: "attack:source",
    attackerId: attacker.id,
    defenderId: defender.id,
  });
  const eligibility = canOfferRiposte({
    exchange,
    generationId: "phase3-browser",
    round: 2,
    sourceAttackExecutionKey: "attack:source",
    reactor: defender,
    target: attacker,
    defenseType: "weapon",
    attackType: "melee",
    reactionDepth: 0,
    legalAttack: sword,
    distanceFeet: 5,
    staminaCost,
    currentStamina: stamina,
    combatActive: true,
    hostile: true,
  });
  if (!eligibility.eligible) {
    return {
      eligibility,
      events: [{ eventType: "reaction_declined", reason: eligibility.reason }],
      initiativeBefore: initiative,
      initiativeAfter: [...initiative],
      turnIndexBefore: turnIndex,
      turnIndexAfter: turnIndex,
      immediateAttackCount: 0,
    };
  }
  const opportunity = buildRiposteOpportunity({
    exchange,
    reactor: defender,
    target: attacker,
    defenseType: "weapon",
    attack: sword,
    staminaCost,
  });
  const exchangeRegistry = new Map([[getExchangePairKey(attacker.id, defender.id), exchange]]);
  const reactionRegistry = new Map([[opportunity.reactionId, opportunity]]);
  const events = [{ eventType: "reaction_opportunity_created", reactionId: opportunity.reactionId }];
  if (decision !== "accept") {
    transitionReaction(reactionRegistry, opportunity.reactionId, REACTION_STATUSES.DECLINED, { reason: "player_declined" });
    events.push({ eventType: "reaction_declined", reactionId: opportunity.reactionId });
    return {
      eligibility,
      opportunity,
      events,
      initiativeBefore: initiative,
      initiativeAfter: [...initiative],
      turnIndexBefore: turnIndex,
      turnIndexAfter: turnIndex,
      immediateAttackCount: 0,
      sourceFinalizerCount: 1,
      reactionFinalizerCount: 0,
    };
  }
  const consumption = consumeRiposteOpening({
    exchangeRegistry,
    reactionRegistry,
    opportunity,
    generationId: "phase3-browser",
    round: 2,
    sourceAttackExecutionKey: "attack:source",
    reactorId: defender.id,
    targetId: attacker.id,
  });
  const attackExecutionKey = "attack:riposte";
  const request = buildRiposteAttackRequest({ opportunity: consumption.opportunity, attackExecutionKey });
  transitionReaction(reactionRegistry, opportunity.reactionId, REACTION_STATUSES.RESOLVING, { attackExecutionKey });
  events.push({ eventType: "reaction_consumed", reactionId: opportunity.reactionId });
  events.push({
    eventType: "reaction_attack_resolved",
    defended: targetDefends,
    enteredImpact: !targetDefends,
    armorContact: !targetDefends,
    damageApplied: !targetDefends,
  });
  transitionReaction(reactionRegistry, opportunity.reactionId, REACTION_STATUSES.RESOLVED, {
    outcome: targetDefends ? "defended" : reactionEndsCombat ? "combat-ended" : "impact-resolved",
  });
  events.push({ eventType: "reaction_resolved", reactionId: opportunity.reactionId });
  return {
    eligibility,
    opportunity,
    request,
    events,
    initiativeBefore: initiative,
    initiativeAfter: [...initiative],
    turnIndexBefore: turnIndex,
    turnIndexAfter: turnIndex,
    defenderActionsBeforeRiposte: defender.remainingActions,
    defenderActionsAfterRiposte: defender.remainingActions,
    staminaBeforeRiposte: stamina,
    staminaAfterRiposte: stamina - staminaCost,
    immediateAttackCount: 1,
    counterRiposteCount: 0,
    maximumReactionDepth: request.reactionDepth,
    sourceFinalizerCount: 1,
    reactionFinalizerCount: 1,
    ordinaryTurnResumed: !reactionEndsCombat,
    combatEnded: reactionEndsCombat,
    nextFighterId: reactionEndsCombat ? null : largerBattle ? thirdFighter.id : defender.id,
    defenseOutcome: openingLevel >= 2 ? DEFENSE_OUTCOMES.DOMINANT : DEFENSE_OUTCOMES.ADVANTAGE,
  };
}
