import assert from "node:assert/strict";
import {
  WEAPON_SLOTS,
  canDualWield,
  canUseTwoHanded,
  equipWeapon,
  getDualWieldPenalties,
  getTwoHandedBonus,
  getWeaponBonuses,
  getWeaponDamage,
  getWeaponSlotSizeContext,
  initializeWeaponSlots,
  isTwoHandedWeapon,
  toggleTwoHandedGrip,
  unequipWeapon,
  validateWeaponSlots,
} from "../src/utils/weaponSlotManager.js";

const LONGSWORD = {
  name: "Long Sword",
  damage: "1d8",
  type: "weapon",
  category: "one-handed",
  bonuses: { attack: 1, block: 1, damage: 2 },
};

const DAGGER = {
  name: "Dagger",
  damage: "1d4",
  type: "weapon",
  category: "one-handed",
};

const PIKE = {
  name: "Pike",
  damage: "2d6",
  type: "weapon",
  category: "two-handed",
};

function testExportsAndSlotConstants() {
  assert.deepEqual(WEAPON_SLOTS, {
    RIGHT_HAND: "rightHand",
    LEFT_HAND: "leftHand",
    TWO_HANDED: "twoHanded",
  });

  assert.equal(typeof isTwoHandedWeapon, "function");
  assert.equal(typeof canUseTwoHanded, "function");
  assert.equal(typeof getWeaponDamage, "function");
  assert.equal(typeof validateWeaponSlots, "function");
}

function testHumanMediumNormalWeaponBehavior() {
  const character = { species: "Human", race: "Human", attributes: { PP: 12 } };
  const slots = initializeWeaponSlots(character);
  const equipped = equipWeapon(slots, LONGSWORD, WEAPON_SLOTS.RIGHT_HAND);

  assert.deepEqual(slots, {
    rightHand: null,
    leftHand: null,
    usingTwoHanded: false,
  });
  assert.equal(equipped.rightHand, LONGSWORD);
  assert.equal(equipped.leftHand, null);
  assert.equal(equipped.usingTwoHanded, false);
  assert.equal(getWeaponDamage(LONGSWORD, false, character), "1d8");
  assert.deepEqual(validateWeaponSlots(equipped), { valid: true });
}

function testSpeciesRaceSafety() {
  assert.doesNotThrow(() =>
    getWeaponDamage(LONGSWORD, false, { species: "human", race: "human" })
  );
  assert.doesNotThrow(() =>
    getWeaponDamage(LONGSWORD, false, { species: "unknown", race: "unknown" })
  );
  assert.equal(getWeaponDamage(LONGSWORD, false, { species: "human", race: "human" }), "1d8");
  assert.equal(getWeaponDamage(LONGSWORD, false, { species: "unknown", race: "unknown" }), "1d8");
}

function testWeaponSlotSizeContextMetadata() {
  assert.deepEqual(getWeaponSlotSizeContext({ size: "Small" }), {
    creatureSize: "Small",
    sizeRank: 2,
    legacySizeContext: {
      creatureSize: "Small",
      sizeRank: 2,
      isLegacyBridge: true,
    },
  });
  assert.deepEqual(getWeaponSlotSizeContext({ sizeCategory: "Large" }), {
    creatureSize: "Large",
    sizeRank: 4,
    legacySizeContext: {
      creatureSize: "Large",
      sizeRank: 4,
      isLegacyBridge: true,
    },
  });
  assert.equal(getWeaponSlotSizeContext({ creatureSize: "Tiny" }).creatureSize, "Tiny");
  assert.equal(getWeaponSlotSizeContext({ species: "human" }).creatureSize, "Medium");
  assert.equal(getWeaponSlotSizeContext({ species: "unknown", race: "unknown" }).creatureSize, "Medium");
}

function testNoWeaponAndMalformedWeaponDefaults() {
  assert.equal(isTwoHandedWeapon(null), false);
  assert.equal(canUseTwoHanded(null), false);
  assert.equal(getTwoHandedBonus(null), null);
  assert.equal(getWeaponDamage(null), "1d4");
  assert.equal(getWeaponDamage({}), "1d6");
  assert.equal(isTwoHandedWeapon({}), false);
  assert.deepEqual(validateWeaponSlots({ rightHand: null, leftHand: null, usingTwoHanded: false }), {
    valid: true,
  });
}

