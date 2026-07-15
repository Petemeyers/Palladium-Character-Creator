import assert from "node:assert/strict";
import fs from "node:fs";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";

const hawk = SELECTABLE_ACTORS.find((actor) => actor.id === "hawk");
assert.ok(hawk, "Hawk selectable actor should exist");
assert.deepEqual(hawk.movementModes, ["ground", "flying"]);
assert.equal(hawk.movement.flying, 60);

const adapted = adaptSelectableActorToCombatant(hawk);
assert.equal(adapted.ok, true);
assert.equal(adapted.combatant.isFlying, true, "Hawk should start airborne by default");
assert.equal(adapted.combatant.airborne, true);
assert.equal(adapted.combatant.movementMode, "flight");
assert.ok((adapted.combatant.altitudeFeet ?? 0) > 0);
assert.equal(adapted.combatant.abilities.movement.flight.active, true);

const grounded = adaptSelectableActorToCombatant({
  ...hawk,
  state: { grounded: true },
});
assert.equal(grounded.ok, true);
assert.notEqual(grounded.combatant.isFlying, true, "Explicit grounded state should prevent default flight");

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.match(combatPage, /const approachMovementType = approachPrefersFlight \? "FLY" : "RUN"/);
assert.match(combatPage, /FLY_TO_RANGE/);
assert.match(combatPage, /enemy flight movement commit/);
assert.match(combatPage, /copy\.isFlying = shouldStartAirborne/);
assert.doesNotMatch(combatPage, /copy\.altitude = 0;\s*copy\.altitudeFeet = 0;\s*copy\.isFlying = false;/);

console.log("hawk flight defaults and approach tests passed");
