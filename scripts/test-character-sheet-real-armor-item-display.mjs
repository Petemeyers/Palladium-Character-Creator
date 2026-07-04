import assert from "node:assert/strict";
import { getActorArmorDisplay } from "../src/utils/actorSheetDisplay.js";

const armor = getActorArmorDisplay({
  armorClass: 16,
  equippedArmor: { name: "Mail Hauberk", weightClass: "heavy", coverage: ["Torso", "Arms"], condition: "worn", lootable: true },
});
assert.equal(armor.kind, "itemized");
assert.equal(armor.name, "Mail Hauberk");
assert.equal(armor.coverage, "Torso, Arms");
assert.equal(armor.lootable, "Yes");
assert.notEqual(armor.name, "Inferred Heavy Armor");
console.log("character sheet real armor item tests passed");
