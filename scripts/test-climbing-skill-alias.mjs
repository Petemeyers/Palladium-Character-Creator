import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/utils/skillSystem.js", "utf8");

assert.match(source, /CANONICAL_CLIMBING_SKILL_NAME\s*=\s*["']Climbing["']/);
assert.match(source, /LEGACY_CLIMBING_SKILL_NAME\s*=\s*["']Scale Walls["']/);
assert.ok(
  source.includes("'Climbing': LEGACY_CLIMBING_SKILL_NAME") ||
  source.includes('"Climbing": LEGACY_CLIMBING_SKILL_NAME'),
  "Climbing must map to the legacy progression lookup internally."
);
assert.ok(
  source.includes("'Scaling Walls': LEGACY_CLIMBING_SKILL_NAME") ||
  source.includes('"Scaling Walls": LEGACY_CLIMBING_SKILL_NAME'),
  "Scaling Walls must remain a compatibility alias."
);
assert.ok(source.includes("getCanonicalSkillDisplayName"));
assert.match(source, /name:\s*getCanonicalSkillDisplayName\(normalizedName\)/);

console.log("PASS Climbing public-name / legacy-lookup source compatibility");
