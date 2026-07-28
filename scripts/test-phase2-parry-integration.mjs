import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFENSE_OUTCOMES,
  clearExchangeStatesForActor,
  clearInvalidExchangeStates,
  resolveCanonicalDefenseExchange,
} from "../src/utils/combat/defenseOutcome.js";

const combatPageSource = fs.readFileSync(
  new URL("../src/pages/CombatPage.jsx", import.meta.url),
  "utf8",
);

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};

const fighters = {
  attacker: { id: "attacker", name: "Attacker", hp: 20, remainingActions: 2, stamina: 12 },
  defender: { id: "defender", name: "Defender", hp: 20, remainingActions: 2, stamina: 12 },
};

const resolve = ({
  defenseTotal = 20,
  defenseType = "weapon",
  attackType = "melee",
  isProjectile = false,
  canonicalSuccess = defenseTotal >= 15,
  registry = new Map(),
  currentExecutionKey = "attack:1",
  currentRound = 1,
} = {}) => resolveCanonicalDefenseExchange({
  registry,
  admission: {
    combatActive: true,
    expectedGenerationId: 8,
    currentGenerationId: 8,
    expectedRound: 1,
    currentRound,
    expectedExecutionKey: "attack:1",
    currentExecutionKey,
    attacker: fighters.attacker,
    defender: fighters.defender,
  },
  attackTotal: 15,
  defenseTotal,
  attackNaturalRoll: 10,
  defenseNaturalRoll: 12,
  canonicalSuccess,
  attackType,
  defenseType,
  isProjectile,
  actionSequence: 1,
  attackerName: "Attacker",
  defenderName: "Defender",
});

test("ordinary player weapon parry uses canonical exchange entry", () => {
  const resolution = resolve({ defenseTotal: 18 });
  assert.equal(resolution.accepted, true);
  assert.equal(resolution.result.outcome, DEFENSE_OUTCOMES.NEUTRAL);
});

test("enemy AI weapon parry uses the same canonical entry", () => {
  assert.match(combatPageSource, /resolveCanonicalDefenseExchange\(\{/);
  assert.doesNotMatch(combatPageSource, /classifyParryOutcome\(\{/);
});

test("automatic parry records the final defense total", () => {
  const callSites = combatPageSource.match(/recordCanonicalDefenseResolution\(\{/g) || [];
  assert.equal(callSites.length, 2);
  assert.match(combatPageSource, /resolvedDefenseType: "Block",\s+canonicalSuccess: defenseRoll >= attackRoll/);
});

test("shield defense shares bands but uses shield-safe narration", () => {
  const resolution = resolve({ defenseTotal: 25, defenseType: "shield" });
  assert.equal(resolution.result.outcome, DEFENSE_OUTCOMES.DOMINANT);
  assert.match(resolution.playerMessage, /drives the attack offline/);
});

test("failed parry retains attack impact eligibility", () => {
  const resolution = resolve({ defenseTotal: 14 });
  const defenseSuccess = resolution.result.success;
  const attackTotal = resolution.result.attackTotal;
  const guardRating = 10;
  const didHit = attackTotal >= guardRating && !defenseSuccess;
  assert.equal(didHit, true);
  assert.match(combatPageSource, /&& !defenseSuccess/);
  assert.match(combatPageSource, /resolveArmorContact\(/);
});

test("advantageous parry records tempo without executing an attack", () => {
  const before = structuredClone(fighters);
  const resolution = resolve({ defenseTotal: 20 });
  assert.equal(resolution.exchange.tempoOwnerId, "defender");
  assert.equal(resolution.exchange.openingLevel, 1);
  assert.deepEqual(fighters, before);
  assert.equal("counterattack" in resolution, false);
});

test("dominant parry records a strong opening without action restoration", () => {
  const resolution = resolve({ defenseTotal: 25 });
  assert.equal(resolution.exchange.openingLevel, 2);
  assert.equal(fighters.defender.remainingActions, 2);
  assert.equal(fighters.defender.stamina, 12);
});

test("round transition clears the opening", () => {
  const registry = new Map();
  resolve({ defenseTotal: 25, registry });
  clearInvalidExchangeStates(registry, {
    generationId: 8,
    round: 2,
    combatActive: true,
    fighters: Object.values(fighters),
  });
  assert.equal(registry.size, 0);
  assert.match(combatPageSource, /clearInvalidExchangeStates\(weaponExchangeRegistryRef\.current/);
});

test("stale callback cannot transfer tempo", () => {
  const registry = new Map();
  const resolution = resolve({ registry, currentExecutionKey: "attack:2" });
  assert.equal(resolution.accepted, false);
  assert.equal(registry.size, 0);
  assert.match(combatPageSource, /eventType: "stale-defense-resolution-blocked"/);
});

test("combat completion and movement clear exchange state", () => {
  const registry = new Map();
  resolve({ defenseTotal: 25, registry });
  assert.equal(clearExchangeStatesForActor(registry, "defender"), 1);
  resolve({ defenseTotal: 25, registry });
  clearInvalidExchangeStates(registry, {
    generationId: 8,
    round: 1,
    combatActive: false,
    fighters: Object.values(fighters),
  });
  assert.equal(registry.size, 0);
  assert.match(combatPageSource, /clearExchangeStatesForActor\(weaponExchangeRegistryRef\.current, combatantId\)/);
});

test("player log omits execution identity while developer event retains it", () => {
  const resolution = resolve({ defenseTotal: 20 });
  assert.doesNotMatch(resolution.playerMessage, /attack:1|execution/i);
  assert.equal(resolution.developerEvent.attackExecutionKey, "attack:1");
});

test("dodge and projectile defenses never create melee openings", () => {
  assert.equal(resolve({ defenseTotal: 25, defenseType: "dodge" }).result.openingLevel, 0);
  assert.equal(resolve({
    defenseTotal: 25,
    defenseType: "shield",
    attackType: "ranged",
    isProjectile: true,
  }).result.openingLevel, 0);
});

console.log(`Phase 2 parry integration tests: ${passed}/${passed} passed`);
