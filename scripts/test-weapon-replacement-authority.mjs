import assert from "node:assert/strict";
import {
  applyEquipmentSelection,
  reapplyExplicitEquipmentSelection,
} from "../src/utils/combat/equipmentAuthority.js";

const spear = {
  id: "weapon.infantry-spear",
  weaponId: "weapon.infantry-spear",
  profileKey: "weapon.infantry-spear",
  name: "Spear",
  type: "weapon",
  damage: "1d8+1",
  reachFeet: 10,
  handsRequired: 2,
  twoHanded: true,
  requiresTwoHands: true,
};
const sword = {
  id: "weapon.arming-sword",
  weaponId: "weapon.arming-sword",
  profileKey: "weapon.arming-sword",
  name: "Arming Sword",
  type: "weapon",
  damage: "1d8+1",
  reachFeet: 5,
  handsRequired: 1,
};
const catalog = [spear, sword];

const legacySpearman = {
  id: "spearman-1",
  name: "Spearman",
  actorKey: "spearman",
  attributes: { mobility: 12 },
  equipment: [spear],
  inventory: [spear],
  equippedWeapons: [spear],
  equistaminadWeapons: [spear],
  equistaminadWeapon: "Spear",
  attacks: [spear],
  weaponProfiles: [spear],
  weapon: "Spear",
  equippedWeapon: "Spear",
  heldItems: { mainHand: spear.weaponId, offHand: null },
  loadoutKey: "default",
  defaultLoadoutKey: "default",
  loadouts: {
    default: {
      weaponProfileKeys: [spear.weaponId],
      heldItems: { mainHand: spear.weaponId, offHand: null },
    },
  },
};

const swordSelected = applyEquipmentSelection(
  legacySpearman,
  {
    rightHand: "Arming Sword",
    leftHand: null,
    shield: null,
    padding: null,
    mail: null,
    plate: null,
    outer: null,
  },
  { weaponCatalog: catalog, armorCatalog: [] },
);

const activeWeaponIds = (actor) => [
  ...(actor.equipment || []).filter((item) => item?.type === "weapon"),
  ...(actor.equippedWeapons || []),
  ...(actor.equistaminadWeapons || []),
  ...(actor.weaponProfiles || []),
  ...(actor.attacks || []).filter((attack) => attack?.type === "weapon"),
].map((weapon) => weapon.weaponId || weapon.id);

assert.deepEqual(new Set(activeWeaponIds(swordSelected)), new Set(["weapon.arming-sword"]));
assert.equal(swordSelected.equipped.weaponPrimary.weaponId, "weapon.arming-sword");
assert.equal(swordSelected.equipped.weaponSecondary, null);
assert.equal(swordSelected.equistaminadWeapon, "Arming Sword");
assert.equal(swordSelected.weapon, "Arming Sword");
assert.equal(swordSelected.combatWeaponState.readyWeaponId, "weapon.arming-sword");
assert.equal(swordSelected.heldItems.mainHand, "weapon.arming-sword");
assert.equal(swordSelected.loadoutKey, "explicit-equipment-selection");
assert.equal(swordSelected.defaultLoadoutKey, "explicit-equipment-selection");
assert.deepEqual(
  swordSelected.loadouts["explicit-equipment-selection"].weaponProfileKeys,
  ["weapon.arming-sword"],
);

const schemaReintroducedSpear = {
  ...swordSelected,
  equipment: [spear],
  equippedWeapons: [spear],
  equistaminadWeapons: [spear],
  equistaminadWeapon: "Spear",
  attacks: [spear],
  weaponProfiles: [spear],
  weapon: "Spear",
  equippedWeapon: "Spear",
  heldItems: { mainHand: spear.weaponId, offHand: null },
  loadoutKey: "default",
  defaultLoadoutKey: "default",
  loadouts: legacySpearman.loadouts,
};

const repairedAfterSchema = reapplyExplicitEquipmentSelection(schemaReintroducedSpear, {
  weaponCatalog: catalog,
  armorCatalog: [],
});
assert.deepEqual(new Set(activeWeaponIds(repairedAfterSchema)), new Set(["weapon.arming-sword"]));
assert.equal(repairedAfterSchema.combatWeaponState.readyWeaponId, "weapon.arming-sword");
assert.equal(repairedAfterSchema.loadoutKey, "explicit-equipment-selection");

const unarmed = applyEquipmentSelection(repairedAfterSchema, {
  rightHand: null,
  leftHand: null,
  shield: null,
  padding: null,
  mail: null,
  plate: null,
  outer: null,
}, { weaponCatalog: catalog, armorCatalog: [] });
assert.equal(unarmed.equippedWeapons.length, 0);
assert.equal(unarmed.attacks.length, 1);
assert.equal(unarmed.attacks[0].id, "natural.unarmed-strike");
assert.equal(unarmed.combatWeaponState.readyWeaponId, null);

console.log("weapon replacement authority tests passed");
