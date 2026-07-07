import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { isAttackUsableInClinch, isChargeOnlyAttack } from "../src/utils/meleeEngagementContext.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const charge = minotaur.attacks.find((attack) => attack.name === "Horn Charge");

assert.equal(charge.chargeOnly, true);
assert.equal(charge.requiresOpenMelee, true);
assert.equal(isChargeOnlyAttack(charge), true);
assert.equal(isAttackUsableInClinch(charge), false);

console.log("Minotaur Horn Charge restriction tests passed");
