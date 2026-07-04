import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeSimulationSpeed, SIMULATION_SPEEDS } from "../src/utils/simulationSpeed.js";
assert.equal(normalizeSimulationSpeed(), SIMULATION_SPEEDS.NORMAL);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /combatSimulationSpeed/);
assert.match(source, /<option value=\{SIMULATION_SPEEDS\.NORMAL\}>Normal<\/option>/);
console.log("simulation speed normal default test passed");
