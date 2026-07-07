import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { getMeleeEngagementContext, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const target = { id: "knight" };
const charge = minotaur.attacks.find((attack) => attack.name === "Horn Charge");
const context = getMeleeEngagementContext({ actor: minotaur, target, distanceFeet: 5 });
const result = selectMeleeAttackForContext({ actor: minotaur, target, candidates: minotaur.attacks, selectedAttack: charge, context });

assert.equal(result.reason, "charge-rejected-at-close-range");
assert.equal(result.rejectedAttack.name, "Horn Charge");
assert.match(result.attack.name, /Headbutt|Horn Hook|Crush|Unarmed Attack/);
assert.equal(result.attack.naturalWeapon, true);
console.log("Minotaur adjacent natural-attack fallback tests passed");
