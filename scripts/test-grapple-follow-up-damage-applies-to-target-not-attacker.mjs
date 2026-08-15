import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");

assert.match(source, /const damageTargetId = defender\?\.id \?\? defenderId/);
assert.match(source, /const defenderIndex = updated\.findIndex\(f => f\.id === damageTargetId\)/);
assert.match(source, /const canonicalImpact = applyCanonicalGrappleImpact\(\{/);
assert.match(source, /defender: defenderCopy/);
assert.match(source, /targetId: defenderCopy\.id/);
assert.match(source, /updated\[defenderIndex\] = updatedDefender/);
assert.doesNotMatch(
  source,
  /applyCanonicalGrappleImpact\(\{[\s\S]{0,320}defender:\s*attacker/,
  "grapple follow-up damage must not be applied through attackerIndex",
);

console.log("grapple follow-up damage target attribution tests passed");
