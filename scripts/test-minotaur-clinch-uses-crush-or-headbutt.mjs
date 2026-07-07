import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { getMeleeEngagementContext, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const minotaur = adaptSelectableActorToCombatant(getSelectableActorById("minotaur")).combatant;
const target = { id: "knight", grappleState: { state: "grapple_clinch", opponent: minotaur.id } };
minotaur.grappleState = { state: "grapple_clinch", opponent: target.id };
const axe = minotaur.attacks.find((attack) => attack.name === "Heavy Axe");
const context = getMeleeEngagementContext({ actor: minotaur, target, distanceFeet: 0 });
const result = selectMeleeAttackForContext({ actor: minotaur, target, candidates: minotaur.attacks, selectedAttack: axe, context });

assert.equal(context.rangeBand, "clinch");
assert.match(result.attack.name, /Crush|Headbutt/);
assert.equal(result.attack.usableInClinch, true);
console.log("Minotaur clinch natural-attack tests passed");
