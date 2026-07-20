import assert from "node:assert/strict";
import { selectGrappleFollowUpWeapon } from "../src/utils/grappleFollowUp.js";

const selection = selectGrappleFollowUpWeapon({
  equistaminadWeapons: [{ name: "Long Sword", damage: "1d8", lengthFt: 3 }],
});

assert.equal(selection.weapon.name, "Unarmed Attack");
assert.equal(selection.weapon.isFallbackUnarmed, true);
assert.equal(selection.attack.name, "Unarmed Attack");
assert.equal(selection.usesGroundFallback, true);

console.log("Grapple follow-up ground-attack fallback tests passed");
