import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { getActorStaminaDisplay } from "../src/utils/actorSheetDisplay.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const stamina = getActorStaminaDisplay(minotaur);

assert.equal(stamina.current, 32);
assert.equal(stamina.max, 32);
assert.equal(stamina.band, "Fresh");
assert.notEqual(stamina.band, "Spent");

console.log("Minotaur full-stamina display tests passed");
