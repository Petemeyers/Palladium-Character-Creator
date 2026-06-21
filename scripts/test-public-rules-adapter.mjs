import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CREATURE_SIZE,
  canUseWeaponBySize,
  getCreatureSize,
  getCreatureSizeLabel,
  getCreatureSizeRank,
  getLegacyWeaponSizeCompatibility,
  getNeutralWeaponDamage,
  getNeutralWeaponLength,
  getNeutralWeaponWeight,
  getWeaponScale,
  getWeaponSizePolicy,
  isGargantuanCreature,
  isHugeCreature,
  isLargeCreature,
  isMediumCreature,
  isSmallCreature,
  isTinyCreature,
} from "../src/utils/publicRulesAdapter.js";

function testExplicitSizes() {
  assert.equal(getCreatureSize("Tiny"), CREATURE_SIZE.TINY);
  assert.equal(getCreatureSize("Small"), CREATURE_SIZE.SMALL);
  assert.equal(getCreatureSize("Medium"), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize("Large"), CREATURE_SIZE.LARGE);
  assert.equal(getCreatureSize("Huge"), CREATURE_SIZE.HUGE);
  assert.equal(getCreatureSize("Gargantuan"), CREATURE_SIZE.GARGANTUAN);
}

function testCaseAndPhraseNormalization() {
  assert.equal(getCreatureSize("tiny"), CREATURE_SIZE.TINY);
  assert.equal(getCreatureSize("SMALL"), CREATURE_SIZE.SMALL);
  assert.equal(getCreatureSize("Medium creature"), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize("a very large animal"), CREATURE_SIZE.LARGE);
  assert.equal(getCreatureSize("HUGE beast"), CREATURE_SIZE.HUGE);
  assert.equal(getCreatureSize("gargantuan creature"), CREATURE_SIZE.GARGANTUAN);
}

function testFieldPrecedence() {
  assert.equal(
    getCreatureSize({
      creatureSize: "Huge",
      sizeCategory: "Small",
      size: "Tiny",
    }),
    CREATURE_SIZE.HUGE
  );

  assert.equal(
    getCreatureSize({
      sizeCategory: "Large",
      size: "Small",
    }),
    CREATURE_SIZE.LARGE
  );

  assert.equal(getCreatureSize({ size: "Small" }), CREATURE_SIZE.SMALL);
  assert.equal(getCreatureSize({ stats: { size: "Tiny" } }), CREATURE_SIZE.TINY);
  assert.equal(getCreatureSize({ attributes: { size: "Huge" } }), CREATURE_SIZE.HUGE);
  assert.equal(getCreatureSize({ category: "Large animal" }), CREATURE_SIZE.LARGE);
}

function testFallbacks() {
  assert.equal(getCreatureSize({ species: "human" }), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize({ race: "Human" }), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize({ species: "unknown" }), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize(null), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize(undefined), CREATURE_SIZE.MEDIUM);
  assert.equal(getCreatureSize({ species: "animal", size: "Large" }), CREATURE_SIZE.LARGE);
  assert.equal(getCreatureSizeLabel({ size: "small" }), CREATURE_SIZE.SMALL);
}

function testRanks() {
  assert.equal(getCreatureSizeRank("Tiny"), 1);
  assert.equal(getCreatureSizeRank("Small"), 2);
  assert.equal(getCreatureSizeRank("Medium"), 3);
  assert.equal(getCreatureSizeRank("Large"), 4);
  assert.equal(getCreatureSizeRank("Huge"), 5);
  assert.equal(getCreatureSizeRank("Gargantuan"), 6);
  assert.equal(getCreatureSizeRank("unsupported"), 3);
}

function testPredicates() {
  assert.equal(isTinyCreature("Tiny"), true);
  assert.equal(isSmallCreature("Small"), true);
  assert.equal(isMediumCreature("Medium"), true);
  assert.equal(isLargeCreature("Large"), true);
  assert.equal(isHugeCreature("Huge"), true);
  assert.equal(isGargantuanCreature("Gargantuan"), true);
  assert.equal(isTinyCreature("Medium"), false);
  assert.equal(isLargeCreature({ species: "animal", size: "Large" }), true);
}

