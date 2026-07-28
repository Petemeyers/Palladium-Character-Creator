import {
  DOMINANT_CONTROL_TYPES,
  DOMINANT_RESPONSE_TYPES,
  buildDominantResponseOpportunity,
  consumeDominantOpening,
  createDominantControlState,
  getLegalControlledDisengagementDestinations,
  transitionDominantResponse,
} from "./dominantOpeningResolution.js";

export function createPhase4ADominantScenario({
  response = DOMINANT_RESPONSE_TYPES.MAINTAIN_BIND,
  defenseType = "weapon",
  combatEnds = false,
} = {}) {
  const reactor = { id: "knight-a", name: "Knight", currentHP: 20, remainingActions: 2 };
  const target = { id: "knight-b", name: "Enemy Knight", currentHP: 20, remainingActions: 2 };
  const sword = { id: "long-sword-a", name: "Long Sword", type: "melee" };
  const targetSword = { id: "long-sword-b", name: "Long Sword", type: "melee" };
  const shield = { id: "heater-shield", name: "Heater Shield", type: "shield" };
  const exchange = Object.freeze({
    exchangeId: "browser-source-attack:defense",
    attackExecutionKey: "browser-source-attack",
    generationId: 7,
    round: 3,
    attackerId: target.id,
    defenderId: reactor.id,
    tempoOwnerId: reactor.id,
    openingAgainstId: target.id,
    openingLevel: 2,
    parryOutcome: "parry_dominant",
    reactionDepth: 0,
    createdAtActionSequence: 1,
    consumed: false,
  });
  const legalSteps = getLegalControlledDisengagementDestinations({
    origin: { x: 1, y: 1 },
    target: { x: 2, y: 1 },
    adjacentHexes: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }],
    isOccupied: (x, y) => x === 1 && y === 2,
  });
  const opportunity = buildDominantResponseOpportunity({
    exchange, reactor, target, defenseType,
    defenseOutcome: "parry_dominant",
    combatActive: true, generationId: 7, round: 3,
    initiativeTurnId: "browser-turn-3",
    sourceAttackExecutionKey: exchange.attackExecutionKey,
    sourceAttackType: "melee", hostile: true, engaged: true,
    parryingWeapon: defenseType === "shield" ? shield : sword,
    attackingWeapon: targetSword,
    shield,
    riposteEligible: true,
    legalRiposteAttack: sword,
    riposteStaminaCost: 2,
    grappleLegal: true,
    grappleStaminaCost: 1,
    currentStamina: 5,
    legalDisengagementDestinations: legalSteps,
  });
  const opportunities = new Map([[opportunity.opportunityId, opportunity]]);
  const exchanges = new Map([["knight-a::knight-b", exchange]]);
  const events = [{
    eventType: "dominant-response-opportunity-created",
    reactionDepth: 1,
    legalResponses: opportunity.legalResponses,
  }, {
    eventType: "dominant-response-selected",
    response,
  }];
  const consumed = consumeDominantOpening({
    opportunityRegistry: opportunities,
    exchangeRegistry: exchanges,
    opportunity,
    selectedResponse: response,
    generationId: 7,
    round: 3,
    reactorId: reactor.id,
    targetId: target.id,
  });
  events.push({
    eventType: response === "decline" ? "dominant-response-declined" : "dominant-opening-consumed",
    response,
  });
  let control = null;
  let movement = null;
  let grapple = null;
  if (response !== "decline") {
    transitionDominantResponse(opportunities, opportunity.opportunityId, "resolving");
    if (response === "maintain_bind") {
      control = createDominantControlState({
        type: DOMINANT_CONTROL_TYPES.BIND, opportunity,
        controllerId: reactor.id, controlledActorId: target.id,
        controllerWeaponId: sword.id, controlledWeaponId: targetSword.id,
      });
    } else if (response === "weapon_displacement") {
      control = createDominantControlState({
        type: DOMINANT_CONTROL_TYPES.DISPLACEMENT, opportunity,
        controllerId: reactor.id, controlledActorId: target.id,
        controlledWeaponId: targetSword.id,
      });
    } else if (response === "shield_pressure") {
      control = createDominantControlState({
        type: DOMINANT_CONTROL_TYPES.SHIELD_PRESSURE, opportunity,
        controllerId: reactor.id, controlledActorId: target.id,
      });
    } else if (response === "controlled_disengage") {
      movement = {
        from: { x: 1, y: 1 },
        to: legalSteps[0],
        hexesMoved: 1,
        initiativeChanged: false,
        sourceOpportunityAttack: false,
      };
    } else if (response === "grapple_entry") {
      grapple = {
        canonicalAdmission: true,
        opposedRoll: true,
        reactionDepth: 1,
        ordinaryActionsSpent: 0,
        staminaSpent: 1,
        counterResponseCount: 0,
      };
    }
    transitionDominantResponse(opportunities, opportunity.opportunityId, "resolved");
    events.push({ eventType: "dominant-response-resolved", response });
  }
  return {
    response,
    opportunity,
    consumed: consumed.accepted,
    sourceExchangeConsumed: exchanges.get("knight-a::knight-b").consumed,
    reactionDepth: 1,
    sourceFinalizerCount: 1,
    sourceResumed: !combatEnds,
    ordinaryActionsBefore: reactor.remainingActions,
    ordinaryActionsAfter: reactor.remainingActions,
    control,
    movement,
    grapple,
    events,
  };
}
