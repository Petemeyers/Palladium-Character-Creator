import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CREATURE_SIZE_5E,
  canUseWeaponBySize5e,
  getAdjustedWeaponDamage5e,
  getAdjustedWeaponLength5e,
  getAdjustedWeaponWeight5e,
  getCreatureSize5e,
  getCreatureSizeLabel5e,
  getCreatureSizeRank5e,
  getLegacyWeaponSizeCompatibility,
  getWeaponScale5e,
  getWeaponSizePolicy5e,
  isGargantuan5e,
  isHuge5e,
  isLarge5e,
  isMedium5e,
  isSmall5e,
  isTiny5e,
} from "../src/utils/size5eAdapter.js";

function testExplicitSizes() {
  assert.equal(getCreatureSize5e("Tiny"), CREATURE_SIZE_5E.TINY);
  assert.equal(getCreatureSize5e("Small"), CREATURE_SIZE_5E.SMALL);
  assert.equal(getCreatureSize5e("Medium"), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e("Large"), CREATURE_SIZE_5E.LARGE);
  assert.equal(getCreatureSize5e("Huge"), CREATURE_SIZE_5E.HUGE);
  assert.equal(getCreatureSize5e("Gargantuan"), CREATURE_SIZE_5E.GARGANTUAN);
}

function testCaseAndPhraseNormalization() {
  assert.equal(getCreatureSize5e("tiny"), CREATURE_SIZE_5E.TINY);
  assert.equal(getCreatureSize5e("SMALL"), CREATURE_SIZE_5E.SMALL);
  assert.equal(getCreatureSize5e("Medium creature"), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e("a very large animal"), CREATURE_SIZE_5E.LARGE);
  assert.equal(getCreatureSize5e("HUGE beast"), CREATURE_SIZE_5E.HUGE);
  assert.equal(getCreatureSize5e("gargantuan creature"), CREATURE_SIZE_5E.GARGANTUAN);
}

function testFieldPrecedence() {
  assert.equal(
    getCreatureSize5e({
      creatureSize: "Huge",
      sizeCategory: "Small",
      size: "Tiny",
    }),
    CREATURE_SIZE_5E.HUGE
  );

  assert.equal(
    getCreatureSize5e({
      sizeCategory: "Large",
      size: "Small",
    }),
    CREATURE_SIZE_5E.LARGE
  );

  assert.equal(getCreatureSize5e({ size: "Small" }), CREATURE_SIZE_5E.SMALL);
  assert.equal(getCreatureSize5e({ stats: { size: "Tiny" } }), CREATURE_SIZE_5E.TINY);
  assert.equal(getCreatureSize5e({ attributes: { size: "Huge" } }), CREATURE_SIZE_5E.HUGE);
  assert.equal(getCreatureSize5e({ category: "Large animal" }), CREATURE_SIZE_5E.LARGE);
}

function testFallbacks() {
  assert.equal(getCreatureSize5e({ species: "human" }), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e({ race: "Human" }), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e({ species: "unknown" }), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e(null), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e(undefined), CREATURE_SIZE_5E.MEDIUM);
  assert.equal(getCreatureSize5e({ species: "animal", size: "Large" }), CREATURE_SIZE_5E.LARGE);
  assert.equal(getCreatureSizeLabel5e({ size: "small" }), CREATURE_SIZE_5E.SMALL);
}

function testRanks() {
  assert.equal(getCreatureSizeRank5e("Tiny"), 1);
  assert.equal(getCreatureSizeRank5e("Small"), 2);
  assert.equal(getCreatureSizeRank5e("Medium"), 3);
  assert.equal(getCreatureSizeRank5e("Large"), 4);
  assert.equal(getCreatureSizeRank5e("Huge"), 5);
  assert.equal(getCreatureSizeRank5e("Gargantuan"), 6);
  assert.equal(getCreatureSizeRank5e("unsupported"), 3);
}

