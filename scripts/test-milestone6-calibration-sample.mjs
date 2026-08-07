import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sample = JSON.parse(fs.readFileSync(
  path.join(root, "MILESTONE6_MIXED_FORMATION_CALIBRATION_SAMPLE.json"),
  "utf8",
));

assert.equal(sample.generatedBy, "calibrate-mixed-unit-weapon-battles.mjs");
assert.ok(Number(sample.iterationsPerScenario) >= 100);

const formationScenarios = [
  "spear-line-vs-swords",
  "supported-pikes-vs-shielded-swords",
  "mixed-polearms-vs-mixed-close-weapons",
];

for (const key of formationScenarios) {
  const result = sample.results?.[key];
  assert.ok(result, `missing result for ${key}`);
  assert.ok(result.entryAttempts > 0, `${key} should attempt entries`);
  assert.ok(result.formationSupportedActions > 0, `${key} should record spatial support`);
  assert.ok(result.formationDisruptions > 0, `${key} should record disruption`);
  assert.ok(result.supportedContestRate > 0, `${key} should contain supported contests`);
  assert.ok(result.supportedContestRate < 0.5, `${key} should not treat every nearby fighter as support`);
}

const closeScenario = sample.results?.["close-weapon-team-vs-sword-line"];
assert.ok(closeScenario, "missing close-weapon control scenario");
assert.equal(closeScenario.formationSupportedActions, 0);
assert.equal(closeScenario.supportedContestRate, 0);

console.log("Milestone 6 calibration sample test passed");
