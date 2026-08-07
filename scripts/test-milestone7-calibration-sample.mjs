import assert from "node:assert/strict";
import fs from "node:fs";

const sample = JSON.parse(fs.readFileSync(new URL("../MILESTONE7_LARGE_BATTLE_CALIBRATION_SAMPLE.json", import.meta.url), "utf8"));
assert.equal(sample.schemaVersion, 1);
assert.deepEqual(sample.sizes, [5, 10, 20]);
assert.equal(sample.scenarios.length, 12);
for (const scenario of sample.scenarios) {
  assert.ok([5, 10, 20].includes(scenario.size));
  assert.ok(scenario.supportRate >= 0 && scenario.supportRate <= 1);
  assert.ok(scenario.entrySuccessRate >= 0 && scenario.entrySuccessRate <= 1);
  assert.ok(scenario.longWinRate >= 0 && scenario.longWinRate <= 1);
  assert.ok(Number.isFinite(scenario.formationCommandsPerBattle));
}
assert.ok(sample.scenarios.some((scenario) => scenario.formationDisruptionsPerBattle > 0));
assert.ok(sample.scenarios.some((scenario) => scenario.formationCommandsPerBattle > 0));
console.log("milestone 7 calibration sample test passed");
