import assert from "node:assert/strict";
import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { initializeCombatFatigue } from "../src/utils/combatFatigueSystem.js";

const actor = SELECTABLE_ACTORS.find((entry) => entry.id === "minotaur");
const { combatant } = adaptSelectableActorToCombatant(actor);
const stamina = initializeCombatFatigue(combatant);

assert.ok(stamina.maxStamina >= 25 && stamina.maxStamina <= 40);
assert.equal(stamina.maxStamina, 32);
assert.equal(stamina.staminaSource, "endurance");
console.log("minotaur uses monster-appropriate normalized endurance stamina");
