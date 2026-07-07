import assert from "node:assert/strict";
import { getMeleeEngagementContext, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const actor = { id: "knight", inventory: [{ name: "Dagger" }] };
const target = { id: "goblin" };
const sword = { name: "Long Sword", damage: "1d8" };
const context = getMeleeEngagementContext({ actor, target, distanceFeet: 10 });
const result = selectMeleeAttackForContext({ actor, target, candidates: [sword], selectedAttack: sword, context });

assert.equal(context.rangeBand, "open-melee");
assert.equal(result.attack, sword);
assert.equal(result.changed, false);
console.log("open-melee selection preservation tests passed");
