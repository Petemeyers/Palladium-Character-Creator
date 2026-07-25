import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(
  combatPage,
  /function cancelCombatOwnedContinuations\(\{[\s\S]*?for \(const \[continuationKey, record\][\s\S]*?state:\s*"canceled"/,
  "central combat-owned continuation cancellation should cancel active remaining-action continuations without erasing historical receipts.",
);

assert.match(
  combatPage,
  /initiativeTurnStartRetryTimersRef\.current\?\.clear\?\.\(\)[\s\S]*?staleArmoredActionPlans\(/,
  "central combat-owned continuation cancellation should cancel retry timers and stale non-terminal armored plans.",
);

assert.match(
  combatPage,
  /function clearCombatFlowLocks\(reason = "combat-end"[\s\S]*?cancelCombatOwnedContinuations\(\{/,
  "combat flow cleanup should delegate continuation cancellation through the central helper.",
);

assert.match(
  combatPage,
  /eventType:\s*"combat-owned-continuations-canceled"/,
  "combat-owned continuation cancellation should emit a structured event.",
);

assert.match(
  combatPage,
  /eventType:\s*"grapple-callback-stale-ignored"[\s\S]*?return false/,
  "stale grapple callbacks should be ignored before completion work continues.",
);

console.log("✅ Phase 3B1 combat-end continuation cancellation source tests passed");
