import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /enemyTurnTimerRef\.current = setTimeout/);
assert.match(source, /handleEnemyTurnRef[\s\S]*getSimulationDelay\(0, simulationSpeed\)/);
assert.match(source, /getMoveDurationMs[\s\S]*getSimulationDelay/);
console.log("enemy schedule speed scaling test passed");
