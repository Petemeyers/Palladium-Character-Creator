import assert from "node:assert/strict";
import { markCombatantFled } from "../src/utils/combatFledState.js";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const fled = markCombatantFled({ id: "fled", currentHP: 10 });
const active = { id: "active", currentHP: 10 };
assert.deepEqual(prioritizeEnemyCombatTargets({ attacker: { id: "enemy" }, candidates: [fled, active] }).map((target) => target.id), ["active"]);
console.log("fled target hard-exclusion test passed");
