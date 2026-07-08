import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /const unresolvedEnemyTurnStartKeyRef = useRef\(null\)/,
  "CombatPage should track unresolved enemy turn starts separately from timer-only dedupe",
);
assert.match(
  source,
  /unresolvedEnemyTurnStartKeyRef\.current === requestedTurnStartKey[\s\S]*enemy turn start deduped for \$\{formatCombatActorLabel/,
  "same-key enemy starts should be deduped while unresolved",
);
assert.match(
  source,
  /lastEnemyScheduleTurnKeyRef\.current = key;\s*unresolvedEnemyTurnStartKeyRef\.current = key;/,
  "enemy start should become unresolved as soon as it is scheduled",
);
assert.match(
  source,
  /turn finalizer accepted fighter=\$\{liveEnemy\.name\} source=\$\{finalizerSource\}[\s\S]*unresolvedEnemyTurnStartKeyRef\.current = null;/,
  "accepted enemy finalizer should resolve the duplicate-start guard",
);
assert.match(
  source,
  /enemyActionCommittedThisSliceRef\.current = false;\s*enemyActionCommittedSliceKeyRef\.current = null;\s*unresolvedEnemyTurnStartKeyRef\.current = null;/,
  "turn advancement should clear unresolved enemy start state for legitimate later turns",
);

console.log("enemy duplicate-start unresolved guard tests passed");
