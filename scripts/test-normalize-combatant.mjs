import assert from "node:assert/strict";
import {
  getAbilityModifier,
  getArmorClass,
  getConModifier,
  getDexModifier,
  getHitPoints,
  getMaxHitPoints,
  getProficiencyBonus,
  getSpeed,
  getStrModifier,
  getTemporaryHitPoints,
  normalizeCombatant,
} from "../src/utils/normalizeCombatant.js";
import * as actionEconomy from "../src/utils/actionEconomy.js";
import {
  getInitiativeModifier,
  rollInitiativeD20,
} from "../src/utils/initiativeD20.js";

function testLegacyAbilityMapping() {
  const normalized = normalizeCombatant({
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
  const normalized = normalizeCombatant({
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
  assert.equal(getArmorClass({ ac: 16, armorClass: 17, guardRating: 13 }), 16);
  assert.equal(getArmorClass({ armorClass: 17, guardRating: 13 }), 17);
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

function testPolicyMetadataDefaults() {
  const normalized = normalizeCombatant({});
  assert.equal(normalized.ruleset, "core-d20");
  assert.equal(normalized.sizePolicy, "legacy-compatible");
  assert.equal(normalized.legacyCompatibility, true);
}

function testPolicyMetadataPreservation() {
  const normalized = normalizeCombatant({
    ruleset: "custom-ruleset",
    sizePolicy: "neutral-size",
    legacyCompatibility: false,
  });
  assert.equal(normalized.ruleset, "custom-ruleset");
  assert.equal(normalized.sizePolicy, "neutral-size");
  assert.equal(normalized.legacyCompatibility, false);
}

function testPolicyMetadataFallbacks() {
  assert.equal(
    normalizeCombatant({ legacyCompatibility: "false" }).legacyCompatibility,
    true
  );
  assert.equal(
    normalizeCombatant({ legacyCompatibility: null }).legacyCompatibility,
    true
  );
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

function testHitPointPrecedence() {
  assert.equal(getHitPoints({
    hp: 8,
    currentHp: 7,
    currentHitPoints: 6,
    hitPoints: 5,
    health: 4,
  }), 8);
  assert.equal(getHitPoints({ currentHp: 7 }), 7);
  assert.equal(getHitPoints({ currentHitPoints: 6 }), 6);
  assert.equal(getHitPoints({ hitPoints: 5 }), 5);
  assert.equal(getHitPoints({ health: 4 }), 4);
  assert.equal(getHitPoints({}), 10);

  assert.equal(getMaxHitPoints({ maxHp: 20, maxHitPoints: 19, hitPoints: 18, hp: 17 }), 20);
  assert.equal(getMaxHitPoints({ maxHitPoints: 19, hitPoints: 18, hp: 17 }), 19);
  assert.equal(getMaxHitPoints({ hitPoints: 18, hp: 17 }), 18);
  assert.equal(getMaxHitPoints({ hp: 17 }), 17);
  assert.equal(getMaxHitPoints({}), 10);

  assert.equal(getTemporaryHitPoints({}), 0);
  assert.equal(getTemporaryHitPoints({ temporaryHitPoints: 3 }), 3);

  const normalized = normalizeCombatant({
    hp: 8,
    currentHp: 7,
    maxHp: 20,
    temporaryHitPoints: 3,
    hitPoints: 18,
  });
  assert.equal(normalized.hp, 8);
  assert.equal(normalized.currentHp, 7);
  assert.equal(normalized.maxHp, 20);
  assert.equal(normalized.tempHp, 3);
  assert.equal(normalized.hitPoints, 18);
}

function testActionEconomyExports() {
  const economy = actionEconomy.createActionEconomy({ movement: 25 });
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

function testLegacyFighterPassthrough() {
  const position = { x: 2, y: 3 };
  const normalized = normalizeCombatant({
    id: "fighter-1",
    _id: "fighter-1",
    name: "Arena Guard",
    type: "enemy",
    teamId: "red",
    side: "opponents",
    factionId: "town-watch",
    position,
    PS: 15,
    PP: 13,
    PE: 12,
    IQ: 11,
    ME: 10,
    MA: 9,
    guardRating: 14,
    currentHP: 9,
    maxHP: 12,
    actionsPerRound: 2,
    remainingActions: 2,
    legacyFlag: "kept",
  });

  assert.equal(normalized.id, "fighter-1");
  assert.equal(normalized.name, "Arena Guard");
  assert.equal(normalized.type, "enemy");
  assert.equal(normalized.teamId, "red");
  assert.equal(normalized.side, "opponents");
  assert.equal(normalized.factionId, "town-watch");
  assert.deepEqual(normalized.position, position);
  assert.equal(normalized.actionsPerRound, 2);
  assert.equal(normalized.remainingActions, 2);
  assert.equal(normalized.legacyFlag, "kept");
  assert.deepEqual(normalized.abilityScores, {
    str: 15,
    dex: 13,
    con: 12,
    int: 11,
    wis: 10,
    cha: 9,
  });
  assert.equal(normalized.abilityMods.str, 2);
  assert.equal(normalized.ac, 14);
  assert.equal(normalized.hp, 9);
  assert.equal(normalized.maxHp, 12);
  assert.equal(normalized.speed, 30);
  assert.equal(normalized.actionEconomy.movement, 30);
}

function testInitiativeD20() {
  assert.equal(getInitiativeModifier({ dex: 10 }).totalModifier, 0);
  assert.equal(getInitiativeModifier({ dex: 14 }).totalModifier, 2);
  assert.equal(getInitiativeModifier({ PP: 14 }).totalModifier, 2);
  assert.equal(getInitiativeModifier({ dex: 14, initiativeBonus: 3 }).totalModifier, 5);
  assert.equal(getInitiativeModifier({ dex: 10, initiative: 19 }).totalModifier, 0);

  const rolled = rollInitiativeD20({ dex: 14, initiativeBonus: 3 }, { d20Roll: 10 });
  assert.equal(rolled.d20Roll, 10);
  assert.equal(rolled.dexModifier, 2);
  assert.equal(rolled.initiativeBonus, 3);
  assert.equal(rolled.totalModifier, 5);
  assert.equal(rolled.total, 15);
}

function run() {
  testLegacyAbilityMapping();
  testModernAbilityPreference();
  testArmorClassPrecedence();
  testProficiencyProgression();
  testPolicyMetadataDefaults();
  testPolicyMetadataPreservation();
  testPolicyMetadataFallbacks();
  testHelpers();
  testHitPointPrecedence();
  testActionEconomyExports();
  testLegacyFighterPassthrough();
  testInitiativeD20();
  console.log("combatant normalization tests passed.");
}

run();
