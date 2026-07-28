import assert from "node:assert/strict";
import {
  DEFENSE_OUTCOMES,
  buildDefenseResolutionEvent,
  buildExchangeState,
  calculateDefenseMargin,
  classifyParryOutcome,
  clearExchangeStatesForActor,
  clearInvalidExchangeStates,
  getDefenseOutcomeMessage,
  getExchangePairKey,
  isExchangeAdmissionCurrent,
  registerExchangeState,
} from "../src/utils/combat/defenseOutcome.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};

const classify = (defenseTotal, options = {}) => classifyParryOutcome({
  attackTotal: 15,
  defenseTotal,
  attackerId: "attacker",
  defenderId: "defender",
  ...options,
});

test("margin -1", () => assert.equal(calculateDefenseMargin({ attackTotal: 15, defenseTotal: 14 }), -1));
test("margin 0", () => assert.equal(calculateDefenseMargin({ attackTotal: 15, defenseTotal: 15 }), 0));
test("margin 4", () => assert.equal(calculateDefenseMargin({ attackTotal: 15, defenseTotal: 19 }), 4));
test("margin 5", () => assert.equal(calculateDefenseMargin({ attackTotal: 15, defenseTotal: 20 }), 5));
test("margin 9", () => assert.equal(calculateDefenseMargin({ attackTotal: 15, defenseTotal: 24 }), 9));
test("margin 10", () => assert.equal(calculateDefenseMargin({ attackTotal: 15, defenseTotal: 25 }), 10));

test("negative margin fails", () => assert.equal(classify(14).outcome, DEFENSE_OUTCOMES.FAILED));
test("zero margin is neutral", () => assert.equal(classify(15).outcome, DEFENSE_OUTCOMES.NEUTRAL));
test("margin four is neutral", () => assert.equal(classify(19).outcome, DEFENSE_OUTCOMES.NEUTRAL));
test("margin five is advantageous", () => assert.equal(classify(20).outcome, DEFENSE_OUTCOMES.ADVANTAGE));
test("margin nine is advantageous", () => assert.equal(classify(24).outcome, DEFENSE_OUTCOMES.ADVANTAGE));
test("margin ten is dominant", () => assert.equal(classify(25).outcome, DEFENSE_OUTCOMES.DOMINANT));

test("canonical failure overrides a positive modified margin", () => {
  const result = classify(25, { defenseNaturalRoll: 1, canonicalSuccess: false });
  assert.equal(result.outcome, DEFENSE_OUTCOMES.FAILED);
  assert.equal(result.success, false);
});
test("natural twenty is recorded without inventing a second critical policy", () => {
  const result = classify(15, { defenseNaturalRoll: 20, canonicalSuccess: true });
  assert.equal(result.outcome, DEFENSE_OUTCOMES.NEUTRAL);
  assert.equal(result.defenseNaturalRoll, 20);
});
test("an opt-in existing natural twenty policy may promote a successful defense", () => {
  const result = classify(15, {
    defenseNaturalRoll: 20,
    canonicalSuccess: true,
    promoteSuccessfulNaturalTwenty: true,
  });
  assert.equal(result.outcome, DEFENSE_OUTCOMES.DOMINANT);
});
test("natural values are separate from modified totals", () => {
  const result = classify(20, { attackNaturalRoll: 7, defenseNaturalRoll: 12 });
  assert.equal(result.attackTotal, 15);
  assert.equal(result.defenseTotal, 20);
  assert.equal(result.attackNaturalRoll, 7);
  assert.equal(result.defenseNaturalRoll, 12);
});

test("failed parry leaves tempo with attacker", () => {
  const result = classify(14);
  assert.equal(result.tempoOwnerId, "attacker");
  assert.equal(result.openingLevel, 0);
});
test("neutral parry neutralizes tempo", () => {
  const result = classify(17);
  assert.equal(result.tempoOwnerId, null);
  assert.equal(result.openingLevel, 0);
});
test("advantageous weapon parry transfers tempo", () => {
  const result = classify(20);
  assert.equal(result.tempoOwnerId, "defender");
  assert.equal(result.openingLevel, 1);
});
test("dominant weapon parry records a strong opening", () => {
  const result = classify(25);
  assert.equal(result.tempoOwnerId, "defender");
  assert.equal(result.openingLevel, 2);
});
test("classification has no action, turn, attack, or stamina mutations", () => {
  const before = { actions: 2, stamina: 11, turnIndex: 3, initiative: ["a", "b"] };
  classify(25);
  assert.deepEqual(before, { actions: 2, stamina: 11, turnIndex: 3, initiative: ["a", "b"] });
});

test("dodge does not create weapon-control tempo", () => {
  const result = classify(25, { defenseType: "dodge" });
  assert.equal(result.tempoTransfer, false);
  assert.equal(result.openingLevel, 0);
});
test("projectile defense does not create melee tempo", () => {
  const result = classify(25, { attackType: "ranged", isProjectile: true });
  assert.equal(result.tempoTransfer, false);
});
test("extended-reach melee remains tempo eligible", () => {
  const result = classify(25, { attackType: "melee", isProjectile: false });
  assert.equal(result.tempoTransfer, true);
});
test("active grapple suppresses weapon exchange tempo", () => {
  const result = classify(25, { isGrappling: true });
  assert.equal(result.tempoTransfer, false);
});

const makeExchange = (overrides = {}) => {
  const result = overrides.result || classify(20);
  return buildExchangeState({
    result,
    generationId: overrides.generationId ?? 9,
    round: overrides.round ?? 3,
    actionSequence: overrides.actionSequence ?? 2,
    attackExecutionKey: overrides.attackExecutionKey ?? "attack:key",
    attackerId: overrides.attackerId ?? "attacker",
    defenderId: overrides.defenderId ?? "defender",
  });
};