function testMultipleWeaponSlotsSelectedEquippedBehavior() {
  let slots = initializeWeaponSlots({});
  slots = equipWeapon(slots, LONGSWORD, WEAPON_SLOTS.RIGHT_HAND);
  slots = equipWeapon(slots, DAGGER, WEAPON_SLOTS.LEFT_HAND);

  assert.equal(slots.rightHand, LONGSWORD);
  assert.equal(slots.leftHand, DAGGER);
  assert.equal(slots.usingTwoHanded, false);
  assert.deepEqual(getWeaponBonuses(slots, { attributes: { PP: 12 }, abilities: [] }), {
    attack: -3,
    block: 1,
    damage: 2,
    attacks: 1,
  });

  const twoHandedSlots = equipWeapon(slots, PIKE, WEAPON_SLOTS.RIGHT_HAND);
  assert.equal(twoHandedSlots.rightHand, PIKE);
  assert.equal(twoHandedSlots.leftHand, null);
  assert.equal(twoHandedSlots.usingTwoHanded, true);
  assert.deepEqual(validateWeaponSlots(twoHandedSlots), { valid: true });
}

function testTwoHandedGripBehavior() {
  let slots = equipWeapon(initializeWeaponSlots({}), LONGSWORD);
  slots = toggleTwoHandedGrip(slots);

  assert.equal(slots.rightHand, LONGSWORD);
  assert.equal(slots.leftHand, null);
  assert.equal(slots.usingTwoHanded, true);
  assert.equal(canUseTwoHanded(LONGSWORD), true);
  assert.equal(getTwoHandedBonus(LONGSWORD), "+2");
  assert.equal(getWeaponDamage(LONGSWORD, true, { species: "Human" }), "1d8+2");
  assert.deepEqual(getWeaponBonuses(slots, { attributes: { PP: 12 }, abilities: [] }), {
    attack: 2,
    block: 1,
    damage: 4,
    attacks: 0,
  });
}

function testUnequipBehavior() {
  const twoHandedSlots = equipWeapon(initializeWeaponSlots({}), PIKE);
  assert.deepEqual(unequipWeapon(twoHandedSlots, WEAPON_SLOTS.RIGHT_HAND), {
    rightHand: null,
    leftHand: null,
    usingTwoHanded: false,
  });

  const dualSlots = equipWeapon(
    equipWeapon(initializeWeaponSlots({}), LONGSWORD),
    DAGGER,
    WEAPON_SLOTS.LEFT_HAND
  );
  assert.deepEqual(unequipWeapon(dualSlots, WEAPON_SLOTS.LEFT_HAND), {
    rightHand: LONGSWORD,
    leftHand: null,
    usingTwoHanded: false,
  });
}

function testLegacyWeaponSizeDamageBaseline() {
  assert.equal(getWeaponDamage(LONGSWORD, false, { species: "Heavy Fighter" }), "2d8");
  assert.equal(getWeaponDamage(PIKE, false, { race: "Heavy Fighter" }), "3d6");
  assert.equal(getWeaponDamage(LONGSWORD, false, { species: "Scout" }), "1d8");
}

function testValidationAndCompatibilityShapes() {
  assert.equal(isTwoHandedWeapon(PIKE), true);
  assert.equal(isTwoHandedWeapon({ name: "Long Bow", damage: "1d8" }), true);
  assert.equal(canUseTwoHanded(PIKE), false);
  assert.equal(getTwoHandedBonus({ name: "Bastard Sword", damage: "1d8" }), "+1d6");

  assert.deepEqual(
    validateWeaponSlots({ rightHand: PIKE, leftHand: DAGGER, usingTwoHanded: true }),
    { valid: false, error: "Cannot equip left hand weapon with two-handed weapon" }
  );
  assert.deepEqual(
    validateWeaponSlots({ rightHand: LONGSWORD, leftHand: DAGGER, usingTwoHanded: true }),
    { valid: false, error: "Cannot use two-handed grip while dual wielding" }
  );

  assert.equal(canDualWield({ attributes: { PP: 16 }, abilities: [] }), true);
  assert.equal(canDualWield({ attributes: { PP: 12 }, abilities: [{ name: "Dual Wield" }] }), true);
  assert.equal(canDualWield({ attributes: { PP: 12 }, abilities: [] }), false);
  assert.deepEqual(getDualWieldPenalties({ abilities: [{ name: "Two Weapon Fighting" }] }), {
    rightHand: -2,
    leftHand: -4,
    description: "Trained dual wielder penalties",
  });
  assert.deepEqual(getDualWieldPenalties({ abilities: [] }), {
    rightHand: -4,
    leftHand: -6,
    description: "Untrained dual wielding penalties",
  });
}

function run() {
  testExportsAndSlotConstants();
  testHumanMediumNormalWeaponBehavior();
  testSpeciesRaceSafety();
  testWeaponSlotSizeContextMetadata();
  testNoWeaponAndMalformedWeaponDefaults();
  testMultipleWeaponSlotsSelectedEquippedBehavior();
  testTwoHandedGripBehavior();
  testUnequipBehavior();
  testLegacyWeaponSizeDamageBaseline();
  testValidationAndCompatibilityShapes();

  console.log("weapon slot baseline tests passed");
}

run();
