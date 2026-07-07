import assert from "node:assert/strict";
import { humanFighters } from "../src/data/humanFighters.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { getActorMeleeCandidates, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const standard = humanFighters.find((actor) => actor.id === "knight");
const veteran = adaptSelectableActorToCombatant(getSelectableActorById("veteran-knight")).combatant;

for (const actor of [standard, veteran]) {
  assert.ok(getActorMeleeCandidates(actor).some((candidate) => candidate.name === "Dagger"));
  const selected = selectMeleeAttackForContext({
    actor,
    context: { isClinched: true, isGrappling: true, isGround: false },
  });
  assert.equal(selected.attack.name, "Dagger");
}

console.log("Knight clinch dagger tests passed");
