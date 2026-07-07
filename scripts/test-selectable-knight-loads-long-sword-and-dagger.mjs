import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { humanFighters } from "../src/data/humanFighters.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";

const source = getSelectableActorById("knight");
assert.ok(source, "standard Knight should have a normalized selectable entry");

const knight = adaptSelectableActorToCombatant(source).combatant;
const inventoryNames = knight.inventory.map((item) => item.name);
const attackNames = knight.equistaminadWeapons.map((item) => item.name);

assert.ok(inventoryNames.includes("Long Sword"));
assert.ok(inventoryNames.includes("Dagger"));
assert.ok(inventoryNames.includes("Heater Shield"));
assert.ok(inventoryNames.includes("Plate Harness"));
assert.ok(attackNames.includes("Long Sword"));
assert.equal(attackNames.includes("Short Sword"), false);

const compatibilityKnight = humanFighters.find((actor) => actor.id === "knight");
assert.deepEqual(compatibilityKnight.favorite_weapons, ["Long Sword"]);
assert.ok(compatibilityKnight.inventory.some((item) => item.name === "Dagger"));

console.log("Selectable Knight equipment loading tests passed");
