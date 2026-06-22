import assert from "node:assert/strict";
import {
  calculatePublicDerivedStats,
  getPublicProficiencyBonus,
} from "../src/utils/publicDerivedStats.js";

function buildStats(overrides = {}) {
  return calculatePublicDerivedStats({
    level: 1,
    publicClassId: "barbarian",
    finalAbilityScores: {
      str: 16,
      dex: 14,
      con: 14,
      int: 10,
      wis: 12,
      cha: 8,
    },
    abilityModifiers: {
      str: 3,
      dex: 2,
      con: 2,
      int: 0,
      wis: 1,
      cha: -1,
    },
    publicSkillProficiencies: ["athletics", "perception"],
    ...overrides,
  });
}

function testProficiencyBonus() {
  assert.equal(getPublicProficiencyBonus(1), 2);
}

function testHitPoints() {
  assert.equal(buildStats().hitPoints, 14);
  assert.equal(buildStats({ publicClassId: "wizard" }).hitPoints, 8);
}

function testInitiativeAndArmor() {
  const stats = buildStats();
  assert.equal(stats.initiative, 2);
  assert.equal(stats.baseArmorClass, 12);
}

function testPassivePerception() {
  const stats = buildStats();
  assert.equal(stats.passivePerception, 13);
}

function testSavingThrows() {
  const stats = buildStats();
  assert.equal(stats.savingThrows.str.total, 5);
  assert.equal(stats.savingThrows.con.total, 4);
  assert.equal(stats.savingThrows.dex.total, 2);
}

function testSkillModifiers() {
  const stats = buildStats();
  const athletics = stats.skills.find((skill) => skill.id === "athletics");
  const stealth = stats.skills.find((skill) => skill.id === "stealth");
  assert.equal(athletics.total, 5);
  assert.equal(stealth.total, 2);
}

function testPublicOnlyShape() {
  const stats = buildStats();
  assert.equal(Object.hasOwn(stats, "legacyCompatibility"), false);
  assert.equal(Object.hasOwn(stats, "combatMods"), false);
  assert.equal(Object.hasOwn(stats, "stamina"), false);
}

testProficiencyBonus();
testHitPoints();
testInitiativeAndArmor();
testPassivePerception();
testSavingThrows();
testSkillModifiers();
testPublicOnlyShape();

console.log("public derived stats tests passed");
