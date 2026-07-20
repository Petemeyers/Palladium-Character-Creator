import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(combatPage, /const ensureLogicalInitiativeTurn = useCallback/);
assert.match(combatPage, /const startPendingInitiativeTurn = useCallback/);
assert.match(combatPage, /disposition:\s*"created-pending"/);
assert.match(combatPage, /disposition:\s*"existing-pending"/);
assert.match(combatPage, /disposition:\s*"existing-active-continuation"/);
assert.match(combatPage, /disposition:\s*"rejected-stale-or-completed"/);
assert.match(combatPage, /state:\s*"pending-start"/);
assert.match(combatPage, /const pendingStart = startPendingInitiativeTurn/);
assert.match(combatPage, /transitionLogicalInitiativeTurn\(initiativeTurnId,\s*"starting"/);
assert.match(combatPage, /transitionLogicalInitiativeTurn\(logicalTurn\.initiativeTurnId,\s*"active"/);
assert.match(combatPage, /transitionLogicalInitiativeTurn\(completingInitiativeTurnId,\s*"completed"/);
assert.match(combatPage, /initiativeTurnStartRetryTimersRef\.current\.has\(logicalTurn\.initiativeTurnId\)/);
assert.match(combatPage, /eventType:\s*"turn-scheduler-existing-pending"/);
assert.match(combatPage, /eventType:\s*"initiative-turn-state-transition"/);
assert.doesNotMatch(combatPage, /duplicate-logical-turn/);

console.log("✅ Phase 3B1 pending-turn handshake source tests passed");