function testPredicates() {
  assert.equal(isTiny5e("Tiny"), true);
  assert.equal(isSmall5e("Small"), true);
  assert.equal(isMedium5e("Medium"), true);
  assert.equal(isLarge5e("Large"), true);
  assert.equal(isHuge5e("Huge"), true);
  assert.equal(isGargantuan5e("Gargantuan"), true);
  assert.equal(isTiny5e("Medium"), false);
  assert.equal(isLarge5e({ species: "animal", size: "Large" }), true);
}

function testCompatibilityBridge() {
  const bridge = getLegacyWeaponSizeCompatibility({ size: "Huge" });
  assert.deepEqual(bridge, {
    creatureSize: CREATURE_SIZE_5E.HUGE,
    sizeRank: 5,
    isLegacyBridge: true,
  });
}

function testNeutralWeaponScale() {
  for (const size of Object.values(CREATURE_SIZE_5E)) {
    assert.deepEqual(getWeaponScale5e(size), {
      creatureSize: size,
      sizeRank: getCreatureSizeRank5e(size),
      damageScale: 1,
      weightMultiplier: 1,
      lengthMultiplier: 1,
      reachModifier: 0,
    });
  }
}

function testNeutralWeaponAdjustments() {
  assert.equal(getAdjustedWeaponDamage5e("1d8", { size: "Large" }), "1d8");
  assert.equal(getAdjustedWeaponDamage5e("2d6", { size: "Small" }), "2d6");
  assert.equal(getAdjustedWeaponWeight5e(10, { size: "Large" }), 10);
  assert.equal(getAdjustedWeaponLength5e(6, { size: "Small" }), 6);
  assert.equal(getAdjustedWeaponDamage5e(null, { size: "Huge" }), null);
}

function testCanUseWeaponBySize() {
  assert.equal(canUseWeaponBySize5e({ name: "Sword" }, { size: "Tiny" }), true);
  assert.equal(canUseWeaponBySize5e(null, { size: "Tiny" }), true);
  assert.equal(canUseWeaponBySize5e({ allowedSizes: ["Small", "Medium"] }, { size: "Small" }), true);
  assert.equal(canUseWeaponBySize5e({ allowedSizes: ["Small", "Medium"] }, { size: "Large" }), false);
  assert.equal(canUseWeaponBySize5e({ minSize: "Medium" }, { size: "Small" }), false);
  assert.equal(canUseWeaponBySize5e({ minSize: "Medium" }, { size: "Large" }), true);
  assert.equal(canUseWeaponBySize5e({ maxSize: "Large" }, { size: "Huge" }), false);
  assert.equal(canUseWeaponBySize5e({ maxSize: "Large" }, { size: "Medium" }), true);
  assert.equal(
    canUseWeaponBySize5e({ minSize: "Small", maxSize: "Huge" }, { size: "Gargantuan" }),
    false,
  );
}

function testWeaponSizePolicy() {
  assert.deepEqual(getWeaponSizePolicy5e({ name: "Pike", minSize: "Medium" }, { size: "Large" }), {
    creatureSize: CREATURE_SIZE_5E.LARGE,
    sizeRank: 4,
    weaponName: "Pike",
    canUse: true,
    damageScale: 1,
    weightMultiplier: 1,
    lengthMultiplier: 1,
    reachModifier: 0,
    policy: "5e-neutral",
  });

  assert.deepEqual(getWeaponSizePolicy5e(null, null), {
    creatureSize: CREATURE_SIZE_5E.MEDIUM,
    sizeRank: 3,
    weaponName: "",
    canUse: true,
    damageScale: 1,
    weightMultiplier: 1,
    lengthMultiplier: 1,
    reachModifier: 0,
    policy: "5e-neutral",
  });
}

async function testNoWeaponSizeSystemImport() {
  const source = await readFile(new URL("../src/utils/size5eAdapter.js", import.meta.url), "utf8");
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

  console.log("size5e adapter tests passed");
}

run();
