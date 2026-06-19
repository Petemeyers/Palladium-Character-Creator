import assert from "node:assert/strict";
import {
  getAbilityModifier,
  getArmorClass,
  getConModifier,
  getDexModifier,
  getHitPoints,
  getProficiencyBonus,
  getSpeed,
  getStrModifier,
  normalize5eCombatant,
} from "../src/utils/normalize5eCombatant.js";
import * as actionEconomy from "../src/utils/actionEconomy.js";

function testLegacyAbilityMapping() {
  const normalized = normalize5eCombatant({
    PS: 16,
    PP: 14,
    PE: 12,
    IQ: 13,
    ME: 11,
    MA: 9,
    PB: 18,
  });

  assert.equal(normalized.str, 16);
  assert.equal(normalized.dex, 14);
  assert.equal(normalized.con, 12);
  assert.equal(normalized.int, 13);
  assert.equal(normalized.wis, 11);
  assert.equal(normalized.cha, 9);
  assert.equal(normalized.abilityScores.str, 16);
  assert.equal(normalized.abilityMods.str, 3);
  assert.equal(normalized.PB, 18);
}

function testModernAbilityPreference() {
  const normalized = normalize5eCombatant({
    str: 18,
    dex: 17,
    con: 16,
    int: 15,
    wis: 14,
    cha: 13,
    PS: 8,
    PP: 8,
    PE: 8,
    IQ: 8,
    ME: 8,
    MA: 8,
  });

  assert.equal(normalized.str, 18);
  assert.equal(normalized.dex, 17);
  assert.equal(normalized.con, 16);
  assert.equal(normalized.int, 15);
  assert.equal(normalized.wis, 14);
  assert.equal(normalized.cha, 13);
}

function testArmorClassPrecedence() {
  assert.equal(getArmorClass({ ac: 16, armorClass: 17, guardRating: 13 }), 17);
  assert.equal(getArmorClass({ ac: 16, guardRating: 13 }), 16);
  assert.equal(getArmorClass({ guardRating: 13 }), 13);
  assert.equal(getArmorClass({}), 10);
}

function testProficiencyProgression() {
  assert.equal(getProficiencyBonus(1), 2);
  assert.equal(getProficiencyBonus(5), 3);
  assert.equal(getProficiencyBonus(9), 4);
  assert.equal(getProficiencyBonus(13), 5);
  assert.equal(getProficiencyBonus(17), 6);
}

function testHelpers() {
  const combatant = { str: 16, dex: 14, con: 12, hp: 22, Spd: 10 };
  assert.equal(getAbilityModifier(18), 4);
  assert.equal(getStrModifier(combatant), 3);
  assert.equal(getDexModifier(combatant), 2);
  assert.equal(getConModifier(combatant), 1);
  assert.equal(getHitPoints(combatant), 22);
  assert.equal(getSpeed(combatant), 30);
}

function testActionEconomyExports() {
  const economy = actionEconomy.create5eActionEconomy({ movement: 25 });
  assert.equal(actionEconomy.getActionsPerTurn(), 1);
  assert.equal(actionEconomy.hasAction(economy), true);
  assert.equal(actionEconomy.hasBonusAction(economy), true);
  assert.equal(actionEconomy.hasReaction(economy), true);
  assert.equal(actionEconomy.spendAction(economy).action, false);
  assert.equal(actionEconomy.spendBonusAction(economy).bonusAction, false);
  assert.equal(actionEconomy.spendReaction(economy).reaction, false);
  assert.equal(actionEconomy.resetTurnActions({ movement: 20 }).action, true);
  assert.equal(typeof actionEconomy.getAttacksPerMelee, "function");
  assert.equal(typeof actionEconomy.getCombatantAttacksPerMelee, "function");
  assert.equal(typeof actionEconomy.getActionCost, "function");
  assert.equal(typeof actionEconomy.formatAttacksRemaining, "function");
}

function run() {
  testLegacyAbilityMapping();
  testModernAbilityPreference();
  testArmorClassPrecedence();
  testProficiencyProgression();
  testHelpers();
  testActionEconomyExports();
  console.log("5E normalization tests passed.");
}

run();
