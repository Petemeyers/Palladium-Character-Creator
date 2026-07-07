import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";

const source = getSelectableActorById("minotaur");
assert.deepEqual(source.attributes, {
  might: 19,
  deftness: 11,
  vigor: 16,
  endurance: 16,
  mobility: 11,
  intellect: 7,
  awareness: 12,
  cunning: 10,
  resolve: 14,
  discipline: 10,
  presence: 15,
  renown: 2,
  favor: 0,
});

const minotaur = adaptSelectableActorToCombatant(source).combatant;
assert.deepEqual(minotaur.attributes, source.attributes);
assert.equal(minotaur.currentHP, 52);
assert.equal(minotaur.maxHP, 52);
assert.equal(minotaur.movementSpeed, 40);
assert.equal(minotaur.armorClass, 14);
assert.equal(minotaur.actionsPerRound, 2);

console.log("Minotaur core attribute tests passed");
