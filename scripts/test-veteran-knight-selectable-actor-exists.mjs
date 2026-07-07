import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";

const veteran = getSelectableActorById("veteran-knight");
assert.ok(veteran, "Veteran Knight should be selectable");
assert.equal(veteran.name, "Veteran Knight");
assert.equal(veteran.playable, true);
assert.equal(veteran.derivedStats.hp, 28);
assert.equal(veteran.movement.ground, 25);
assert.equal(veteran.actionsPerRound, 2);
assert.deepEqual(veteran.bonuses, { attack: 4, block: 4, evade: 1, damage: 3 });

const adapted = adaptSelectableActorToCombatant(veteran);
assert.equal(adapted.ok, true);
assert.equal(adapted.combatant.currentHP, 28);
assert.equal(adapted.combatant.movementSpeed, 25);
assert.equal(adapted.combatant.actionsPerRound, 2);
assert.equal(adapted.combatant.equippedArmor.weightClass, "heavy");

console.log("Veteran Knight selectable actor tests passed");
