import assert from "node:assert/strict";
import {
  clearActorArmorAuthority,
  createCanonicalArmingSword,
  isArenaChampionActor,
  normalizeArenaChampionActor,
} from "../src/utils/combat/arenaChampionAuthority.js";

const inheritedChampion = {
  id: "legacy-arena-champion-1",
  name: "Arena Champion",
  actorKey: "heavy-fighter",
  guardRating: 17,
  armorClass: 17,
  equipment: [
    { id: "armor.plate", name: "Plate Harness", type: "armor", source: "compatibility-actor", inheritedLoadout: true },
  ],
  inventory: [
    { id: "armor.plate", name: "Plate Harness", type: "armor", source: "compatibility-actor", inheritedLoadout: true },
  ],
  equippedArmor: { id: "armor.plate", name: "Plate Harness", type: "armor" },
  wornArmor: { id: "armor.plate", name: "Plate Harness", type: "armor" },
  equistaminadArmor: "Plate Harness",
  equistaminadWeapons: [
    { id: "weapon.unarmed", name: "Unarmed", type: "unarmed" },
  ],
  attacks: [{ id: "weapon.unarmed", name: "Unarmed Attack", type: "unarmed" }],
};

assert.equal(isArenaChampionActor(inheritedChampion), true);
assert.equal(isArenaChampionActor({ name: "Knight" }), false);

const armingSword = createCanonicalArmingSword();
assert.equal(armingSword.name, "Arming Sword");
assert.equal(armingSword.handsRequired, 1);
assert.equal(armingSword.isRanged, false);
assert.equal(armingSword.reachFeet, 5);

const normalized = normalizeArenaChampionActor(inheritedChampion, {
  primaryWeapon: armingSword,
  unarmored: true,
  source: "regression-test",
});

assert.equal(normalized.actorKey, "arena-champion");
assert.equal(normalized.role, "duelist");
assert.equal(normalized.guardRating, 17, "Unarmored normalization must not erase skill-based defense");
assert.equal(normalized.armorClass, 17, "Defense score remains independent from worn armor");
assert.equal(normalized.equistaminadArmor, "Unarmored");
assert.equal(normalized.armorName, "Unarmored");
assert.equal(normalized.equippedArmor, null);
assert.equal(normalized.wornArmor, null);
assert.equal(normalized.equistaminadWeapons[0].name, "Arming Sword");
assert.equal(normalized.equistaminadWeapons.length, 1);
assert.equal(normalized.heldItems.offHand, null);
assert.equal(normalized.combatWeaponState.readyWeaponId, "weapon.arming-sword");
assert.equal(normalized.arenaChampionProfile.archetype, "unarmored-arming-sword-duelist");
assert.equal(normalized.inventory.some((item) => item?.name === "Plate Harness"), false);

const cleared = clearActorArmorAuthority({
  name: "Test Fighter",
  guardRating: 16,
  equipment: {
    worn: { torso: { name: "Plate Harness", type: "armor" } },
    held: { mainHand: { name: "Sword" }, shield: { name: "Shield" } },
  },
});
assert.equal(cleared.guardRating, 16);
assert.equal(cleared.equipment.worn.torso, null);
assert.equal(cleared.equipment.held.shield, null);
assert.equal(cleared.armorDisplayName, "Unarmored");

console.log("Arena Champion authority regression passed.");
