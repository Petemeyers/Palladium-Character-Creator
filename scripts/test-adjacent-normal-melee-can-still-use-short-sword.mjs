import assert from "node:assert/strict";
import { getMeleeEngagementContext, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const actor = { id: "knight" };
const target = { id: "goblin" };
const shortSword = { name: "Short Sword", damage: "1d6" };
const context = getMeleeEngagementContext({ actor, target, distanceFeet: 5 });
const result = selectMeleeAttackForContext({ actor, target, candidates: [shortSword], selectedAttack: shortSword, context });

assert.equal(context.rangeBand, "close-melee");
assert.equal(context.isGrappling, false);
assert.equal(result.attack, shortSword);
assert.equal(result.changed, false);
console.log("ordinary adjacent short-sword selection tests passed");
