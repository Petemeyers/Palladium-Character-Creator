import assert from "node:assert/strict";
import { markCombatantSurrendered } from "../src/utils/combatBrokenState.js";
import { canTargetForAction } from "../src/utils/factionDisposition.js";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const enemy = { id: "enemy", type: "enemy" };
const surrendered = markCombatantSurrendered({ id: "knight", type: "player", currentHP: 20 });
const active = { id: "guard", type: "player", currentHP: 20, status: "active" };
assert.equal(canTargetForAction(enemy, surrendered, "attack"), false);
assert.deepEqual(prioritizeEnemyCombatTargets({ attacker: enemy, candidates: [surrendered, active] }), [active]);
console.log("exhausted cower targeting exclusion tests passed");