test("exchange carries canonical attack identity", () => {
  const exchange = makeExchange();
  assert.equal(exchange.exchangeId, "attack:key:defense");
  assert.equal(exchange.generationId, 9);
  assert.equal(exchange.round, 3);
  assert.equal(exchange.createdAtActionSequence, 2);
  assert.equal(exchange.reactionDepth, 0);
  assert.equal(exchange.consumed, false);
  assert.equal(Object.isFrozen(exchange), true);
});
test("newer exchange replaces the same participant pair", () => {
  const registry = new Map();
  registerExchangeState(registry, makeExchange());
  registerExchangeState(registry, makeExchange({ attackExecutionKey: "new:key", result: classify(25) }));
  assert.equal(registry.size, 1);
  assert.equal(registry.get(getExchangePairKey("attacker", "defender")).attackExecutionKey, "new:key");
});
test("target change can conservatively clear actor exchanges", () => {
  const registry = new Map();
  registerExchangeState(registry, makeExchange());
  assert.equal(clearExchangeStatesForActor(registry, "defender"), 1);
  assert.equal(registry.size, 0);
});
test("new round clears old tempo", () => {
  const registry = new Map([[getExchangePairKey("attacker", "defender"), makeExchange()]]);
  const cleared = clearInvalidExchangeStates(registry, {
    generationId: 9,
    round: 4,
    combatActive: true,
    fighters: [{ id: "attacker", hp: 10 }, { id: "defender", hp: 10 }],
  });
  assert.equal(cleared, 1);
});
test("combat completion clears exchange state", () => {
  const registry = new Map([[getExchangePairKey("attacker", "defender"), makeExchange()]]);
  clearInvalidExchangeStates(registry, {
    generationId: 9,
    round: 3,
    combatActive: false,
    fighters: [],
  });
  assert.equal(registry.size, 0);
});
test("defeat or unconsciousness clears exchange state", () => {
  const registry = new Map([[getExchangePairKey("attacker", "defender"), makeExchange()]]);
  clearInvalidExchangeStates(registry, {
    generationId: 9,
    round: 3,
    combatActive: true,
    fighters: [{ id: "attacker", hp: 10 }, { id: "defender", hp: 10, isConscious: false }],
  });
  assert.equal(registry.size, 0);
});
test("entering grapple clears weapon exchange state", () => {
  const registry = new Map([[getExchangePairKey("attacker", "defender"), makeExchange()]]);
  clearInvalidExchangeStates(registry, {
    generationId: 9,
    round: 3,
    combatActive: true,
    fighters: [
      { id: "attacker", hp: 10, grappleState: { opponent: "defender" } },
      { id: "defender", hp: 10 },
    ],
  });
  assert.equal(registry.size, 0);
});
test("knockdown clears weapon exchange state", () => {
  const registry = new Map([[getExchangePairKey("attacker", "defender"), makeExchange()]]);
  clearInvalidExchangeStates(registry, {
    generationId: 9,
    round: 3,
    combatActive: true,
    fighters: [{ id: "attacker", hp: 10 }, { id: "defender", hp: 10, knockedDown: true }],
  });
  assert.equal(registry.size, 0);
});

const admission = {
  combatActive: true,
  expectedGenerationId: 4,
  currentGenerationId: 4,
  expectedRound: 2,
  currentRound: 2,
  expectedExecutionKey: "live",
  currentExecutionKey: "live",
  attacker: { id: "attacker", hp: 10 },
  defender: { id: "defender", hp: 10 },
};
test("current defense admission may transfer tempo", () => assert.equal(isExchangeAdmissionCurrent(admission), true));
test("stale execution cannot transfer tempo", () => assert.equal(isExchangeAdmissionCurrent({ ...admission, currentExecutionKey: "newer" }), false));
test("previous-round callback cannot transfer tempo", () => assert.equal(isExchangeAdmissionCurrent({ ...admission, currentRound: 3 }), false));
test("defeated defender cannot receive tempo", () => assert.equal(isExchangeAdmissionCurrent({ ...admission, defender: { id: "defender", hp: 10, isDefeated: true } }), false));
test("removed attacker cannot remain opening target", () => assert.equal(isExchangeAdmissionCurrent({ ...admission, attacker: null }), false));

test("shield uses shield-safe advantageous wording", () => {
  const message = getDefenseOutcomeMessage({
    defenderName: "Knight",
    attackerName: "Raider",
    defenseType: "shield",
    result: classify(20, { defenseType: "shield" }),
  });
  assert.match(message, /blow aside/);
  assert.doesNotMatch(message, /blade|bind/);
});
test("player wording contains no execution key", () => {
  const message = getDefenseOutcomeMessage({
    defenderName: "Knight",
    attackerName: "Raider",
    result: classify(25),
  });
  assert.doesNotMatch(message, /attack:key|execution/i);
});
test("developer event contains exact opposed totals and outcome", () => {
  const result = classify(20);
  const exchange = makeExchange({ result });
  const event = buildDefenseResolutionEvent({
    result,
    attackExecutionKey: "attack:key",
    attackerId: "attacker",
    defenderId: "defender",
    defenseType: "weapon",
    exchange,
  });
  assert.deepEqual(
    [event.attackTotal, event.defenseTotal, event.defenseMargin, event.outcome],
    [15, 20, 5, DEFENSE_OUTCOMES.ADVANTAGE],
  );
});

console.log(`Phase 2 parry margin and tempo tests: ${passed}/${passed} passed`);
