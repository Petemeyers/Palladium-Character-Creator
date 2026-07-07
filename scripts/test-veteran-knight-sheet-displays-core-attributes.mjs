import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

const veteran = adaptSelectableActorToCombatant(getSelectableActorById("veteran-knight")).combatant;
const sheet = buildActorSheetDisplay(veteran);
const attributes = Object.fromEntries(sheet.coreAttributes.entries.map(({ key, value }) => [key, value]));

assert.equal(sheet.coreAttributes.complete, true);
assert.deepEqual(attributes, veteran.attributes);
assert.equal(sheet.combatState.hpCurrent, 28);
assert.equal(sheet.combatState.hpMax, 28);
assert.equal(sheet.stamina.current, 30);
assert.equal(sheet.stamina.max, 30);
assert.equal(sheet.armor.kind, "itemized");
assert.equal(sheet.armor.name, "Plate Harness");
assert.ok(sheet.weapons.some((weapon) => weapon.name === "Long Sword" && weapon.reach !== 2));

console.log("Veteran Knight character-sheet tests passed");
