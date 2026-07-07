import assert from "node:assert/strict";
import { selectGrappleFollowUpWeapon } from "../src/utils/grappleFollowUp.js";

const selection = selectGrappleFollowUpWeapon({
  equistaminadWeapons: [{ name: "Long Sword", damage: "1d8", lengthFt: 3 }],
  inventory: [{ name: "Dagger", type: "weapon", damage: "1d4", lengthFt: 1 }],
});

assert.equal(selection.weapon.name, "Dagger");
assert.equal(selection.usesGroundFallback, false);

console.log("Grapple follow-up dagger preference tests passed");
