import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /unresolvedEnemyTurnStartKeyRef\.current === requestedTurnStartKey[\s\S]*const unresolvedHasNoWork =[\s\S]*!enemyActionCommittedThisSliceRef\.current/,
  "dedupe branch should inspect whether unresolved enemy start has any committed work",
);
assert.match(
  source,
  /enemy unresolved turn has no committed action or finalizer:[\s\S]*source=\$\{reason\}/,
  "dedupe branch should emit hard diagnostic when no action/finalizer is pending",
);
assert.match(
  source,
  /enemy turn start deduped for[\s\S]*if \(unresolvedHasNoWork\) \{/,
  "dedupe should remain a guard but not mask unresolved no-action turns",
);

console.log("enemy dedupe unresolved no-action guard tests passed");
