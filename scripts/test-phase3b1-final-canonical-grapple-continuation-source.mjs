import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");
const enemyTurnAI = readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");
const playerTurnAI = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");

assert.match(
  combatPage,
  /dispatchGrappleTurnAction:\s*\(actor, targetActor, requestedActionType = "grapple", armoredActionPlan = null, admission = null\)[\s\S]{0,500}executeCanonicalGrappleAction\(\{[\s\S]{0,500}continuationAuthorization:\s*admission\?\.continuationAuthorization \|\| null/,
  "CombatPage enemy dispatcher wrapper must explicitly accept and forward grapple admission",
);
assert.match(combatPage, /eventType:\s*"enemy-grapple-authorization-route-entry"/);
assert.match(combatPage, /eventType:\s*"enemy-grapple-authorization-dispatch-entry"/);
assert.match(
  combatPage,
  /const launched = executeCanonicalGrappleAction\(\{[\s\S]{0,500}continuationAuthorization:\s*meta\?\.continuationAuthorization \|\| null/,
  "inline enemy active-grapple dispatch must forward the exact receipt",
);
assert.match(enemyTurnAI, /enemy-grapple-authorization-route-entry/);
assert.match(enemyTurnAI, /enemy-grapple-authorization-dispatch-entry/);
assert.match(playerTurnAI, /player-grapple-authorization-route-entry/);

assert.match(combatPage, /const createCanonicalGrappleActionToken = useCallback/);
assert.match(combatPage, /createCanonicalGrappleActionToken\(\{[\s\S]{0,500}actionSequence:\s*nextGrappleActionSequence/);
assert.match(combatPage, /eventType:\s*"initiative-action-token-created"/);
assert.match(combatPage, /eventType:\s*"grapple-completion-arbiter-duplicate-call-blocked"/);
assert.match(combatPage, /completionArbiterCallCount:\s*1/);
assert.match(combatPage, /continuationSchedulingOwner:\s*"grapple-completion-arbiter"/);
assert.match(combatPage, /eventType:\s*"generic-continuation-scheduler-suppressed-for-grapple"/);
assert.doesNotMatch(combatPage, /eventType:\s*"player-grapple-generic-continuation-path-blocked"/);
assert.match(combatPage, /const canonicalActionContinuation = Array\.from/);

assert.match(combatPage, /eventType:\s*"continuation-key-identity-validated"/);
assert.match(combatPage, /eventType:\s*"continuation-key-reconstruction-blocked"/);
assert.match(combatPage, /continuationKey:\s*firedEntry\.continuationKey/);
assert.match(combatPage, /eventType:\s*"grapple-roll-without-action-envelope-blocked"/);
assert.match(combatPage, /admission\?\.actionSequence === record\.actionSequence/);

assert.match(
  combatPage,
  /continuationOwnedState[\s\S]{0,2400}eventType:\s*"turn-start-suppressed"[\s\S]{0,1600}return false;[\s\S]{0,600}ensureLogicalInitiativeTurn/,
  "scheduler must suppress continuation-owned starts before logical-turn creation",
);

console.log("✅ Phase 3B1 final canonical grapple continuation source tests passed");
