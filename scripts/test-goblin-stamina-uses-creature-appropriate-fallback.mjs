import assert from "node:assert/strict";
import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { initializeCombatFatigue } from "../src/utils/combatFatigueSystem.js";

const actor = SELECTABLE_ACTORS.find((entry) => entry.id === "goblin-warrior");
const { combatant } = adaptSelectableActorToCombatant(actor);
const stamina = initializeCombatFatigue(combatant);

assert.equal(stamina.maxStamina, 20);
assert.equal(stamina.staminaSource, "endurance");
console.log("goblin uses normalized creature endurance stamina");
