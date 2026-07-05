import assert from "node:assert/strict";
import { partitionCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const result = partitionCombatTargets([
  { id: "fled", currentHP: 10, statusEffects: ["FLED"] },
  { id: "surrendered", currentHP: 10, status: "surrendered" },
  { id: "broken", currentHP: 10, moraleState: { status: "BROKEN" } },
  { id: "unconscious", currentHP: 0, condition: "unconscious" },
  { id: "active", currentHP: 10, status: "ready" },
], { isHostile: () => true, canAct: (target) => target.currentHP > 0 });

assert.deepEqual(result.eligible.map((target) => target.id), ["active"]);
assert.deepEqual(result.excluded.map(({ reason }) => reason), [
  "fled",
  "surrendered",
  "combat-broken",
  "unconscious",
]);
console.log("target filtering excludes fled, surrendered, broken, and unconscious actors");
