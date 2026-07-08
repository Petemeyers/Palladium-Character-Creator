import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /\$\{formatNormalAttackActorLabel\(defenderAfterHit, stateAttacker, updated\)\} breaks and ROUTES!/,
  "route break log should use the damaged target label",
);
assert.match(
  source,
  /\$\{formatNormalAttackActorLabel\(defenderAfterHit, stateAttacker, updated\)\} collapses unconscious and is bleeding!/,
  "incapacitation log should use the damaged target label",
);
assert.doesNotMatch(
  source,
  /\$\{stateAttacker\.name\} breaks and ROUTES!|\$\{attacker\.name\} breaks and ROUTES!/,
  "route break must not log the attacker as routed",
);

console.log("normal melee route/break target status tests passed");