function testCompatibilityBridge() {
  const bridge = getLegacyWeaponSizeCompatibility({ size: "Huge" });
  assert.deepEqual(bridge, {
    creatureSize: CREATURE_SIZE.HUGE,
    sizeRank: 5,
    isLegacyBridge: true,
  });
}

function testNeutralWeaponScale() {
  for (const size of Object.values(CREATURE_SIZE)) {
    assert.deepEqual(getWeaponScale(size), {
      creatureSize: size,
      sizeRank: getCreatureSizeRank(size),
      damageScale: 1,
      weightMultiplier: 1,
      lengthMultiplier: 1,
      reachModifier: 0,
    });
  }
}

function testNeutralWeaponAdjustments() {
  assert.equal(getNeutralWeaponDamage("1d8", { size: "Large" }), "1d8");
  assert.equal(getNeutralWeaponDamage("2d6", { size: "Small" }), "2d6");
  assert.equal(getNeutralWeaponWeight(10, { size: "Large" }), 10);
  assert.equal(getNeutralWeaponLength(6, { size: "Small" }), 6);
  assert.equal(getNeutralWeaponDamage(null, { size: "Huge" }), null);
}

function testCanUseWeaponBySize() {
  assert.equal(canUseWeaponBySize({ name: "Sword" }, { size: "Tiny" }), true);
  assert.equal(canUseWeaponBySize(null, { size: "Tiny" }), true);
  assert.equal(canUseWeaponBySize({ allowedSizes: ["Small", "Medium"] }, { size: "Small" }), true);
  assert.equal(canUseWeaponBySize({ allowedSizes: ["Small", "Medium"] }, { size: "Large" }), false);
  assert.equal(canUseWeaponBySize({ minSize: "Medium" }, { size: "Small" }), false);
  assert.equal(canUseWeaponBySize({ minSize: "Medium" }, { size: "Large" }), true);
  assert.equal(canUseWeaponBySize({ maxSize: "Large" }, { size: "Huge" }), false);
  assert.equal(canUseWeaponBySize({ maxSize: "Large" }, { size: "Medium" }), true);
  assert.equal(
    canUseWeaponBySize({ minSize: "Small", maxSize: "Huge" }, { size: "Gargantuan" }),
    false,
  );
}

function testWeaponSizePolicy() {
  assert.deepEqual(getWeaponSizePolicy({ name: "Pike", minSize: "Medium" }, { size: "Large" }), {
    creatureSize: CREATURE_SIZE.LARGE,
    sizeRank: 4,
    weaponName: "Pike",
    canUse: true,
    damageScale: 1,
    weightMultiplier: 1,
    lengthMultiplier: 1,
    reachModifier: 0,
    policy: "neutral-size",
  });

  assert.deepEqual(getWeaponSizePolicy(null, null), {
    creatureSize: CREATURE_SIZE.MEDIUM,
    sizeRank: 3,
    weaponName: "",
    canUse: true,
    damageScale: 1,
    weightMultiplier: 1,
    lengthMultiplier: 1,
    reachModifier: 0,
    policy: "neutral-size",
  });
}

async function testNoWeaponSizeSystemImport() {
  const source = await readFile(new URL("../src/utils/publicRulesAdapter.js", import.meta.url), "utf8");
  assert.equal(source.includes("weaponSizeSystem"), false);
}

async function run() {
  testExplicitSizes();
  testCaseAndPhraseNormalization();
  testFieldPrecedence();
  testFallbacks();
  testRanks();
  testPredicates();
  testCompatibilityBridge();
  testNeutralWeaponScale();
  testNeutralWeaponAdjustments();
  testCanUseWeaponBySize();
  testWeaponSizePolicy();
  await testNoWeaponSizeSystemImport();

  console.log("public rules adapter tests passed");
}

run();
