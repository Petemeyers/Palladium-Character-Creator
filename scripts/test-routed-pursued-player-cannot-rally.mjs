import assert from "node:assert/strict";
import { canAttemptRallyFromRouting } from "../src/utils/routingSystem.js";

const fighter = { id: "party", type: "player" };
const enemy = { id: "enemy", type: "enemy" };
const positions = { party: { x: 2, y: 2 }, enemy: { x: 6, y: 2 } };
const result = canAttemptRallyFromRouting({ fighter, enemies: [enemy], positions, calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5 });
assert.equal(result.canAttempt, false);
assert.equal(result.reason, "hostile-in-pursuit-range");
console.log("pursued routed player rally block test passed");
