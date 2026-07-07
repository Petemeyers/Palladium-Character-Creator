import assert from "node:assert/strict";
import { selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const sword = { name: "Long Sword", damage: "1d8" };
const result = selectMeleeAttackForContext({
  actor: {
    id: "party-knight",
    equistaminadWeapons: [sword],
    inventory: [{ name: "Dagger", type: "weapon", damage: "1d4" }],
  },
  target: { id: "enemy-knight" },
  selectedAttack: sword,
  context: { isClinched: true, isGrappling: true, isGround: false, isAdjacent: true, rangeBand: "clinch" },
});
assert.equal(result.attack.name, "Dagger");
assert.equal(result.rejectedAttack.name, "Long Sword");
console.log("inventory dagger clinch preference tests passed");
