import assert from "node:assert/strict";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { selectGrappleFollowUpWeapon } from "../src/utils/grappleFollowUp.js";

const knight = adaptSelectableActorToCombatant(getSelectableActorById("knight"), {
  team: "party",
  controlMode: "ai",
}).combatant;
const selection = selectGrappleFollowUpWeapon(knight);

assert.equal(selection.weapon.name, "Dagger");
assert.equal(selection.usesGroundFallback, false);

console.log("Live Knight grapple-follow-up weapon tests passed");
