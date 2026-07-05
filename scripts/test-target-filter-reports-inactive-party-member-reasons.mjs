import assert from "node:assert/strict";
import { partitionCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const result = partitionCombatTargets([
  { id: "active", name: "Knight #2", currentHP: 12 },
  { id: "ko", name: "Knight #1", currentHP: 0, status: "unconscious" },
  { id: "gone", name: "Knight #3", currentHP: 10, moraleState: { hasFled: true } },
], { isHostile: () => true, canAct: (target) => target.currentHP > 0 });

assert.deepEqual(result.eligible.map((target) => target.id), ["active"]);
assert.deepEqual(
  Object.fromEntries(result.excluded.map(({ target, reason }) => [target.id, reason])),
  { ko: "unconscious", gone: "fled" },
);
console.log("target filtering reports inactive party-member reasons");
