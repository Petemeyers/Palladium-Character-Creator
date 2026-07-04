import assert from "node:assert/strict";
import { calculateRoutedMovementStaminaCost, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const controlled = (fighter, distanceFeet = 30) => calculateRoutedMovementStaminaCost({
  fighter, distanceFeet, movementType: "controlled-withdrawal", survivalIntent: SURVIVAL_INTENTS.REGROUP_WITH_ALLY,
});
const panic = calculateRoutedMovementStaminaCost({
  fighter: { armorClass: 18 }, distanceFeet: 30, movementType: "panic-run", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE,
});
assert.equal(controlled({ armorClass: 11 }), 1);
assert.equal(controlled({ armorClass: 14 }), 1, "medium armor only burdens running or long routed movement");
assert.equal(controlled({ armorClass: 18 }), 2);
assert.ok(controlled({ armorClass: 18 }) < panic);
assert.ok(controlled({ armorClass: 18 }, 60) > controlled({ armorClass: 18 }, 30));
console.log("controlled routed armor burden test passed");
