import assert from "node:assert/strict";
import { selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const longWeapon = { name: "Spear", lengthFt: 7, twoHanded: true };
const result = selectMeleeAttackForContext({
  actor: { id: "knight" },
  target: { id: "goblin" },
  candidates: [longWeapon, { name: "Knife", damage: "1d4" }],
  selectedAttack: longWeapon,
  context: { isClinched: true, isGrappling: true, isGround: false, isAdjacent: true, rangeBand: "clinch" },
});

assert.equal(result.attack.name, "Knife");
assert.equal(result.rejectedAttack.name, "Spear");
console.log("grapple clinch long-weapon rejection tests passed");
