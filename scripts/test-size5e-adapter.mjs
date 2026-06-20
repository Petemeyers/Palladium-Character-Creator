import assert from "node:assert/strict";
import {
  CREATURE_SIZE_5E,
  getCreatureSize5e,
  getCreatureSizeLabel5e,
  getCreatureSizeRank5e,
  getLegacyWeaponSizeCompatibility,
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

function run() {
  testExplicitSizes();
  testCaseAndPhraseNormalization();
  testFieldPrecedence();
  testFallbacks();
  testRanks();
  testPredicates();
  testCompatibilityBridge();

  console.log("size5e adapter tests passed");
}

run();
