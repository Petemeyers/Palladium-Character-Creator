import assert from "node:assert/strict";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const attacker = { id: "enemy" };
const routed = { id: "routed", state: { moraleState: "routed" } };
const active = { id: "active", state: { moraleState: "steady" } };
const positions = { enemy: { x: 0, y: 0 }, routed: { x: 20, y: 0 }, active: { x: 5, y: 0 } };
assert.deepEqual(prioritizeEnemyCombatTargets({ attacker, candidates: [routed, active], positions, calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5 }).map((target) => target.id), ["active"]);
console.log("far routing target deprioritization test passed");
