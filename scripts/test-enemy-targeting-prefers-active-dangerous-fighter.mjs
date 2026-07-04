import assert from "node:assert/strict";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const result = prioritizeEnemyCombatTargets({ attacker: { id: "minotaur" }, candidates: [
  { id: "fleeing", moraleState: { status: "ROUTED" } },
  { id: "dangerous", moraleState: { status: "STEADY" }, attacks: [{ damage: 10 }] },
] });
assert.deepEqual(result.map((target) => target.id), ["dangerous"]);
console.log("active dangerous target preference test passed");
