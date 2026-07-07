import assert from "node:assert/strict";
import { selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const result = selectMeleeAttackForContext({
  actor: { id: "knight" },
  target: { id: "goblin" },
  candidates: [{ name: "Long Sword", lengthFt: 4 }],
  selectedAttack: { name: "Long Sword", lengthFt: 4 },
  context: { isClinched: true, isGrappling: true, isGround: false, isAdjacent: true, rangeBand: "clinch" },
});

assert.match(result.attack.name, /unarmed|pommel/i);
assert.equal(result.reason, "clinch-unarmed-fallback");
console.log("grapple clinch safe fallback tests passed");
