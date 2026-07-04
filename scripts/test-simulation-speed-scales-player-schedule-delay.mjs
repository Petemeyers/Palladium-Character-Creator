import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /playerAITimerRef\.current = setTimeout/);
assert.match(source, /player-turn-start-busy-retry[\s\S]*getSimulationDelay\(32, simulationSpeed/);
assert.match(source, /handlePlayerAITurnRef[\s\S]*getSimulationDelay\(0, simulationSpeed\)/);
console.log("player schedule speed scaling test passed");
