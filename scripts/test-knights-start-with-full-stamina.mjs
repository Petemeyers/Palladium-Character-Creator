import assert from "node:assert/strict";
import { humanFighters } from "../src/data/humanFighters.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { initializeCombatFatigue } from "../src/utils/combatFatigueSystem.js";

const standard = humanFighters.find((actor) => actor.id === "knight");
const veteran = adaptSelectableActorToCombatant(getSelectableActorById("veteran-knight")).combatant;

for (const [actor, expected] of [[standard, 28], [veteran, 30]]) {
  assert.equal(actor.maxStamina, expected);
  assert.equal(actor.currentStamina, expected);
  const fatigue = initializeCombatFatigue(actor);
  assert.equal(fatigue.maxStamina, expected);
  assert.equal(fatigue.currentStamina, expected);
  assert.equal(fatigue.staminaSource, "explicit");
}

console.log("Knight full-stamina initialization tests passed");
