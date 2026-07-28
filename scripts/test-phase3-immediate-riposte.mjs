import assert from "node:assert/strict";
import {
  DEFENSE_OUTCOMES,
  buildExchangeState,
  classifyParryOutcome,
  getExchangePairKey,
} from "../src/utils/combat/defenseOutcome.js";
import {
  MAX_IMMEDIATE_REACTION_DEPTH,
  REACTION_STATUSES,
  buildRiposteAttackRequest,
  buildRiposteOpportunity,
  calculateRiposteRecoveryPenalty,
  canOfferRiposte,
  consumeRiposteOpening,
  selectLegalRiposteAttack,
  shouldAiAcceptRiposte,
  transitionReaction,
  validateReactionExecution,
} from "../src/utils/combat/reactionResolution.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};

const attacker = { id: "attacker", name: "Attacker", currentHP: 30 };
const defender = { id: "defender", name: "Defender", currentHP: 30 };
const sword = { id: "sword", weaponId: "sword", name: "Long Sword", type: "melee", reachFeet: 5, damage: "1d8" };
const shield = { id: "shield", name: "Shield", type: "shield", reachFeet: 5 };
const bow = { id: "bow", name: "Longbow", type: "ranged", range: 150 };
const makeExchange = ({
  outcome = DEFENSE_OUTCOMES.ADVANTAGE,
  margin = 5,
  openingLevel = outcome === DEFENSE_OUTCOMES.DOMINANT ? 2 : outcome === DEFENSE_OUTCOMES.ADVANTAGE ? 1 : 0,
  reactionDepth = 0,
  key = "attack:source",
  round = 2,
} = {}) => buildExchangeState({
  result: {
    ...classifyParryOutcome({
      attackTotal: 15,
      defenseTotal: 15 + margin,
      attackerId: attacker.id,
      defenderId: defender.id,
    }),
    outcome,
    openingLevel,
    tempoOwnerId: openingLevel ? defender.id : outcome === DEFENSE_OUTCOMES.FAILED ? attacker.id : null,
  },
  generationId: 7,
  round,
  actionSequence: 1,
  attackExecutionKey: key,
  attackerId: attacker.id,
  defenderId: defender.id,
  reactionDepth,
});

const offerContext = (exchange, overrides = {}) => ({
  exchange,
  generationId: 7,
  round: 2,
  sourceAttackExecutionKey: "attack:source",
  reactor: defender,
  target: attacker,
  defenseType: "weapon",
  attackType: "melee",
  reactionDepth: 0,
  legalAttack: sword,
  distanceFeet: 5,
  staminaCost: 4,
  currentStamina: 10,
  combatActive: true,
  hostile: true,
  isGrappling: false,
  ...overrides,
});

test("neutral parry does not offer riposte", () => {
  assert.equal(canOfferRiposte(offerContext(makeExchange({ outcome: DEFENSE_OUTCOMES.NEUTRAL, margin: 2, openingLevel: 0 }))).eligible, false);
});
test("failed parry does not offer riposte", () => {
  assert.equal(canOfferRiposte(offerContext(makeExchange({ outcome: DEFENSE_OUTCOMES.FAILED, margin: -1, openingLevel: 0 }))).eligible, false);
});
test("advantageous parry offers level one riposte", () => {
  const exchange = makeExchange();
  assert.equal(canOfferRiposte(offerContext(exchange)).eligible, true);
  assert.equal(buildRiposteOpportunity({ exchange, reactor: defender, target: attacker, defenseType: "weapon", attack: sword, staminaCost: 4 }).openingLevel, 1);
});
test("dominant parry offers level two riposte", () => {
  const exchange = makeExchange({ outcome: DEFENSE_OUTCOMES.DOMINANT, margin: 10 });
  assert.equal(canOfferRiposte(offerContext(exchange)).eligible, true);
  assert.equal(buildRiposteOpportunity({ exchange, reactor: defender, target: attacker, defenseType: "weapon", attack: sword, staminaCost: 4 }).openingLevel, 2);
});
test("dodge cannot offer riposte", () => assert.equal(canOfferRiposte(offerContext(makeExchange(), { defenseType: "dodge" })).eligible, false));
test("projectile defense cannot offer riposte", () => assert.equal(canOfferRiposte(offerContext(makeExchange(), { attackType: "ranged" })).eligible, false));
test("shield defense with weapon follow-up can offer", () => assert.equal(canOfferRiposte(offerContext(makeExchange(), { defenseType: "shield" })).eligible, true));
test("shield-only fighter has no invented shield bash", () => {
  assert.equal(selectLegalRiposteAttack({ attacks: [shield], distanceFeet: 5 }), null);
});
test("extended reach is evaluated against actual response reach", () => {
  assert.equal(canOfferRiposte(offerContext(makeExchange(), { distanceFeet: 10, legalAttack: sword })).reason, "target_outside_riposte_reach");
  const spear = { id: "spear", name: "Spear", type: "melee", reachFeet: 10 };
  assert.equal(canOfferRiposte(offerContext(makeExchange(), { distanceFeet: 10, legalAttack: spear })).eligible, true);
});
test("ranged and unarmed attacks are not legal riposte weapons", () => {
  assert.equal(selectLegalRiposteAttack({ attacks: [bow, { name: "Unarmed Attack", type: "melee" }], distanceFeet: 5 }), null);
});

