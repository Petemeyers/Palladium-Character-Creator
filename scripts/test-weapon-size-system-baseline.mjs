import assert from "node:assert/strict";
import weaponSizeSystemDefault, {
  RACE_WEAPON_SIZE,
  WEAPON_SIZE,
  canRaceUseWeapon,
  getAdjustedWeaponDamage,
  getAdjustedWeaponLength,
  getAdjustedWeaponWeight,
  getHeavyWeaponDamage,
  getHumanWeaponDamage,
  getWeaponSizeForRace,
  getWeaponWeightMultiplier,
} from "../src/utils/weaponSizeSystem.js";

function testExports() {
  assert.deepEqual(WEAPON_SIZE, {
    SMALL: "SMALL",
    NORMAL: "NORMAL",
    LARGE_HEAVY: "LARGE_HEAVY",
    SCOUT: "SCOUT",
  });
  assert.equal(RACE_WEAPON_SIZE["Heavy Fighter"], WEAPON_SIZE.LARGE_HEAVY);
  assert.equal(RACE_WEAPON_SIZE.Scout, WEAPON_SIZE.SCOUT);
  assert.equal(RACE_WEAPON_SIZE.Human, WEAPON_SIZE.NORMAL);

  assert.equal(weaponSizeSystemDefault.WEAPON_SIZE, WEAPON_SIZE);
  assert.equal(weaponSizeSystemDefault.RACE_WEAPON_SIZE, RACE_WEAPON_SIZE);
  assert.equal(weaponSizeSystemDefault.getWeaponSizeForRace, getWeaponSizeForRace);
  assert.equal(weaponSizeSystemDefault.canRaceUseWeapon, canRaceUseWeapon);
}

function testWeaponSizeMappingBaseline() {
  assert.equal(getWeaponSizeForRace(null), WEAPON_SIZE.NORMAL);
  assert.equal(getWeaponSizeForRace(""), WEAPON_SIZE.NORMAL);
  assert.equal(getWeaponSizeForRace("unknown"), WEAPON_SIZE.NORMAL);
  assert.equal(getWeaponSizeForRace("Human"), WEAPON_SIZE.NORMAL);
  assert.equal(getWeaponSizeForRace("human"), WEAPON_SIZE.NORMAL);
  assert.equal(getWeaponSizeForRace("Heavy Fighter"), WEAPON_SIZE.LARGE_HEAVY);
  assert.equal(getWeaponSizeForRace("heavy fighter"), WEAPON_SIZE.LARGE_HEAVY);
  assert.equal(getWeaponSizeForRace("Wolf"), WEAPON_SIZE.LARGE_HEAVY);
  assert.equal(getWeaponSizeForRace("Scout"), WEAPON_SIZE.SCOUT);
  assert.equal(getWeaponSizeForRace("Scout (Common)"), WEAPON_SIZE.SCOUT);
}

function testDamageConversionBaseline() {
  assert.equal(getHumanWeaponDamage(null), "1d4");
  assert.equal(getHumanWeaponDamage(""), "1d4");
  assert.equal(getHumanWeaponDamage("1d8"), "1d4");
  assert.equal(getHumanWeaponDamage("1d8+2"), "1d4");
  assert.equal(getHumanWeaponDamage("2d6"), "1d6");
  assert.equal(getHumanWeaponDamage("2d8"), "1d6");
  assert.equal(getHumanWeaponDamage("3d6"), "1d6");
  assert.equal(getHumanWeaponDamage("crossbow"), "1d6");
  assert.equal(getHumanWeaponDamage("bad"), "1d4");

  assert.equal(getHeavyWeaponDamage(null), "1d6");
  assert.equal(getHeavyWeaponDamage(""), "1d6");
  assert.equal(getHeavyWeaponDamage("1d8"), "2d8");
  assert.equal(getHeavyWeaponDamage("1d8+2"), "2d8+2");
  assert.equal(getHeavyWeaponDamage("2d6"), "3d6");
  assert.equal(getHeavyWeaponDamage("2d8"), "3d8");
  assert.equal(getHeavyWeaponDamage("3d6"), "4d6");
  assert.equal(getHeavyWeaponDamage("bad"), "bad + 1d6");
}

function testAdjustedDamageBaseline() {
  assert.equal(getAdjustedWeaponDamage(null, "Heavy Fighter"), null);
  assert.equal(getAdjustedWeaponDamage("", "Heavy Fighter"), "");
  assert.equal(getAdjustedWeaponDamage("1d8", null), "1d8");
  assert.equal(getAdjustedWeaponDamage("1d8", "Human"), "1d8");
  assert.equal(getAdjustedWeaponDamage("1d8", "unknown"), "1d8");
  assert.equal(getAdjustedWeaponDamage("1d8", "Scout"), "1d8");
  assert.equal(getAdjustedWeaponDamage("1d8", "Heavy Fighter"), "2d8");
  assert.equal(getAdjustedWeaponDamage("1d8+2", "Heavy Fighter"), "2d8+2");
  assert.equal(getAdjustedWeaponDamage("2d6", "Heavy Fighter"), "3d6");
  assert.equal(getAdjustedWeaponDamage("2d8", "Heavy Fighter"), "3d8");
  assert.equal(getAdjustedWeaponDamage("3d6", "Heavy Fighter"), "4d6");
}

