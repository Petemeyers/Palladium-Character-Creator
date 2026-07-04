import assert from "node:assert/strict";
import { getActorArmorDisplay } from "../src/utils/actorSheetDisplay.js";

const armor = getActorArmorDisplay({ armorClass: 16 });
assert.equal(armor.kind, "inferred");
assert.equal(armor.name, "Inferred Heavy Armor");
assert.equal(armor.source, "Legacy AC 16");
assert.equal(armor.lootable, "Not yet itemized");
console.log("character sheet inferred armor tests passed");