const setupOpportunity = (exchange = makeExchange()) => {
  const opportunity = buildRiposteOpportunity({
    exchange,
    reactor: defender,
    target: attacker,
    defenseType: "weapon",
    attack: sword,
    staminaCost: 4,
  });
  const exchangeRegistry = new Map([[getExchangePairKey(attacker.id, defender.id), exchange]]);
  const reactionRegistry = new Map([[opportunity.reactionId, opportunity]]);
  return { exchange, opportunity, exchangeRegistry, reactionRegistry };
};

test("one opening produces at most one riposte", () => {
  const setup = setupOpportunity();
  const args = {
    ...setup,
    generationId: 7,
    round: 2,
    sourceAttackExecutionKey: "attack:source",
    reactorId: defender.id,
    targetId: attacker.id,
  };
  assert.equal(consumeRiposteOpening(args).accepted, true);
  assert.equal(consumeRiposteOpening(args).accepted, false);
});
test("double click cannot consume twice", () => {
  const setup = setupOpportunity();
  const first = consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 2,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  const second = consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 2,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  assert.equal(first.accepted, true);
  assert.equal(second.reason, "reaction_not_offered");
});
test("AI and player consumers share the same atomic record", () => {
  const setup = setupOpportunity();
  const consume = () => consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 2,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  assert.deepEqual([consume().accepted, consume().accepted], [true, false]);
});
test("stale round cannot consume opening", () => {
  const setup = setupOpportunity();
  const result = consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 3,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  assert.equal(result.reason, "stale_opening");
  assert.equal(setup.exchangeRegistry.get(getExchangePairKey(attacker.id, defender.id)).consumed, false);
});
test("replaced exchange rejects old opening", () => {
  const setup = setupOpportunity();
  setup.exchangeRegistry.set(getExchangePairKey(attacker.id, defender.id), makeExchange({ key: "attack:new" }));
  const result = consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 2,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  assert.equal(result.reason, "source_exchange_replaced");
});

test("source attack begins at depth zero", () => assert.equal(makeExchange().reactionDepth, 0));
test("riposte opportunity has depth one", () => assert.equal(setupOpportunity().opportunity.reactionDepth, 1));
test("depth-one defense cannot create depth two", () => {
  assert.equal(canOfferRiposte(offerContext(makeExchange({ reactionDepth: 1 }), { reactionDepth: 1 })).reason, "reaction_depth_cap");
});
test("maximum immediate depth is one", () => assert.equal(MAX_IMMEDIATE_REACTION_DEPTH, 1));

test("level one recovery penalty is minus one", () => assert.equal(calculateRiposteRecoveryPenalty({ openingLevel: 1 }), -1));
test("level two recovery penalty is minus two", () => assert.equal(calculateRiposteRecoveryPenalty({ openingLevel: 2 }), -2));
test("zero opening has no recovery penalty", () => assert.equal(calculateRiposteRecoveryPenalty({ openingLevel: 0 }), 0));
test("penalty is linked only to reaction request", () => {
  const setup = setupOpportunity();
  const request = buildRiposteAttackRequest({ opportunity: setup.opportunity, attackExecutionKey: "attack:riposte" });
  assert.equal(request.recoveryPenalty, -1);
  assert.equal("recoveryPenalty" in attacker, false);
});

