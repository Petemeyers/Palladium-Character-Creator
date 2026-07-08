import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");

assert.match(source, /const damageTargetId = defender\?\.id \?\? defenderId/);
assert.match(source, /const defenderIndex = updated\.findIndex\(f => f\.id === damageTargetId\)/);
assert.match(source, /const updatedDefender = applyDamageWithArmor\(result, attacker, defenderCopy\)/);
assert.match(source, /updated\[defenderIndex\] = updatedDefender/);
assert.doesNotMatch(
  source,
  /const attackerIndex = updated\.findIndex[\s\S]{0,160}applyDamageWithArmor\(result, attacker/,
  "grapple follow-up damage must not be applied through attackerIndex",
);

console.log("grapple follow-up damage target attribution tests passed");