function testWeightMultiplierBaseline() {
  assert.equal(getWeaponWeightMultiplier(null), 1);
  assert.equal(getWeaponWeightMultiplier(""), 1);
  assert.equal(getWeaponWeightMultiplier("unknown"), 1);
  assert.equal(getWeaponWeightMultiplier("Human"), 1);
  assert.equal(getWeaponWeightMultiplier("Scout"), 1);
  assert.equal(getWeaponWeightMultiplier("Heavy Fighter"), 2.5);
  assert.equal(getWeaponWeightMultiplier("Wolf"), 2.5);
}

function testAdjustedLengthBaseline() {
  assert.equal(getAdjustedWeaponLength(null, "Scout"), null);
  assert.equal(getAdjustedWeaponLength(0, "Scout"), 0);
  assert.equal(getAdjustedWeaponLength(6, null), 6);
  assert.equal(getAdjustedWeaponLength(6, "Human"), 6);
  assert.equal(getAdjustedWeaponLength(6, "unknown"), 6);
  assert.equal(getAdjustedWeaponLength(6, "Heavy Fighter"), 6);
  assert.equal(getAdjustedWeaponLength(6, "Scout"), 6);
  assert.equal(getAdjustedWeaponLength(6, "Scout", { species: "Scout" }), 2.0999999999999996);
  assert.equal(getAdjustedWeaponLength(6, "Scout", { race: "Scout" }), 2.0999999999999996);
  assert.equal(getAdjustedWeaponLength(6, "Scout", { sizeCategory: "TINY" }), 2.0999999999999996);
}

function testAdjustedWeightBaseline() {
  assert.equal(getAdjustedWeaponWeight(null, "Scout"), null);
  assert.equal(getAdjustedWeaponWeight(0, "Scout"), 0);
  assert.equal(getAdjustedWeaponWeight(10, null), 10);
  assert.equal(getAdjustedWeaponWeight(10, "Human"), 10);
  assert.equal(getAdjustedWeaponWeight(10, "unknown"), 10);
  assert.equal(getAdjustedWeaponWeight(10, "Scout"), 10);
  assert.equal(getAdjustedWeaponWeight(10, "Heavy Fighter"), 25);
  assert.equal(getAdjustedWeaponWeight(10, "Scout", { species: "Scout" }), 25);
  assert.equal(getAdjustedWeaponWeight(10, "Scout", { race: "Scout" }), 25);
  assert.equal(getAdjustedWeaponWeight(10, "Scout", { sizeCategory: "TINY" }), 25);
}

function testCanRaceUseWeaponBaseline() {
  const spear = { name: "Spear", length: 6, weight: 10 };
  const heavyHammer = { name: "Heavy Hammer", reach: 7, weight: 18 };

  assert.deepEqual(canRaceUseWeapon(null, "Human"), {
    canUse: false,
    reason: "No weapon provided",
    effectiveLength: 0,
    effectiveWeight: 0,
  });
  assert.deepEqual(canRaceUseWeapon(spear, "Human"), {
    canUse: true,
    reason: "Weapon usable by race",
    effectiveLength: 6,
    effectiveWeight: 10,
  });
  assert.deepEqual(canRaceUseWeapon(spear, "unknown"), {
    canUse: true,
    reason: "Weapon usable by race",
    effectiveLength: 6,
    effectiveWeight: 10,
  });
  assert.deepEqual(canRaceUseWeapon(spear, "Heavy Fighter"), {
    canUse: true,
    reason: "Weapon usable by race",
    effectiveLength: 6,
    effectiveWeight: 25,
  });
  assert.deepEqual(canRaceUseWeapon(spear, "Scout", { species: "Scout" }), {
    canUse: true,
    reason: "Weapon usable by race",
    effectiveLength: 2.0999999999999996,
    effectiveWeight: 25,
  });
  assert.deepEqual(canRaceUseWeapon(heavyHammer, "Scout", { species: "Scout" }), {
    canUse: true,
    reason: "Weapon usable by race",
    effectiveLength: 2.4499999999999997,
    effectiveWeight: 45,
  });
}

function testMalformedInputsCurrentlyTolerated() {
  assert.doesNotThrow(() => getHumanWeaponDamage(undefined));
  assert.doesNotThrow(() => getHeavyWeaponDamage(undefined));
  assert.doesNotThrow(() => getAdjustedWeaponDamage(undefined, undefined));
  assert.doesNotThrow(() => getAdjustedWeaponLength(undefined, undefined));
  assert.doesNotThrow(() => getAdjustedWeaponWeight(undefined, undefined));
  assert.doesNotThrow(() => canRaceUseWeapon({}, ""));
}

function run() {
  testExports();
  testWeaponSizeMappingBaseline();
  testDamageConversionBaseline();
  testAdjustedDamageBaseline();
  testWeightMultiplierBaseline();
  testAdjustedLengthBaseline();
  testAdjustedWeightBaseline();
  testCanRaceUseWeaponBaseline();
  testMalformedInputsCurrentlyTolerated();

  console.log("weapon size system baseline tests passed");
}

run();
