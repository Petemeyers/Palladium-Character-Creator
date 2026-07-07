import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { getActorArmorDisplay } from "../src/utils/actorSheetDisplay.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const armor = getActorArmorDisplay(minotaur);

assert.equal(armor.kind, "itemized");
assert.equal(armor.name, "Natural Hide");
assert.match(armor.armorClass, /medium/i);
assert.equal(armor.lootable, "No");

console.log("Minotaur natural-armor display tests passed");
