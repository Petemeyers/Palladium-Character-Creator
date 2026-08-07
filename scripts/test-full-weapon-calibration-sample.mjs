import assert from "node:assert/strict";
import fs from "node:fs";

const report = JSON.parse(fs.readFileSync(
  new URL("../MILESTONE4_FULL_BATTLE_CALIBRATION_SAMPLE.json", import.meta.url),
  "utf8",
));

const expected = [
  "spear-vs-arming-sword",
  "spear-vs-sword-shield",
  "pike-vs-arming-sword",
  "halberd-vs-arming-sword",
  "greatsword-vs-spear",
  "longsword-half-sword-vs-spear",
];
for (const id of expected) {
  const result = report.results?.[id];
  assert.ok(result, `missing calibration scenario ${id}`);
  const total = result.leftWinRate + result.rightWinRate + result.drawRate;
  assert.ok(Math.abs(total - 1) < 1e-9, `${id} rates must sum to one`);
  assert.ok(result.averageLeftStamina >= 0 && result.averageRightStamina >= 0);
}

assert.ok(
  report.results["spear-vs-arming-sword"].leftWinRate > 0.5,
  "equal-skill spear should win a majority against an unshielded arming sword",
);
assert.ok(
  report.results["spear-vs-sword-shield"].rightWinRate >
    report.results["spear-vs-arming-sword"].rightWinRate,
  "a shield should improve the sword fighter's result",
);
assert.ok(
  report.results["longsword-half-sword-vs-spear"].entrySuccessRate >
    report.results["spear-vs-arming-sword"].entrySuccessRate,
  "half-sword entry should improve the shorter weapon's entry rate",
);

console.log("full weapon calibration sample tests passed");
