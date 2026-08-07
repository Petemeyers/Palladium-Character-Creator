import assert from "node:assert/strict";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const attacker = { id: "enemy" };
const routed = { id: "routed", moraleState: { status: "ROUTED" } };
const active = { id: "active", moraleState: { status: "STEADY" } };
const positions = { enemy: { x: 1, y: 1 }, routed: { x: 2, y: 1 }, active: { x: 8, y: 1 } };
const result = prioritizeEnemyCombatTargets({ attacker, candidates: [routed, active], positions, calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5 });
assert.deepEqual(result.map((target) => target.id), ["active"]);
console.log("adjacent routed fighter is excluded from ordinary targeting");
