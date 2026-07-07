import assert from "node:assert/strict";
import { getMeleeEngagementContext, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const actor = {
  id: "knight",
  inventory: [{ name: "Dagger", type: "weapon", damage: "1d4" }],
  grappleState: { state: "grapple_clinch", opponent: "goblin" },
};
const target = { id: "goblin", grappleState: { state: "grapple_clinch", opponent: "knight" } };
const sword = { name: "Long Sword", damage: "1d8" };
const context = getMeleeEngagementContext({ actor, target, distanceFeet: 0 });
const result = selectMeleeAttackForContext({ actor, target, candidates: [sword], selectedAttack: sword, context });

assert.equal(context.rangeBand, "clinch");
assert.equal(result.attack.name, "Dagger");
assert.equal(result.rejectedAttack.name, "Long Sword");
console.log("grapple clinch dagger preference tests passed");
