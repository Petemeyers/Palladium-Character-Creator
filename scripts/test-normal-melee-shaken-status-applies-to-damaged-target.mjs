import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /\$\{formatNormalAttackActorLabel\(defenderAfterHit, stateAttacker, updated\)\} is SHAKEN by the attack!/,
  "shaken status log should use the damaged target label",
);
assert.doesNotMatch(
  source,
  /\$\{stateAttacker\.name\} is SHAKEN by the attack!|\$\{attacker\.name\} is SHAKEN by the attack!/,
  "shaken status must not log the attacker as shaken",
);

console.log("normal melee shaken target status tests passed");
