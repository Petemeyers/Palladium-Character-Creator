import assert from "node:assert/strict";
import { canAttemptRallyFromRouting, resolveRoutedTurnRecovery } from "../src/utils/routingSystem.js";

const fighter = { id: "party", type: "player", currentHP: 10, attributes: { resolve: 16, discipline: 16 }, state: { moraleState: "routed", routTurns: 2, minimumRoutTurns: 2 } };
const enemy = { id: "enemy", type: "enemy", currentHP: 10 };
const positions = { party: { x: 2, y: 2 }, enemy: { x: 20, y: 2 } };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * 5;
assert.equal(canAttemptRallyFromRouting({ fighter, enemies: [enemy], positions, calculateDistance: distance }).canAttempt, true);
const result = resolveRoutedTurnRecovery({ actor: fighter, fighters: [fighter], positions, calculateDistance: distance, rng: () => 0.99 });
assert.equal(result.recovered, true);
console.log("unpursued routed player rally test passed");
