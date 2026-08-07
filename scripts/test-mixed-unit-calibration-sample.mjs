import assert from "node:assert/strict";
import fs from "node:fs";

const report = JSON.parse(fs.readFileSync(new URL("../MILESTONE5_MIXED_UNIT_CALIBRATION_SAMPLE.json", import.meta.url), "utf8"));
assert.equal(report.generatedBy, "calibrate-mixed-unit-weapon-battles.mjs");
assert.ok(report.iterationsPerScenario >= 100);
for (const id of [
  "spear-line-vs-swords",
  "supported-pikes-vs-shielded-swords",
  "mixed-polearms-vs-mixed-close-weapons",
  "close-weapon-team-vs-sword-line",
]) {
  const result = report.results[id];
  assert.ok(result, `missing ${id}`);
  assert.ok(result.leftWinRate >= 0 && result.leftWinRate <= 1);
  assert.ok(result.rightWinRate >= 0 && result.rightWinRate <= 1);
  assert.ok(result.averageLeftSurvivors >= 0 && result.averageLeftSurvivors <= 3);
  assert.ok(result.averageRightSurvivors >= 0 && result.averageRightSurvivors <= 3);
}
console.log("mixed-unit calibration sample test passed");
