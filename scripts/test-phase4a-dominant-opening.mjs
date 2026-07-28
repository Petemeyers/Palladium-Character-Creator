import assert from "node:assert/strict";
import {
  DOMINANT_CONTROL_TYPES,
  DOMINANT_OPPORTUNITY_STATUSES,
  DOMINANT_RESPONSE_TYPES,
  buildDominantResponseOpportunity,
  chooseDominantOpeningResponse,
  claimDominantControlModifier,
  consumeDominantOpening,
  createDominantControlState,
  expireDominantControls,
  getLegalControlledDisengagementDestinations,
  getLegalDominantResponses,
  resolveDominantResponse,
  transitionDominantResponse,
  validateDominantResponse,
} from "../src/utils/combat/dominantOpeningResolution.js";

let assertions = 0;
const check = (value, expected, message) => {
  assert.deepEqual(value, expected, message);
  assertions += 1;
};
const yes = (value, message) => {
  assert.ok(value, message);
  assertions += 1;
};

const reactor = { id: "knight", currentHP: 20, isConscious: true };
const target = { id: "raider", currentHP: 20, isConscious: true };
const sword = { id: "sword", name: "Long Sword", type: "melee" };
const axe = { id: "axe", name: "Heavy Axe", type: "melee" };
const shield = { id: "shield", name: "Heater Shield", type: "shield" };
const exchange = Object.freeze({
  exchangeId: "attack-1:defense",
  attackExecutionKey: "attack-1",
  generationId: 4,
  round: 2,
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
const base = {
  exchange, reactor, target, combatActive: true, generationId: 4, round: 2,
  sourceAttackExecutionKey: "attack-1", sourceAttackType: "melee", hostile: true,
  engaged: true, defenseType: "weapon", defenseOutcome: "parry_dominant",
  parryingWeapon: sword, attackingWeapon: axe, riposteEligible: true,
  grappleLegal: true, grappleStaminaCost: 1, currentStamina: 5,
  legalDisengagementDestinations: [{ x: 0, y: 1 }],
};

const advantage = getLegalDominantResponses({
  ...base,
  defenseOutcome: "parry_advantage",
  exchange: { ...exchange, parryOutcome: "parry_advantage", openingLevel: 1 },
});
check(advantage, ["riposte", "decline"], "advantage remains riposte/decline only");

const weaponLegal = getLegalDominantResponses(base);
for (const response of ["riposte", "maintain_bind", "weapon_displacement", "grapple_entry", "controlled_disengage", "decline"]) {
  yes(weaponLegal.includes(response), `dominant weapon parry offers ${response}`);
}
check(new Set(weaponLegal).size, weaponLegal.length, "responses are unique");

const shieldLegal = getLegalDominantResponses({
  ...base, defenseType: "shield", shield, parryingWeapon: shield, riposteEligible: false,
});
check(shieldLegal, ["grapple_entry", "controlled_disengage", "shield_pressure", "decline"]);
check(getLegalDominantResponses({ ...base, defenseType: "dodge", riposteEligible: false }), []);
check(getLegalDominantResponses({ ...base, sourceAttackType: "projectile" }), []);
check(getLegalDominantResponses({ ...base, round: 3 }), []);
check(getLegalDominantResponses({ ...base, isGrappling: true }), []);
check(getLegalDominantResponses({ ...base, reactor: { ...reactor, currentHP: 0 } }), []);
check(getLegalDominantResponses({ ...base, target: { ...target, isConscious: false } }), []);
check(getLegalDominantResponses({ ...base, currentStamina: 0 }).includes("grapple_entry"), false);
check(getLegalDominantResponses({ ...base, currentStamina: 0, movementStaminaCost: 1 }).includes("controlled_disengage"), false);
check(getLegalDominantResponses({ ...base, attackingWeapon: { ...axe, naturalWeapon: true } }).includes("weapon_displacement"), false);
check(getLegalDominantResponses({ ...base, parryingWeapon: { ...sword, broken: true } }).includes("maintain_bind"), false);

const opportunity = buildDominantResponseOpportunity({ ...base, initiativeTurnId: "turn-9", legalRiposteAttack: sword });
yes(Object.isFrozen(opportunity), "opportunity immutable");
check(opportunity.opportunityType, "dominant_opening");
check(opportunity.reactionDepth, 1);
check(opportunity.status, "offered");
check(opportunity.attack, sword);
check(opportunity.parryingWeaponId, "sword");
check(opportunity.attackingWeaponId, "axe");
check(opportunity.initiativeTurnId, "turn-9");

const opportunities = new Map([[opportunity.opportunityId, opportunity]]);
const exchanges = new Map([["knight::raider", exchange]]);
const valid = validateDominantResponse({
  opportunity, registryRecord: opportunity, exchange,
  selectedResponse: "maintain_bind", generationId: 4, round: 2,
  reactorId: "knight", targetId: "raider",
});
check(valid.valid, true);
const consumed = consumeDominantOpening({
  opportunityRegistry: opportunities, exchangeRegistry: exchanges, opportunity,
  selectedResponse: "maintain_bind", generationId: 4, round: 2,
  reactorId: "knight", targetId: "raider",
});
check(consumed.accepted, true);
check(consumed.opportunity.status, "consumed");
check(consumed.exchange.consumed, true);
check(consumed.exchange.consumedByResponse, "maintain_bind");
check(consumeDominantOpening({
  opportunityRegistry: opportunities, exchangeRegistry: exchanges, opportunity,
  selectedResponse: "riposte", generationId: 4, round: 2,
  reactorId: "knight", targetId: "raider",
}).accepted, false, "double selection rejected");
check(transitionDominantResponse(opportunities, opportunity.opportunityId, "resolving").ok, true);
check(transitionDominantResponse(opportunities, opportunity.opportunityId, "resolved").ok, true);
check(transitionDominantResponse(opportunities, opportunity.opportunityId, "resolving").ok, false);

const bind = createDominantControlState({
  type: DOMINANT_CONTROL_TYPES.BIND, opportunity,
  controllerId: "knight", controlledActorId: "raider",
  controllerWeaponId: "sword", controlledWeaponId: "axe",
});
check(bind.attackPenalty, -2);
check(bind.defensePenalty, 0);
check(bind.status, "active");
const bindRegistry = new Map([[bind.controlId, bind]]);
check(claimDominantControlModifier({
  registry: bindRegistry, actorId: "raider", againstActorId: "other",
  weaponId: "axe", kind: "attack",
}).applied, false);
check(claimDominantControlModifier({
  registry: bindRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "dagger", kind: "attack",
}).applied, false);
const bindClaim = claimDominantControlModifier({
  registry: bindRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "axe", kind: "attack",
});
check(bindClaim.penalty, -2);
check(bindRegistry.get(bind.controlId).status, "consumed");
check(claimDominantControlModifier({
  registry: bindRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "axe", kind: "attack",
}).applied, false);

const displacement = createDominantControlState({
  type: DOMINANT_CONTROL_TYPES.DISPLACEMENT, opportunity,
  controllerId: "knight", controlledActorId: "raider", controlledWeaponId: "axe",
});
check(displacement.attackPenalty, 0);
check(displacement.defensePenalty, -2);
const displacementRegistry = new Map([[displacement.controlId, displacement]]);
check(claimDominantControlModifier({
  registry: displacementRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "axe", kind: "attack",
}).applied, false);
check(claimDominantControlModifier({
  registry: displacementRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "sword", kind: "defense",
}).applied, false);
check(claimDominantControlModifier({
  registry: displacementRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "axe", kind: "defense",
}).penalty, -2);

const pressure = createDominantControlState({
  type: DOMINANT_CONTROL_TYPES.SHIELD_PRESSURE, opportunity,
  controllerId: "knight", controlledActorId: "raider",
});
const pressureRegistry = new Map([[pressure.controlId, pressure]]);
check(claimDominantControlModifier({
  registry: pressureRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "bow", kind: "attack", isMelee: false,
}).applied, false);
check(claimDominantControlModifier({
  registry: pressureRegistry, actorId: "raider", againstActorId: "knight",
  weaponId: "axe", kind: "attack", isMelee: true,
}).penalty, -2);

const expiring = new Map([[bind.controlId, bind]]);
check(expireDominantControls(expiring, () => true, "participant-moved").length, 1);
check(expiring.get(bind.controlId).expirationReason, "participant-moved");
check(expireDominantControls(expiring, () => true, "round-changed").length, 0);

const legalSteps = getLegalControlledDisengagementDestinations({
  origin: { x: 0, y: 0 }, target: { x: 1, y: 0 },
  adjacentHexes: [{ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 0 }, { x: 0, y: -1 }],
  isValidPosition: (x, y) => !(x === 0 && y === -1),
  isOccupied: (x, y) => x === 0 && y === 1,
});
check(legalSteps, [{ x: -1, y: 0 }]);

check(chooseDominantOpeningResponse({
  legalResponses: weaponLegal, reactor, target, retreating: true,
}).response, "controlled_disengage");
check(chooseDominantOpeningResponse({
  legalResponses: weaponLegal, reactor, target, targetHeavilyArmored: true,
}).response, "grapple_entry");
check(chooseDominantOpeningResponse({
  legalResponses: weaponLegal, reactor, target, defensive: true,
}).response, "maintain_bind");
check(chooseDominantOpeningResponse({
  legalResponses: weaponLegal, reactor, target, targetWeaponThreat: true, affordableRiposte: false,
}).response, "weapon_displacement");
check(chooseDominantOpeningResponse({
  legalResponses: shieldLegal, reactor, target,
}).response, "shield_pressure");
check(chooseDominantOpeningResponse({
  legalResponses: weaponLegal, reactor: { ...reactor, routingState: "routed" }, target,
}).response, "decline");
check(chooseDominantOpeningResponse({
  legalResponses: weaponLegal, reactor, target, injectedResponse: "maintain_bind",
}).response, "maintain_bind");
check(resolveDominantResponse({ opportunity, selectedResponse: "maintain_bind" }).ordinaryActionCost, 0);
check(resolveDominantResponse({ opportunity, selectedResponse: "decline" }).declined, true);
check(resolveDominantResponse({ opportunity, selectedResponse: "not-real" }).resolved, false);
check(DOMINANT_OPPORTUNITY_STATUSES.RESOLVED, "resolved");

console.log(`Phase 4A dominant-opening tests passed: ${assertions}`);
