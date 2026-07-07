import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const attacks = Object.fromEntries(minotaur.attacks.map((attack) => [attack.name, attack]));

assert.equal(attacks["Heavy Axe"].damage, "2d8+4");
for (const name of ["Horn Charge", "Headbutt", "Horn Hook", "Crush"]) {
  assert.equal(attacks[name].damage, "2d6+4");
}
for (const name of ["Headbutt", "Horn Hook", "Crush"]) {
  assert.equal(attacks[name].usableInClose, true);
  assert.equal(attacks[name].usableInClinch, true);
  assert.equal(attacks[name].naturalWeapon, true);
}

console.log("Minotaur close-range attack metadata tests passed");