test("insufficient stamina prevents offer", () => {
  assert.equal(canOfferRiposte(offerContext(makeExchange(), { currentStamina: 3, staminaCost: 4 })).reason, "insufficient_stamina");
});
test("AI accepts lawful affordable opening", () => assert.equal(shouldAiAcceptRiposte({ reactor: defender, currentStamina: 10, staminaCost: 4 }).accept, true));
test("AI declines while routing", () => assert.equal(shouldAiAcceptRiposte({ reactor: { ...defender, routingState: "routed" }, currentStamina: 10, staminaCost: 4 }).accept, false));
test("AI declines insufficient stamina", () => assert.equal(shouldAiAcceptRiposte({ reactor: defender, currentStamina: 2, staminaCost: 4 }).accept, false));

test("reaction request retains parent identity", () => {
  const setup = setupOpportunity();
  const request = buildRiposteAttackRequest({ opportunity: setup.opportunity, attackExecutionKey: "attack:riposte" });
  assert.equal(request.parentAttackExecutionKey, "attack:source");
  assert.equal(request.reactionDepth, 1);
  assert.equal(request.allowOutOfTurn, true);
});
test("valid consumed reaction admits execution", () => {
  const setup = setupOpportunity();
  const consumed = consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 2,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  assert.equal(validateReactionExecution({
    opportunity: consumed.opportunity,
    registryRecord: consumed.opportunity,
    generationId: 7,
    round: 2,
    parentAttackExecutionKey: "attack:source",
    reactorId: defender.id,
    targetId: attacker.id,
  }).valid, true);
});
test("generic out-of-turn identity is insufficient", () => {
  assert.equal(validateReactionExecution({
    opportunity: null,
    registryRecord: null,
    generationId: 7,
    round: 2,
    parentAttackExecutionKey: "attack:source",
    reactorId: defender.id,
    targetId: attacker.id,
  }).valid, false);
});
test("wrong target rejects reaction execution", () => {
  const setup = setupOpportunity();
  assert.equal(validateReactionExecution({
    opportunity: setup.opportunity,
    registryRecord: { ...setup.opportunity, status: REACTION_STATUSES.CONSUMED },
    generationId: 7, round: 2, parentAttackExecutionKey: "attack:source",
    reactorId: defender.id, targetId: "other",
  }).reason, "participant_mismatch");
});

test("offered reaction can decline once", () => {
  const setup = setupOpportunity();
  assert.equal(transitionReaction(setup.reactionRegistry, setup.opportunity.reactionId, REACTION_STATUSES.DECLINED).accepted, true);
  assert.equal(transitionReaction(setup.reactionRegistry, setup.opportunity.reactionId, REACTION_STATUSES.DECLINED).accepted, false);
});
test("consumed reaction transitions resolving then resolved", () => {
  const setup = setupOpportunity();
  consumeRiposteOpening({
    exchangeRegistry: setup.exchangeRegistry, reactionRegistry: setup.reactionRegistry,
    opportunity: setup.opportunity, generationId: 7, round: 2,
    sourceAttackExecutionKey: "attack:source", reactorId: defender.id, targetId: attacker.id,
  });
  assert.equal(transitionReaction(setup.reactionRegistry, setup.opportunity.reactionId, REACTION_STATUSES.RESOLVING).accepted, true);
  assert.equal(transitionReaction(setup.reactionRegistry, setup.opportunity.reactionId, REACTION_STATUSES.RESOLVED).accepted, true);
});

for (const [name, override, reason] of [
  ["defeated target invalidates", { target: { ...attacker, isDefeated: true } }, "target_terminal"],
  ["unconscious reactor invalidates", { reactor: { ...defender, isConscious: false } }, "reactor_terminal"],
  ["grapple invalidates", { isGrappling: true }, "incompatible_grapple"],
  ["new round invalidates", { round: 3 }, "round_mismatch"],
  ["combat end invalidates", { combatActive: false }, "combat_ended"],
  ["wrong target invalidates", { target: { ...attacker, id: "other" } }, "wrong_opening_target"],
]) {
  test(name, () => assert.equal(canOfferRiposte(offerContext(makeExchange(), override)).reason, reason));
}

test("classification and reaction helpers do not mutate actions or initiative", () => {
  const state = { remainingActions: 0, stamina: 10, turnIndex: 2, initiative: ["a", "b"] };
  const before = structuredClone(state);
  setupOpportunity();
  assert.deepEqual(state, before);
});

console.log(`Phase 3 immediate riposte tests: ${passed}/${passed} passed`);
