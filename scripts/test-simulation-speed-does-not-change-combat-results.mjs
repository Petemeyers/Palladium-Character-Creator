import assert from "node:assert/strict";
import { getSimulationDelay } from "../src/utils/simulationSpeed.js";
const resolveMechanicalResult = (roll, armor, damage, speed) => ({
  hit: roll >= armor,
  damage: roll >= armor ? damage : 0,
  delay: getSimulationDelay(1000, speed),
});
const normal = resolveMechanicalResult(15, 12, 7, "normal");
const turbo = resolveMechanicalResult(15, 12, 7, "turbo");
assert.deepEqual({ hit: normal.hit, damage: normal.damage }, { hit: turbo.hit, damage: turbo.damage });
assert.notEqual(normal.delay, turbo.delay);
console.log("simulation speed mechanical isolation test passed");
