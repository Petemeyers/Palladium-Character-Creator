import assert from "node:assert/strict";
import { getSimulationDelay } from "../src/utils/simulationSpeed.js";
assert.equal(getSimulationDelay(1000, "normal"), 1000);
assert.equal(getSimulationDelay(1000, "fast"), 350);
assert.equal(getSimulationDelay(1000, "turbo"), 50);
assert.equal(getSimulationDelay(1000, "instant"), 0);
assert.equal(getSimulationDelay(1000, "instant", { minMs: 25 }), 25);
console.log("simulation speed delay helper test passed");
