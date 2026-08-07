import assert from "node:assert/strict";
import {
  applyEquipmentSelection,
  normalizeWeaponProfile,
} from "../src/utils/combat/equipmentAuthority.js";

const spear = normalizeWeaponProfile({ name: "Spear", damage: "1d8", range: 30, twoHanded: false });
assert.equal(spear.twoHanded, true, "generic Spear must normalize as two-handed");
assert.equal(spear.handsRequired, 2);
assert.equal(spear.isRanged, false, "generic Spear must not inherit thrown range");
assert.equal(spear.range, 0);

const shortSpear = normalizeWeaponProfile({ name: "Short Spear", damage: "1d6" });
assert.equal(shortSpear.twoHanded, false);
assert.equal(shortSpear.shieldCompatible, true);

const actor = {
  name: "Arena Champion",
  armorClass: 17,
  guardRating: 17,
  attacks: [{ name: "Sword Attack", damage: "1d8+4" }],
  equippedWeapons: [{ name: "Long Sword" }],
  armorProfile: { armorName: "Heavy Armor" },
};

const empty = applyEquipmentSelection(actor, {}, { weaponCatalog: [], armorCatalog: [] });
assert.equal(empty.equippedWeapons.length, 0);
assert.equal(empty.attacks.length, 1);
assert.equal(empty.attacks[0].name, "Unarmed Strike");
assert.equal(empty.armorProfile.armorName, "None");
assert.equal(empty.armorProfile.armorRating, 0);
assert.equal(empty.armorProfile.defenseRating, 10);
assert.equal(empty.defenseSource, "skill-and-mobility");

const invalid = applyEquipmentSelection(actor, {
  rightHand: { name: "Spear", damage: "1d8", twoHanded: false },
  shield: { name: "Heater Shield", type: "shield", ar: 2 },
}, { weaponCatalog: [], armorCatalog: [] });
assert.equal(invalid.equippedWeapons[0].twoHanded, true);
assert.equal(invalid.equippedShield, null, "two-handed spear must clear shield");
assert.equal(invalid.equipmentValidation.valid, false);
assert.equal(invalid.attacks.length, 1);
assert.equal(invalid.attacks[0].name, "Spear");

const layered = applyEquipmentSelection(actor, {
  rightHand: { name: "Arming Sword", damage: "1d8", handedness: "one-handed" },
  shield: { name: "Buckler", type: "shield", ar: 1 },
  padding: { name: "Gambeson", type: "light", ar: 1 },
  mail: { name: "Mail Shirt", type: "medium", ar: 2 },
  plate: { name: "Plate Harness", type: "heavy", ar: 4 },
}, { weaponCatalog: [], armorCatalog: [] });
assert.equal(layered.attacks.length, 1);
assert.equal(layered.attacks[0].name, "Arming Sword");
assert.equal(layered.armorProfile.armorRating, 8);
assert.equal(layered.equippedArmor.length, 3);
assert.equal(layered.equippedShield.name, "Buckler");

console.log("equipment authority tests passed");
