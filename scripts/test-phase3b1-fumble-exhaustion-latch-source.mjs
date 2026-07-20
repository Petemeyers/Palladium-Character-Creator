import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(combatPage, /turnEndingExhaustionRegistryRef = useRef\(new Map\(\)\)/);
assert.match(combatPage, /const createTurnEndingExhaustionKey = useCallback/);
assert.match(combatPage, /turnEndingExhaustionRegistryRef\.current\.set\(exhaustionKey/);
assert.match(combatPage, /eventType:\s*"turn-ending-exhaustion-regression-blocked"/);
assert.match(combatPage, /eventType:\s*"impact-action-bookkeeping-suppressed"/);
assert.match(combatPage, /hasActiveTurnEndingExhaustion\(attackerId, initiativeTurnIdRef\.current\)/);
assert.match(combatPage, /turnEndingExhaustionRegistryRef\.current\.delete\(createTurnEndingExhaustionKey\(\{/);

console.log("✅ Phase 3B1 fumble exhaustion latch source tests passed");
