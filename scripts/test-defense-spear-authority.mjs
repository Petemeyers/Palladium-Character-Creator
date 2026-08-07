import assert from "node:assert/strict";
import {
  applyEquipmentSelection,
  normalizeWeaponProfile,
} from "../src/utils/combat/equipmentAuthority.js";
import {
  getCanonicalWeaponTraitProfile,
} from "../src/utils/combat/canonicalWeaponTraits.js";
import {
  resolvePolearmCombatMatchup,
} from "../src/utils/combat/polearmCombatAuthority.js";

const spear = {
  id: "weapon.spear",
  name: "Spear",
  damage: "1d8",
  category: "two-handed",
  reach: 6,
  range: 30,
  twoHanded: true,
};
const armingSword = {
  id: "weapon.arming-sword",
  name: "Arming Sword",
  damage: "1d8",
  category: "one-handed",
  reach: 3,
  handsRequired: 1,
};

const normalizedSpear = normalizeWeaponProfile(spear);
assert.equal(normalizedSpear.twoHanded, true);
assert.equal(normalizedSpear.handsRequired, 2);
assert.equal(normalizedSpear.shieldCompatible, false);
assert.equal(normalizedSpear.reachFeet, 10, "two-handed spear must have 10 ft canonical reach");
assert.equal(normalizedSpear.range, 0, "melee spear must not retain thrown/ranged range");
assert.equal(normalizedSpear.isRanged, false);

const actor = applyEquipmentSelection({
  id: "arena-champion",
  name: "Arena Champion",
  attributes: { mobility: 14 },
  guardRating: 17,
  armorClass: 17,
  ac: 17,
  derivedStats: { armorClass: 17 },
}, {
  rightHand: spear,
  leftHand: null,
  shield: null,
  padding: null,
  mail: null,
  plate: null,
  outer: null,
}, { weaponCatalog: [spear, armingSword], armorCatalog: [] });

assert.equal(actor.armorName, "None");
assert.equal(actor.armorRating, 0);
assert.equal(actor.defenseRating, 12, "Mobility 14 unarmored defense should normalize to 12");
assert.equal(actor.guardRating, 12, "legacy guard field must mirror canonical defense");
assert.equal(actor.armorClass, 12, "legacy armorClass field must not retain 17");
assert.equal(actor.ac, 12);
assert.equal(actor.AR, 0, "legacy AR must mirror physical armor protection, not Defense");
assert.equal(actor.derivedStats.armorClass, 12);
assert.equal(actor.attacks.length, 1);
assert.equal(actor.attacks[0].name, "Spear");

const defender = applyEquipmentSelection({
  id: "swordsman",
  name: "Swordsman",
  attributes: { mobility: 14 },
}, {
  rightHand: armingSword,
}, { weaponCatalog: [spear, armingSword], armorCatalog: [] });

const spearTraits = getCanonicalWeaponTraitProfile(actor.attacks[0]);
assert.equal(spearTraits.isTwoHandedSpear, true);
assert.equal(spearTraits.reachFeet, 10);

const idealMeasure = resolvePolearmCombatMatchup({
  attacker: actor,
  defender,
  attackWeapon: actor.attacks[0],
  defenderWeapon: defender.attacks[0],
  distanceFt: 10,
});
assert.equal(idealMeasure.applies, true);
assert.equal(idealMeasure.measure, "polearm-ideal-measure");
assert.equal(idealMeasure.attackModifier, 3, "two-handed spear must gain +3 against an unshielded one-handed sword at ideal measure");
assert.equal(idealMeasure.rule, "two-handed-spear-vs-one-handed");

const beyondReach = resolvePolearmCombatMatchup({
  attacker: actor,
  defender,
  attackWeapon: actor.attacks[0],
  defenderWeapon: defender.attacks[0],
  distanceFt: 30,
});
assert.equal(beyondReach.measure, "beyond-reach");

console.log("defense and two-handed spear authority tests passed");
