import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";

const knight = adaptSelectableActorToCombatant(getSelectableActorById("veteran-knight")).combatant;
assert.ok(knight.inventory.some((item) => item.name === "Dagger"));
assert.equal(knight.equistaminadWeapons[0].name, "Long Sword");

console.log("Veteran Knight adapter Dagger tests passed");
