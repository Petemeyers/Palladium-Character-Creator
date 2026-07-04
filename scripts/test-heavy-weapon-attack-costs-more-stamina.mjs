import assert from "node:assert/strict";
import { calculateAttackStaminaCost } from "../src/utils/combatStamina.js";

const normal = calculateAttackStaminaCost({ weapon: { name: "Long Sword", type: "melee" } });
const heavy = calculateAttackStaminaCost({ weapon: { name: "Greatsword", type: "melee", twoHanded: true } });
const ranged = calculateAttackStaminaCost({ weapon: { name: "Longbow", type: "ranged", range: 150 } });
assert.equal(normal, 2);
assert.equal(heavy, 3);
assert.ok(heavy > normal);
assert.equal(ranged, 1);
console.log("heavy weapon attack stamina tests passed");
