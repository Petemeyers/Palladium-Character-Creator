import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(combatPage, /const initiativeTurnLogicalRegistryRef = useRef\(new Map\(\)\)/);
assert.match(combatPage, /eventType:\s*"initiative-turn-creation-rejected"/);
assert.match(combatPage, /eventType:\s*"initiative-turn-existing-pending"/);
assert.match(combatPage, /disposition:\s*"existing-pending"/);
assert.match(combatPage, /eventType:\s*"initiative-turn-start-deferred"/);
assert.match(combatPage, /eventType:\s*"initiative-turn-start-resumed"/);
assert.doesNotMatch(
  combatPage,
  /reason=duplicate-logical-turn/,
  "matching pending-start retries must not be treated as duplicate logical-turn creation",
);
assert.match(combatPage, /eventType:\s*"turn-start-suppressed"/);
assert.match(combatPage, /reason=continuation-pending/);
assert.match(combatPage, /eventType:\s*"remaining-action-continuation-created"/);
assert.match(combatPage, /eventType:\s*"remaining-action-continuation-fired"/);
assert.match(combatPage, /initiativeTurnIdRef\.current !== continuationInitiativeTurnId/);
assert.doesNotMatch(
  combatPage,
  /initiativeTurnInstanceRef\.current \+= 1;[\s\S]{0,240}eventType:\s*"initiative-turn-reuse"/,
  "continuation reuse must not create a new initiative turn instance",
);

console.log("✅ Phase 3B1 single-turn owner source tests passed");
