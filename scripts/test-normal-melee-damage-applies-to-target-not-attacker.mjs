import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const normalAttackAttackerId = stateAttacker\.id/);
assert.match(source, /const normalAttackTargetId = defender\.id \?\? defenderId/);
assert.match(source, /liveDamageFighters\.find\(\(f\) => f\.id === normalAttackTargetId\)/);
assert.match(source, /defenderIndex = updated\.findIndex\(\(f\) => f\.id === normalAttackTargetId\)/);
assert.match(source, /applyHPToFighter\(defender, newHP\)/);
assert.doesNotMatch(
  source,
  /applyHPToFighter\(stateAttacker,\s*newHP\)|applyHPToFighter\(attacker,\s*newHP\)/,
  "normal melee damage must not apply target HP result to attacker",
);

console.log("normal melee damage target attribution tests passed");
