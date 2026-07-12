import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const activeGrappleActionIdRef = useRef\(null\)/);
assert.match(source, /const getStaleGrappleReason = \(validationActionId = null\) =>/);
assert.match(source, /if \(validationActionId && activeGrappleActionIdRef\.current !== validationActionId\) return "action superseded"/);
assert.match(source, /if \(activeFighter\?\.id !== grappleTurnSnapshot\.fighterId\) return "turn changed"/);
assert.match(source, /if \(\(turnCounterRef\.current \?\? turnCounter\) !== grappleTurnSnapshot\.turnCounter\) return "turn changed"/);
assert.match(source, /if \(\(meleeRoundRef\.current \?\? meleeRound\) !== grappleTurnSnapshot\.meleeRound\) return "round changed"/);
assert.match(source, /if \(remaining <= 0\) return "no actions"/);
assert.match(source, /const logStaleGrappleFollowUpBlocked = \(reason, executionKey = grappleActionId\) =>/);
assert.match(source, /stale grapple follow-up blocked: actor=/);
assert.match(source, /executionKey=\$\{executionKey\}/);
assert.match(source, /logStaleGrappleFollowUpBlocked\(latestStaleReason, grappleActionId\)/);

assert.match(source, /const executePlayerAIGrapple = \(attacker, target, requestedActionType = null\) =>/);
assert.match(source, /const grappleExecutionKey = playerAIExecutionRef\.current\?\.executionKey/);
assert.match(source, /const logPlayerAIGrappleBlocked = \(reason, actor = attacker\) =>/);
assert.match(source, /logPlayerAIGrappleBlocked\("no-actions", liveAttacker\)/);
assert.match(source, /active-fighter-changed/);
assert.match(source, /round-or-turn-changed/);
assert.match(source, /logPlayerAIGrappleBlocked\("combat-inactive"\)/);

console.log("grapple follow-up ownership guard tests passed");
