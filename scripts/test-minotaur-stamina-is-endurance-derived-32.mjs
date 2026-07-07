import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { resolveEncounterStamina } from "../src/utils/combatStamina.js";
import { initializeCombatFatigue } from "../src/utils/combatFatigueSystem.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const resolution = resolveEncounterStamina(minotaur);
const fatigue = initializeCombatFatigue(minotaur);

assert.equal(minotaur.attributes.endurance, 16);
assert.deepEqual(resolution, { maxStamina: 32, source: "endurance", usedFallback: false });
assert.equal(fatigue.maxStamina, 32);
assert.equal(fatigue.currentStamina, 32);

console.log("Minotaur endurance-derived stamina tests passed");
