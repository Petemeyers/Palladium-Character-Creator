import assert from "node:assert/strict";
import { PUBLIC_BACKGROUNDS } from "../src/data/publicBackgrounds.js";
import {
  calculateAbilityModifier,
  calculateBackgroundAbilityBonuses,
  calculateFinalAbilityScores,
  getPointCostTotal,
  POINT_COSTS,
  PUBLIC_ABILITIES,
  rollRandomAbilityScores,
  STANDARD_ARRAY_SCORES,
} from "../src/utils/publicAbilityScores.js";
import {
  getBackgroundAttributeOptions,
  ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS,
} from "../src/utils/simulatorCreatorAttributes.js";

function testStandardArray() {
  assert.deepEqual(STANDARD_ARRAY_SCORES, [15, 14, 13, 12, 10, 8]);
}

function testPointCosts() {
  assert.deepEqual(POINT_COSTS, {
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9,
  });
  assert.equal(getPointCostTotal({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }), 27);
}

function testModifiers() {
  assert.equal(calculateAbilityModifier(8), -1);
  assert.equal(calculateAbilityModifier(10), 0);
  assert.equal(calculateAbilityModifier(15), 2);
  assert.equal(calculateAbilityModifier(20), 5);
}

function testRandomGeneration() {
  const rolls = [1, 2, 3, 4, 6, 6, 1, 1, 2, 2, 2, 2, 5, 4, 3, 2, 6, 5, 4, 3, 1, 1, 1, 1];
  const generated = rollRandomAbilityScores({ rollDie: () => rolls.shift() });
  assert.deepEqual(generated, [9, 13, 6, 12, 15, 3]);
}

function testBackgroundBonuses() {
  const options = ["str", "dex", "con"];
  assert.deepEqual(
    calculateBackgroundAbilityBonuses({
      mode: "split",
      options,
      plusTwoAbility: "str",
      plusOneAbility: "str",
    }),
    { str: 2 },
  );
  assert.deepEqual(
    calculateBackgroundAbilityBonuses({
      mode: "split",
      options,
      plusTwoAbility: "str",
      plusOneAbility: "dex",
    }),
    { str: 2, dex: 1 },
  );
  assert.deepEqual(
    calculateBackgroundAbilityBonuses({
      mode: "all",
      options,
    }),
    { str: 1, dex: 1, con: 1 },
  );
}

function testFinalScores() {
  assert.deepEqual(
    calculateFinalAbilityScores({ str: 19, dex: 15 }, { str: 2, dex: 1 }),
    { str: 20, dex: 16 },
  );
}

function testPublicBackgrounds() {
  for (const background of PUBLIC_BACKGROUNDS) {
    const attributeOptions = getBackgroundAttributeOptions(background);
    assert.equal(Array.isArray(attributeOptions), true);
    assert.equal(attributeOptions.length, 3);
    for (const attributeId of attributeOptions) {
      assert.equal(
        ROLLABLE_SIMULATOR_ATTRIBUTE_KEYS.includes(attributeId),
        true,
        `${background.name} has unsupported attribute option ${attributeId}`,
      );
    }
  }
}

testStandardArray();
testPointCosts();
testModifiers();
testRandomGeneration();
testBackgroundBonuses();
testFinalScores();
testPublicBackgrounds();

console.log("public ability score tests passed");
