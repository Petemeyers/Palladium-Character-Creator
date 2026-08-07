import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /evaluateDamageMoraleTrigger/);
assert.match(source, /guardDamageMoraleOutcome/);
assert.match(source, /damage-morale-check-skipped/);
assert.match(source, /damage-morale-transition-audit/);
assert.doesNotMatch(
  source,
  /const moraleOutcome = resolveMoraleCheck\(defenderAfterHit, \{[\s\S]{0,700}damageDealt: finalDamage,[\s\S]{0,100}\}\);[\s\S]{0,200}moraleOutcome\.moraleState\.status === "ROUTED"/,
  "damage morale outcome must be guarded before ROUTED is applied",
);

console.log("damage morale source contract passed");
