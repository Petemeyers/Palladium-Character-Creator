import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const grappleActionsSource = readFileSync(
  new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url),
  "utf8",
);
const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(grappleActionsSource, /const rollDice = \(\) => \{\s+const rollStaleReason = getStaleGrappleReason\("grapple-ground-attack-roll"\)/);
assert.match(grappleActionsSource, /stale grapple roll blocked/);
assert.match(grappleActionsSource, /error\.staleGrappleRoll = true/);
assert.match(grappleActionsSource, /if \(error\?\.staleGrappleRoll\) return/);
assert.match(grappleActionsSource, /stale grapple follow-up blocked: actor=/);

const guardIndex = grappleActionsSource.indexOf('const rollStaleReason = getStaleGrappleReason("grapple-ground-attack-roll")');
const rollIndex = grappleActionsSource.indexOf("CryptoSecureDice.rollD20()");
assert.ok(guardIndex !== -1 && rollIndex !== -1 && guardIndex < rollIndex);

assert.match(combatPageSource, /const getStaleGrappleReason = \(validationActionId = null\) => \{/);
assert.match(combatPageSource, /if \(\(meleeRoundRef\.current \?\? meleeRound\) !== grappleTurnSnapshot\.meleeRound\) return "round changed"/);
assert.match(combatPageSource, /if \(grappleActionToken && currentTurnTokenRef\.current !== grappleActionToken\) return "turn token changed"/);

console.log("grapple follow-up low-level ownership guard tests passed");
